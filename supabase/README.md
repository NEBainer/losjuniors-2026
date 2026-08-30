# Base de datos - Supabase

Esquema de la base de datos para la app de gestión de restaurante (TFI UTN).
Cubre la **preparación inicial** y los puntos **1, 2, 3, 4 y 11** del listado
de funcionalidades. El código ejecutable está en [`schema.sql`](./schema.sql).

## Cómo se armó

Todo se fue creando y probando directamente en el **SQL Editor de Supabase**
(no se usa la CLI de Supabase ni migraciones formales todavía). El archivo
`schema.sql` es la versión consolidada de esas queries, pensada para poder
recrear la base desde cero en cualquier proyecto nuevo de Supabase.

## Decisiones de diseño

**Tabla `usuarios` separada de `auth.users`**
La contraseña nunca se guarda en `usuarios` — eso lo maneja Supabase Auth
(`auth.users`). La tabla `usuarios` se vincula 1 a 1 por `id` y guarda solo
los datos de negocio (nombre, DNI, perfil, etc.).

**`productos` como tabla única (no una tabla por tipo)**
Platos, bebidas y postres comparten exactamente la misma estructura (nombre,
descripción, tiempo de elaboración, precio, 3 fotos), así que van en una sola
tabla diferenciada por la columna `tipo`. `activo_en_carta` resuelve el
requisito de "se verifica la existencia en la carta" de los puntos 2 y 3.

**`producto_fotos` en tabla aparte, no columnas `foto1/foto2/foto3`**
Es una relación uno-a-muchos: agregar o cambiar una foto es una fila nueva,
no un cambio de estructura de la tabla. `orden` está restringido a 1-3 y es
único por producto (un producto no puede tener dos fotos en la misma
posición).

**Validaciones a nivel de columna, no solo en la app**
`check (precio >= 0)` y `check (tiempo_elaboracion_minutos > 0)` aseguran
que la base nunca guarde un dato inválido, sin importar qué controle (o no)
el formulario del lado de la app. Es una segunda capa de seguridad, no un
reemplazo de la validación en el frontend.

**Storage: un bucket único (`fotos`), no uno por entidad**
Un solo bucket con subcarpetas (`usuarios/`, `productos/`, `mesas/`) es
más simple de administrar que tres buckets separados, y las políticas RLS
pueden diferenciar por carpeta usando el path del archivo — no hace falta
la complejidad extra de gestionar permisos distintos por bucket.

**Storage: bucket público, no privado con signed URLs**
El enunciado no exige privacidad de los datos/fotos, así que un bucket
público evita la complejidad de pedir `createSignedUrl()` (con su
expiración y refetch) en 5 puntos funcionales distintos. Es una decisión
defendible dado el alcance del TFI, no un descuido de seguridad.

**En `foto_url` se guarda el path, no la URL pública completa**
Tanto en `usuarios.foto_url`, `producto_fotos.url` como `mesas.foto_url`
se guarda algo como `productos/{id}/1.jpg`, no la URL completa de
`picsum`/Supabase. Si en algún momento hace falta pasar el bucket a
privado, alcanza con cambiar cómo se genera la URL en el service Angular,
sin tocar ni una fila de la base.

## Función auxiliar: `perfil_actual()`

Se usa en todas las políticas RLS que dependen del perfil del usuario
logueado, para no repetir el mismo subquery en cada una.

```sql
create function perfil_actual()
returns perfil_usuario
language sql
stable
security definer
set search_path = public
as $$
  select perfil from usuarios where id = auth.uid();
$$;
```

`security definer` + `search_path` fijo es **imprescindible** acá, no es un
detalle menor — ver el bug explicado abajo.

## Bug encontrado y resuelto: recursión infinita en RLS

La primera versión de `perfil_actual()` (sin `security definer`) generaba
el error `54001 "stack depth limit exceeded"` en combinación con la política
`dueño_supervisor_ven_todos_usuarios`:

1. Esa política llama a `perfil_actual()` para saber si quien consulta es
   dueño/supervisor.
2. `perfil_actual()` a su vez hace un `select` sobre `usuarios`.
3. Ese `select` vuelve a disparar las políticas RLS de `usuarios`...
   incluyendo la misma política del paso 1. Ciclo sin fin.

**Solución:** agregar `security definer` a la función. Esto hace que esa
consulta puntual se ejecute con privilegios de administrador, sin volver a
pasar por RLS, rompiendo el ciclo. Es seguro porque la función solo expone
el perfil del propio usuario autenticado (`auth.uid()`), sin parámetros
externos que alguien pueda manipular para ver el perfil de otro.

