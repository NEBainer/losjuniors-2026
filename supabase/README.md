# Base de datos - Supabase

Esquema de la base de datos para la app de gestión de restaurante (TFI UTN).
Cubre la **preparación inicial** y los puntos **1, 2, 3, 4, 5, 6 y 11** del
listado de funcionalidades. El código ejecutable está en [`schema.sql`](./schema.sql).

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
Supabase. Si en algún momento hace falta pasar el bucket a privado,
alcanza con cambiar cómo se genera la URL en el service Angular (usando
`createSignedUrl()` en vez de `getPublicUrl()`), sin tocar ni una fila
de la base.

**`usuarios.dni` / `cuil` / `email` — únicos pero no obligatorios a nivel DB**
Se agregaron índices únicos **parciales** (`where dni is not null`, etc.),
no `NOT NULL`: evitan que dos usuarios queden con el mismo DNI/CUIL/email,
pero siguen permitiendo `NULL` porque el `cliente_anonimo` (punto 9) no
completa esos campos. "Obligatorio según el perfil" se sigue resolviendo
en el form Angular (`Validators.required` condicional), no en la DB — la
DB solo se ocupa de que, cuando el dato existe, no se repita. Confirmado
en Supabase el 09/09/2026 que antes de esto no había ningún índice único
más allá de la primary key.

Para usuarios puntualmente, el path tiene subcarpeta:
`usuarios/{uid}/foto.jpg` (no `usuarios/{uid}.jpg` plano). Es importante
que coincida exactamente así porque la policy de Storage valida con
`(storage.foldername(name))[2] = auth.uid()`, que requiere dos niveles
de carpeta — con ruta plana el segundo segmento no existe y el insert
se rechaza siempre. *(Corregido 03/09: esta sección tenía el ejemplo
plano, desactualizado respecto al código real de `cliente.service.ts`
y a la policy ya deployada — ninguno de los dos estaba mal, era solo
este documento.)*

**Cliente anónimo: `signInAnonymously()`, no un ID generado en el cliente**
El punto 9 pide que el cliente anónimo se identifique sin mail/contraseña.
En vez de generar un UUID cualquiera del lado de Angular (que no tendría
ningún respaldo de RLS), se usa `supabase.auth.signInAnonymously()`:
crea un usuario real en `auth.users`, sin credenciales, pero que cuenta
como `authenticated` para todas las políticas ya existentes. Requiere
tener **"Anonymous Sign-Ins"** activado en Authentication → Providers
(activado el 13/09/2026).

**`lista_espera` en tabla aparte, no una columna en `usuarios`**
Es un estado transitorio ("está esperando mesa ahora mismo"), distinto
de los datos permanentes del perfil. Separarlo evita mezclar el ciclo
de vida de "soy cliente de La Mesa" con el de "estoy físicamente en el
local ahora". `cliente_id` es `unique`: un cliente no puede anotarse
dos veces a la lista de espera.

**`mensajes_mozo` (punto 11): remitente desnormalizado, no un join**
`remitente_perfil` y `remitente_nombre` se guardan en cada fila en vez
de resolverse con un join a `usuarios` al leer el chat. Motivo: la RLS
de `usuarios` no deja que un cliente vea el perfil de un mozo (ni al
revés), así que un join ahí se rompe silenciosamente (0 filas, no
error). Guardarlo una vez al insertar evita depender de esa policy en
cada lectura del chat.

**Formato del QR de mesa: JSON discriminado por `tipo`, no texto plano**
Decisión de equipo (16/09/2026): `{"tipo":"mesa","numero":N}`, siguiendo
el mismo patrón que ya usa `QrAppService` para el QR de ingreso
(`{"tipo":"ingreso_local"}`). Se usa `numero` y no `id`/uuid a propósito,
para no tener que retipar `QrAppPayload` (que ya trae `numero: number`
para el caso `'mesa'`) ni tocar el lector unificado que ya lee cualquier
QR de la app. **Estado real:** la DB y el seed ya reflejan este formato
(ver sección 9 de `schema.sql`), pero `mesa.service.ts` (punto 4)
todavía genera el QR real como texto plano `MESA-{numero}` — falta
coordinar esa actualización con quien tenga el punto 4 antes de que el
punto 10/11 dependa de escanear una mesa real.

