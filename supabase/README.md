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

`producto_fotos` **todavía no tiene RLS ni políticas propias** — pendiente
para cuando se trabaje a fondo los puntos 2/3, ya que por ahora las fotos
solo se cargan por script, no desde la app.

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

- **10 productos**: 5 platos + 5 bebidas.
- **30 fotos de producto** (10 productos × 3 fotos): son URLs genéricas de
  `picsum.photos` (servicio público de imágenes placeholder), generadas
  automáticamente. **No son fotos reales** — sirven para probar que el
  listado del punto 11 funciona (cada producto trae sus 3 fotos
  correctamente relacionadas). Se reemplazan por fotos reales subidas a
  Supabase Storage cuando el cocinero/cantinero las carguen desde la app.
- **5 mesas**, todas creadas por el usuario dueño de prueba. `qr_code` es
  un valor placeholder (`MESA-1`, `MESA-2`, etc.) — falta definir con el
  equipo el formato final de lo que se codifica en el QR real.

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

## Pendiente (a propósito, según lo visto en clase)

- Políticas de `UPDATE` y `DELETE` en `usuarios`, `productos` y `mesas`
  (ej.: cocinero editando su propio plato, dueño dando de baja una mesa).
  No las pide ningún punto de esta entrega todavía.
- RLS y políticas en `producto_fotos`.
- Alta de empleados desde la app real: requiere una **Edge Function** con
  `admin.createUser()` (usando la `service_role` key), porque `signUp()`
  normal loguearía automáticamente al empleado nuevo y desconectaría a
  quien lo está creando.
- Tablas de los puntos siguientes del TFI (estadías, lista de espera,
  pedidos, encuestas, etc.) — se agregan a medida que el equipo avance
  con esas partes de la app.