## Seguridad (RLS) activada en

- `usuarios`
- `productos`
- `mesas`
- `producto_fotos`
- `storage.objects` (a través de las políticas del bucket `fotos`, no es
  una tabla propia del esquema pero se administra con el mismo mecanismo
  de RLS)

## Políticas RLS creadas

**`usuarios`**
- `usuarios_pueden_ver_su_propio_perfil` — cualquier usuario logueado puede
  leer su propia fila (necesario tras el login, para saber a qué pantalla
  redirigir según su perfil).
- `usuarios_dueño_supervisor_inserta_empleados` — solo dueño/supervisor
  pueden dar de alta empleados, y solo con perfiles de empleado (no pueden
  crear otro "dueño", ni perfiles de cliente — esos tienen su propio flujo
  con aprobación).
- `dueño_supervisor_ven_todos_usuarios` — dueño/supervisor pueden ver
  cualquier fila de `usuarios`, no solo la propia (necesario para que el
  alta de un empleado nuevo pueda devolver la fila creada).

**`productos`**
- `productos_lectura_autenticados` — cualquier usuario logueado puede ver
  el menú completo (necesario para que el cliente arme su pedido).
- `productos_cocinero_inserta_platos` — solo el cocinero, y solo para
  `tipo in ('plato', 'postre')`.
- `productos_cantinero_inserta_bebidas` — solo el cantinero, y solo para
  `tipo = 'bebida'`.

**`mesas`**
- `mesas_lectura_autenticados` — cualquier usuario logueado puede ver
  número, tipo y disponibilidad de las mesas.
- `mesas_dueño_supervisor_inserta` — solo dueño/supervisor pueden dar de
  alta una mesa nueva.

**`producto_fotos`**
- `producto_fotos_lectura_autenticados` — cualquier usuario logueado puede
  ver las fotos de cualquier producto (necesario para el listado del
  punto 11).
- `producto_fotos_cocinero_inserta` / `_actualiza` / `_borra` — el cocinero
  puede insertar, reemplazar o eliminar fotos únicamente de productos con
  `tipo in ('plato', 'postre')`. Se valida con un `exists` contra la tabla
  `productos`, no solo el perfil, para que no pueda subir una foto a una
  bebida aunque conociera su `producto_id`.
- `producto_fotos_cantinero_inserta` / `_actualiza` / `_borra` — mismo
  criterio, pero el cantinero solo sobre `tipo = 'bebida'`.

**`storage.objects` (bucket `fotos`)**
- `storage_fotos_lectura_publica` — cualquiera puede leer cualquier archivo
  del bucket (coherente con la decisión de bucket público).
- `storage_fotos_usuario_sube_propia` / `_actualiza_propia` — cada usuario
  autenticado solo puede subir/reemplazar su propia foto de perfil, en
  `usuarios/{su_propio_uid}.jpg`. Se valida comparando el segundo segmento
  del path contra `auth.uid()`.
- `storage_fotos_cocinero_sube_productos` / `_actualiza_productos` — el
  cocinero puede subir/reemplazar archivos en la carpeta `productos/`.
- `storage_fotos_cantinero_sube_productos` / `_actualiza_productos` —
  mismo criterio para el cantinero, misma carpeta.
- `storage_fotos_dueño_supervisor_sube_mesas` / `_actualiza_mesas` —
  dueño/supervisor pueden subir/reemplazar archivos en la carpeta `mesas/`.

**Limitación conocida y aceptada:** como la carpeta es
`productos/{producto_id}/...` (no `productos/{tipo}/{producto_id}/...`),
Storage por sí solo no puede distinguir si el archivo que se sube
corresponde a un plato o a una bebida — solo valida el perfil de quien
sube. Un cocinero podría, en teoría, subir un archivo a la carpeta de una
bebida si conociera ese `producto_id`. Esto no es un problema real en la
práctica porque (a) el form de la app nunca expone ese ID fuera del flujo
del cocinero, y (b) la policy de la tabla `producto_fotos` sí valida el
tipo correctamente antes de guardar la referencia — así que aunque el
archivo quedara "de más" en Storage, nunca se podría insertar la fila que
lo referencia. Cerrar esto del todo requeriría meter el tipo en el path
(`productos/plato/{id}/...`) y no está pedido por el enunciado.

## Datos de prueba cargados

Requerido por la consigna ("Preparación inicial"): tener almacenado un
dueño, un supervisor, un metre, un mozo, un cocinero, un cantinero y un
cliente registrado, más al menos 5 platos, 5 bebidas y 5 mesas.