**Vínculo cliente↔mesa asignada: columna en `mesas`, no tabla aparte**
Para el punto 10 (metre asigna mesa a cliente) hacía falta alguna forma
de saber qué cliente tiene asignada cada mesa. Se eligió agregar
`mesas.cliente_actual_id` (nullable, referencia a `usuarios`) en vez de
una tabla de asignaciones aparte: es una extensión directa del mismo
estado transitorio que ya representa `disponibilidad` (vacía/ocupada),
y evita el costo de una tabla + RLS + joins nuevos para lo que este
punto necesita. Si más adelante hace falta un historial de qué cliente
pasó por qué mesa (auditoría), ahí sí conviene una tabla aparte — no
hace falta hoy.

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

## Bug encontrado y resuelto: Confirm email bloqueaba el insert de clientes

`registrarCliente()` (punto 5) hace `supabase.auth.signUp()` y a
continuación un `insert` en `usuarios` usando la sesión recién creada.
Con **"Confirm email" activado** (Authentication → Sign In/Providers →
Email), `signUp()` no deja sesión activa hasta que el usuario confirma
el correo — el usuario queda en estado "Waiting for verification".
Eso significa que `auth.uid()` es `NULL` en el momento del insert, y
cualquier policy de RLS (incluida `usuarios_cliente_se_autorregistra`)
lo rechaza — no porque la policy esté mal, sino porque no hay sesión.

**Solución:** se desactivó "Confirm email" para el proyecto. Se revisó
el enunciado del TFI y no exige verificación de email en el registro
(el "correo automático" que sí piden los puntos 7/8/22/25 es un
mecanismo distinto — notificaciones de negocio con diseño propio, no
una verificación de cuenta). Queda desactivado para el resto del
proyecto.

## Bug encontrado y resuelto: Realtime no disparaba en `usuarios`

`escucharCambioEstado()` en `cliente.service.ts` se suscribe a
`postgres_changes` sobre la tabla `usuarios`. La tabla no estaba
agregada a la publicación `supabase_realtime`
(Database → Publications) — sin eso, la suscripción se conecta sin
ningún error, pero el callback nunca se dispara. No hay excepción ni
log que lo delate, hay que revisarlo a mano en el dashboard.

**Solución:** se agregó `usuarios` a la publicación `supabase_realtime`
desde Database → Publications. La policy de SELECT existente
(`usuarios_pueden_ver_su_propio_perfil`) ya alcanza para que el cliente
reciba el evento de su propia fila — no hizo falta ninguna policy nueva.

## Seguridad (RLS) activada en

- `usuarios`
- `productos`
- `mesas`
- `producto_fotos`
- `storage.objects` (a través de las políticas del bucket `fotos`, no es
  una tabla propia del esquema pero se administra con el mismo mecanismo
  de RLS)
- `lista_espera`

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
  alta de un empleado nuevo pueda devolver la fila creada). Esta misma
  policy es la que habilita el **listado de clientes pendientes del
  punto 6** — no hizo falta una policy de SELECT nueva.

- **`usuarios_metre_ve_en_lista_espera`** (agregada 16/09/2026 por
  Maximiliano en el SQL Editor, punto 10) — el metre no está incluido en
  `dueño_supervisor_ven_todos_usuarios` (esa policy es solo
  dueño/supervisor), así que sin esto no podía leer nombre/foto de ningún
  cliente en `lista_espera` — solo veía el `cliente_id` (UUID) de esa
  tabla, sin poder resolverlo a un nombre real (confirmado con curl antes
  del fix: `usuarios?select=...&id=eq.<cliente>` con token de metre
  devolvía `[]`). Policy acotada, no una ampliación de la existente:

  ```sql
  create policy "usuarios_metre_ve_en_lista_espera"
  on usuarios
  for select
  to authenticated
  using (
    perfil_actual() = 'metre'
    and exists (
      select 1 from lista_espera le where le.cliente_id = usuarios.id
    )
  );
  ```

  El metre solo ve las filas de `usuarios` que corresponden a alguien que
  está *ahora mismo* en la lista de espera, no a cualquier empleado/cliente
  de la base — más acotado que darle acceso total como dueño/supervisor.

- `usuarios_dueño_supervisor_actualiza_clientes` — dueño/supervisor pueden
  hacer `UPDATE` de una fila de `usuarios` **solo si es de un
  `cliente_registrado`** (puntos 6, 7 y 8: aceptar/rechazar). Se eligió
  esta versión *intermedia* —acotada por `perfil = 'cliente_registrado'`—
  en vez de un `UPDATE` genérico sobre toda la tabla (más permisivo de lo
  que el punto necesita) o un trigger que limite qué columnas se tocan
  (más correcto pero caro para el plazo). El `with check` repite la
  condición para que en el mismo update no se pueda cambiar el `perfil` de
  la fila y salirse del scope. El estado se guarda en la columna nueva
  `usuarios.estado_aprobacion` (enum `pendiente`/`aceptado`/`rechazado`,
  nullable; `NULL` = usuario que no requiere aprobación).

- `usuarios_cliente_se_autorregistra` — permite a cualquier usuario
  autenticado insertar su propia fila en `usuarios` con
  `perfil = 'cliente_registrado'` y `estado_aprobacion = 'pendiente'`
  (punto 5). El `with check` fija ambos campos para que no se pueda usar
  este insert para crear un usuario con otro perfil (ej. `dueño`) ni para
  autoaprobarse. **Agregada el 03/09**, tras detectar en la revisión de
  merge de `dev` que no existía ninguna policy de insert para este flujo
  — solo estaba cubierto el alta de empleados por dueño/supervisor.

**`productos`**
- `productos_lectura_autenticados` — cualquier usuario logueado puede ver
  el menú completo (necesario para que el cliente arme su pedido).
- `productos_cocinero_inserta_platos` — solo el cocinero, y solo para
  `tipo in ('plato', 'postre')`.
- `productos_cantinero_inserta_bebidas` — solo el cantinero, y solo para
  `tipo = 'bebida'`.

**`mesas`**
- `mesas_lectura_autenticados` — cualquier usuario logueado puede ver
  número, tipo y disponibilidad de las mesas. Esta misma policy alcanza
  para que el cliente vea su propia mesa asignada (filtrando por
  `cliente_actual_id = auth.uid()` desde el service) — no hizo falta una
  policy de SELECT nueva para el punto 10.
- `mesas_dueño_supervisor_inserta` — solo dueño/supervisor pueden dar de
  alta una mesa nueva.
- `mesas_dueño_supervisor_actualiza` — dueño/supervisor pueden modificar
  cualquier mesa sin restricción de estado (punto 4: gestión de mesas).
- `mesas_metre_asigna` **(agregada 16/09/2026, punto 10)** — el metre
  puede hacer `UPDATE` sobre una mesa **solo si en ese momento sigue
  `disponibilidad = 'vacia'`**. Es la pieza que evita, a nivel DB, que
  dos asignaciones casi simultáneas sobre la misma mesa pasen las dos:
  la primera que llegue la pone en `'ocupada'`, la segunda ya no
  encuentra la fila en `'vacia'` y queda bloqueada por la policy, sin
  depender de que el front gane la carrera. Complementada por el índice
  único parcial `mesas_cliente_actual_unico` sobre `cliente_actual_id`,
  que además impide que un mismo cliente termine vinculado a dos mesas.

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
  `usuarios/{su_propio_uid}/foto.jpg`. Se valida comparando el segundo
  segmento del path (`(storage.foldername(name))[2]`) contra `auth.uid()`.
- `storage_fotos_cocinero_sube_productos` / `_actualiza_productos` — el
  cocinero puede subir/reemplazar archivos en la carpeta `productos/`.
- `storage_fotos_cantinero_sube_productos` / `_actualiza_productos` —
  mismo criterio para el cantinero, misma carpeta.
- `storage_fotos_dueño_supervisor_sube_mesas` / `_actualiza_mesas` —
  dueño/supervisor pueden subir/reemplazar archivos en la carpeta `mesas/`.
- `storage_fotos_dueño_supervisor_sube_usuarios` — dueño/supervisor pueden
  subir un archivo a la carpeta de **otro** usuario dentro de `usuarios/`
  (no solo la propia). Necesaria para el punto 1 (alta de empleado): quien
  sube la foto es el dueño/supervisor logueado, pero el destino es la
  carpeta del **empleado recién creado**, así que
  `storage_fotos_usuario_sube_propia` (que exige que la carpeta coincida
  con el `auth.uid()` de quien sube) no alcanza. Agregada el 09/09/2026,
  detectada al diseñar el flujo del punto 1 antes de implementarlo — no
  había ningún caso anterior de "subir una foto para otro usuario".
  **Sin `_actualiza_usuarios` todavía**: no hace falta por ahora porque el
  punto 1 es alta, no edición de empleados existentes; agregar si en algún
  momento se pide poder editar la foto de un empleado ya creado.

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
- **5 mesas**, todas creadas por el usuario dueño de prueba. `qr_code`
  ya tiene el formato decidido por el equipo (`{"tipo":"mesa","numero":N}`,
  ver "Decisiones de diseño") — pero `mesa.service.ts` todavía no lo
  genera así en la app real, sigue en texto plano `MESA-{numero}`. El
  seed sirve para probar el punto 10/11 contra el formato correcto
  aunque esa parte del punto 4 no esté actualizada todavía.