| Usuario | Email | Password |
|---|---|---|
| Dueño | `dueno@test.com` | `Test1234!` |
| Supervisor | `supervisor@test.com` | `Test1234!` |
| Metre | `metre@test.com` | `Test1234!` |
| Mozo | `mozo@test.com` | `Test1234!` |
| Cocinero | `cocinero@test.com` | `Test1234!` |
| Cantinero | `cantinero@test.com` | `Test1234!` |
| Cliente registrado | `cliente@test.com` | `Test1234!` |

- **10 productos**: 5 platos + 5 bebidas. Faltan postres cargados en el
  seed (el enum los contempla, pero no hay ninguno todavía).
- **30 fotos de producto** (10 productos × 3 fotos): son URLs genéricas de
  `picsum.photos` (servicio público de imágenes placeholder), generadas
  automáticamente. **No son fotos reales** — sirven para probar que el
  listado del punto 11 funciona (cada producto trae sus 3 fotos
  correctamente relacionadas). Se reemplazan por fotos reales subidas a
  Supabase Storage cuando el cocinero/cantinero las carguen desde la app.
- **5 mesas**, todas creadas por el usuario dueño de prueba. `qr_code` es
  un valor placeholder (`MESA-1`, `MESA-2`, etc.) — falta definir con el
  equipo el formato final de lo que se codifica en el QR real.
- **Bucket `fotos`** creado y con políticas activas (ver arriba), pero
  **sin archivos reales cargados todavía** — las pruebas de subida se
  hicieron con archivos descartables vía `curl`, no desde la app.

### Cómo cargar los usuarios de prueba

Los usuarios de `auth.users` **no se crean con INSERT directo** — primero
se crean desde el dashboard:

1. **Authentication → Users → Add user**, con **"Auto Confirm User"**
   activado.
2. Copiar el `UID` que Supabase le asigna.
3. Recién ahí correr el `insert into usuarios (...)` de `schema.sql`,
   usando ese mismo `UID` como `id`.

## Probado con `curl` (simulando llamadas reales de la app)

- Login (`POST /auth/v1/token`) + lectura del propio perfil filtrada por
  RLS, para los 7 usuarios de prueba.
- Cocinero puede insertar platos/postres; **no** puede insertar bebidas
  (bloqueado por RLS, error `42501`).
- Cantinero puede insertar bebidas; **no** puede insertar platos.
- Mozo **no** puede insertar mesas (bloqueado por RLS, error `42501`).
- Dueño **sí** puede insertar mesas, con `creado_por` completo.
- Mozo **no** puede insertar usuarios nuevos (error `42501`).
- Dueño **sí** puede insertar empleados nuevos, con perfiles permitidos
  (metre, mozo, cocinero, cantinero, supervisor).
- **Storage — cocinero** puede subir un archivo a
  `fotos/productos/{uuid}/1.jpg` → `200 OK`.
- **Storage — mozo** intenta subir a la misma carpeta → `403 Unauthorized`,
  `"new row violates row-level security policy"`. Confirma que la policy
  de Storage no solo compila: filtra de verdad por perfil.

**Nota:** las políticas de `producto_fotos` (la tabla, no Storage) se
probaron por revisión del SQL y quedaron validadas indirectamente al
confirmar que Storage funciona — todavía falta un `insert`/`update`/
`delete` directo con `curl` sobre esa tabla puntual, para tener la misma
confianza que sobre Storage.

## Pendiente (a propósito, según lo visto en clase)

- Políticas de `UPDATE` y `DELETE` en `usuarios`, `productos` y `mesas`
  (ej.: cocinero editando su propio plato, dueño dando de baja una mesa).
  No las pide ningún punto de esta entrega todavía.
- Prueba directa (no vía Storage) de `insert`/`update`/`delete` sobre
  `producto_fotos`.
- Alta de empleados desde la app real: la solución está **diseñada pero
  no implementada**. Requiere una **Edge Function** con
  `admin.createUser()` (usando la `service_role` key), porque `signUp()`
  normal loguearía automáticamente al empleado nuevo y desconectaría a
  quien lo está creando. El código de referencia de la function y del
  service Angular que la invoca está definido, pero **no se creó el
  archivo en el proyecto, no se desplegó y no se probó**.
- Validaciones adicionales a nivel DB: largo máximo de descripción,
  nombres duplicados en la carta, índices únicos parciales en `usuarios`
  (dni/cuil/email, considerando que el cliente anónimo no completa esos
  campos).
- Postres cargados en el seed.
- Tablas de los puntos siguientes del TFI (estadías, lista de espera,
  pedidos, encuestas, etc.) — se agregan a medida que el equipo avance
  con esas partes de la app.