- **1 cliente en estado `pendiente`**: se marcó `cliente@test.com` (Julián
  Torres) con `estado_aprobacion = 'pendiente'` a mano, para poder probar
  el listado del punto 6 antes de que exista el alta de cliente registrado
  (punto 5). Es el único; si hace falta probar el listado con varias filas
  hay que crear más usuarios de prueba.
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

**Nota (03/09):** desde que se desactivó "Confirm email" a nivel proyecto
(ver bug de arriba), tildar "Auto Confirm User" al crear usuarios de
prueba manualmente ya no es estrictamente necesario — un `signUp()`
normal desde ahora también deja sesión activa sin confirmación. Se deja
esta guía igual porque sigue siendo el método usado para los usuarios de
`@test.com` (no pasan por el formulario de la app), y no cambia el
resultado.

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
- **Punto 6 — dueño** hace `PATCH` de `estado_aprobacion` sobre un
  `cliente_registrado` → `200`, fila actualizada.
- **Punto 6 — cocinero** intenta el mismo `PATCH` → `200` con body `[]`
  (0 filas: lo frena el `using` de la policy).
- **Punto 6 — dueño** intenta `PATCH` sobre un empleado (cocinero, no es
  `cliente_registrado`) → `200` con body `[]` (0 filas). El scope a
  `cliente_registrado` funciona.

**Prueba (04/09)** con `curl` end-to-end (signup real + insert), 3 casos:
- Cliente se autorregistra con `perfil='cliente_registrado'` +
  `estado_aprobacion='pendiente'` → `201`, fila creada.
- Intento de autoasignarse `perfil='dueño'` → `403`, error `42501`.
- Intento de autoaprobarse (`estado_aprobacion='aceptado'`) → `403`,
  error `42501`.
Confirma que el `with check` filtra correctamente los dos intentos de
manipulación, no solo que la policy compila.


**Nota:** las políticas de `producto_fotos` (la tabla, no Storage) se
probaron por revisión del SQL y quedaron validadas indirectamente al
confirmar que Storage funciona — todavía falta un `insert`/`update`/
`delete` directo con `curl` sobre esa tabla puntual, para tener la misma
confianza que sobre Storage.

**Prueba (16/09/2026) de `mesas_metre_asigna` + `mesas_cliente_actual_unico`
(punto 10)** — 4 casos con `curl` contra Supabase real, usuarios de prueba
del seed, sobre mesas ya existentes en la base (no las 5 del seed original,
la tabla ya tiene filas cargadas por pruebas del punto 4):

1. **Metre asigna una mesa `vacia`** (`PATCH /mesas?id=eq.<mesa_vacia>` con
   `disponibilidad: 'ocupada', cliente_actual_id: <cliente>`) → `200`, la
   fila se actualiza y el `select` de vuelta confirma el cambio.
2. **Ese mismo metre intenta reasignar la misma mesa** (ya `ocupada`) a
   otro cliente → `200` con body `[]` (0 filas: el `using` de la policy ya
   no matchea porque `disponibilidad` dejó de ser `'vacia'`).
3. **Mozo intenta asignar una mesa `vacia`** (mismo payload que el caso 1,
   token de `mozo@test.com`) → `200` con body `[]` (bloqueado: `perfil_actual()
   != 'metre'`).
4. **Metre intenta asignar una segunda mesa `vacia` al mismo cliente** que
   ya tiene una mesa asignada (caso 1) → `409`, `{"code":"23505", "message":
   "duplicate key value violates unique constraint \"mesas_cliente_actual_unico\""}`.

Confirma que la protección contra doble asignación funciona a nivel de
datos, no solo que las policies compilan. Nota aparte, no relacionada con
RLS: la mesa usada en la prueba (número 9991, creada 06/09) todavía tiene
`qr_code = "MESA-9991"` en texto plano — evidencia real (no solo lectura de
código) de que `mesa.service.ts` sigue sin generar el formato JSON acordado
para el QR de mesa (ver gap #17 en `AVANCES.md`). La mesa se liberó
(`disponibilidad: 'vacia', cliente_actual_id: null`) al terminar la prueba
para no dejar estado de prueba ensuciando la demo.

**Prueba (16/09/2026) de `usuarios_metre_ve_en_lista_espera` (punto 10)**
— 4 casos con `curl`, cliente de prueba `cliente@test.com` anotado a mano
en `lista_espera` para la prueba (se sacó al terminar):

1. **Metre lee nombre/foto del cliente que está en la lista** (`GET
   /usuarios?select=id,nombres,apellidos,foto_url&id=eq.<cliente>`) →
   devuelve la fila completa (antes de la policy devolvía `[]`).
2. **Metre lee el embed `lista_espera?select=...,usuarios(...)`** → el
   objeto `usuarios` viene resuelto (nombre/apellido/foto), no `null`.
3. **Metre intenta leer un usuario que NO está en la lista** (ej. el
   cocinero de prueba) → `[]`. Confirma que la policy es acotada a
   `lista_espera`, no una puerta abierta a toda la tabla.
4. **Mozo intenta leer al mismo cliente que sí está en la lista** → `[]`.
   Confirma que la policy es específica de `perfil_actual() = 'metre'`, no
   alcanza a cualquier perfil autenticado.

## Pendiente (a propósito, según lo visto en clase)

- Políticas de `UPDATE`/`DELETE` en `productos` y `mesas` (ej.: cocinero
  editando su propio plato, dueño dando de baja una mesa). No las pide
  ningún punto de esta entrega todavía. *(En `usuarios` ya se agregó el
  `UPDATE` acotado a `cliente_registrado` para los puntos 6-8; ver la
  sección de políticas más arriba.)*
- Prueba directa (no vía Storage) de `insert`/`update`/`delete` sobre
  `producto_fotos`.
- Prueba directa con `curl` de `usuarios_cliente_se_autorregistra` (ver
  nota en la sección anterior).
- Alta de empleados desde la app real: la solución está **diseñada pero
  no implementada** (la DB ya está lista, ver más abajo). Requiere una
  **Edge Function** con `admin.createUser()` (usando la `service_role`
  key) para el paso de Auth únicamente — el resto del flujo (insert en
  `usuarios`, subida de foto a Storage) se hace directo desde el cliente
  Angular con la sesión del dueño/supervisor, ya que las policies
  necesarias para eso **ya existen y están confirmadas** (ver detalle
  abajo). Sigue sin existir el archivo de la function en el proyecto, no
  se desplegó y no se probó — eso es lo único que falta de este punto del
  lado de Supabase.
  - **Diseño confirmado el 09/09/2026** tras revisar en el SQL Editor qué
    policies ya estaban creadas: `usuarios_dueño_supervisor_inserta_empleados`
    (para el insert en `usuarios`) y `storage_fotos_dueño_supervisor_sube_usuarios`
    (agregada ese mismo día, para la foto) ya cubren esos dos pasos sin
    necesitar `service_role`. Esto simplifica lo que la Edge Function
    tiene que hacer: solo crear el usuario en Auth y devolver su `id`,
    nada más.
- Validaciones adicionales a nivel DB: largo máximo de descripción,
  nombres duplicados en la carta.
- Postres cargados en el seed.
- Tablas de los puntos siguientes del TFI (estadías, lista de espera,
  pedidos, encuestas, etc.) — se agregan a medida que el equipo avance
  con esas partes de la app.
- ~~Realtime en `lista_espera`~~ — agregada a la publicación
  `supabase_realtime` el 13/09/2026, mismo mecanismo que `usuarios`.
- Punto 9 (cliente anónimo): DB lista y confirmada (policies + Realtime).
  Falta la pantalla del metre viendo la lista en vivo — corresponde al
  punto 10, coordinar con quien lo desarrolle.
- Punto 10: DB lista y confirmada (15-16/09/2026) — `mesas.cliente_actual_id`,
  índice único parcial `mesas_cliente_actual_unico`, policy
  `mesas_metre_asigna` (UPDATE, metre, solo si `disponibilidad = 'vacia'`)
  y policy `usuarios_metre_ve_en_lista_espera` corridas en el SQL Editor
  (documentadas en `schema.sql` v6). Front implementado: pantalla del
  metre (`metre-lista-espera`) con la cola en vivo, asignación de mesa y
  aviso local al cliente vía `NotificacionesService`. Falta coordinar con
  quien tenga el punto 4 la actualización de `mesa.service.ts` al formato
  de QR ya decidido.
- Punto 9 (cliente anónimo): **funcionando de punta a punta** —
  ingreso vía QR + registro anónimo + lista de espera confirmados
  en dispositivo real (14/09/2026). Falta la pantalla del metre
  viendo la lista en vivo — corresponde al punto 10.
- Punto 11 (consulta al mozo): tabla `mensajes_mozo` + policies
  (`schema.sql` v7) corridas en el SQL Editor y Realtime activado para
  esa tabla el 25/09/2026 (hasta esa fecha el chat fallaba al enviar
  porque la tabla no existía en la base real). Chat cliente–mozo
  probado en dispositivo real.

  ## Sistema de mail automático (puntos 7/8)

Notifica al cliente por correo el estado de su registro (pendiente al
registrarse, aceptado/rechazado cuando dueño/supervisor lo confirma).
No requiere ninguna tabla ni columna nueva — invoca una Edge Function
con los datos que la base ya tenía.

**Arquitectura:** Edge Function `enviar-correo-estado`, invocada desde
`cliente.service.ts` (estado 'pendiente') y `usuarios.service.ts`
(estado 'aceptado'/'rechazado', dentro de `setEstadoCliente`).

## Bug encontrado y resuelto: SMTP directo no funciona desde Edge Functions

El primer intento usó SMTP directo (Gmail, vía `denomailer`) desde la
Edge Function. Nunca llegó a enviar nada — los logs mostraban `booted`
seguido de `shutdown` con `reason: "EarlyDrop"` después de ~75
segundos, sin ningún error explícito.

**Causa:** Deno Deploy (la infraestructura donde corren las Edge
Functions de Supabase) bloquea las conexiones salientes a los puertos
SMTP (25, 465, 587) como medida antispam — está documentado incluso en
ejemplos oficiales de Supabase. La conexión a `smtp.gmail.com:465`
quedaba colgada indefinidamente hasta que la plataforma mataba la
función por inactividad.

**Solución:** se migró a **Brevo** (API HTTP, no SMTP) — funciona
porque usa el puerto 443 (HTTPS), no bloqueado. Se descartó Resend
antes de esto porque exige dominio propio verificado para mandar a
destinatarios que no sean el dueño de la cuenta; Brevo permite mandar
a cualquier destinatario verificando solo el mail remitente (sin DNS),
con 300 mails/día gratis.

**Limitación aceptada:** sin dominio propio con SPF/DKIM, hay más
chance de que el mail caiga en spam (especialmente en Gmail/Yahoo).
No bloqueante para la entrega, pero avisar de esto al mostrar la demo.

## Bug encontrado y resuelto: CORS faltante bloqueaba el envío desde la app

Con la función ya usando Brevo, seguía sin llegar ningún mail — los
logs mostraban `"request.method": "OPTIONS"` con `500`. El navegador
manda automáticamente una petición `OPTIONS` (preflight) antes del
`POST` real; la función intentaba leer `req.json()` también en ese
caso, fallaba, y el navegador cortaba ahí sin llegar a mandar la
petición real con los datos del mail.

**Solución:** manejar `OPTIONS` explícitamente al principio del
`Deno.serve()`, devolviendo los headers de CORS antes que nada, y
agregar esos mismos headers a todas las respuestas (incluidas las de
error).

## Bug encontrado y resuelto: faltaba policy de INSERT para cliente anónimo

Al probar el ingreso anónimo (punto 9), el insert en `usuarios`
fallaba con 403 (`42501 - new row violates row-level security
policy`). Causa: la policy `clientes_se_autorregistran` (armada para
el punto 5) exige explícitamente `perfil = 'cliente_registrado'` en
su `with check` — no contempla ningún otro perfil. Como el cliente
anónimo inserta con `perfil = 'cliente_anonimo'`, ninguna policy
existente lo autorizaba.

**Lección para el resto del equipo**: cada perfil nuevo que se
autorregistre en `usuarios` (sin pasar por el alta de un dueño/
supervisor) necesita su propia policy de INSERT explícita — no
alcanza con "ya hay una policy de autorregistro", hay que revisar
si esa policy filtra por perfil específico antes de asumir que
cubre un caso nuevo.

## Pendiente

- `verify_jwt = true` en `supabase/config.toml` para
  `enviar-correo-estado` (mejora de seguridad: sin esto, cualquiera con
  la clave pública de la app podría invocar la función directo y mandar
  mails arbitrarios).
- Dominio propio para mejorar deliverability (opcional, no bloqueante).