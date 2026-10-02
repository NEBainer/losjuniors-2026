-- =========================================================
-- ESQUEMA DE BASE DE DATOS - APP RESTAURANTE (TFI UTN)
-- v3 - Preparación inicial + políticas RLS (puntos 1, 2, 3, 4, 11)
-- v3 (09/09/2026): índices únicos parciales de usuarios (dni/cuil/email)
-- + policy de Storage para que dueño/supervisor suban la foto de un
-- empleado nuevo. Ver supabase/README.md para el detalle completo de
-- decisiones, pruebas realizadas y pendientes.
-- v6 (16/09/2026): vínculo cliente↔mesa asignada + policy de UPDATE
-- para el metre (punto 10). Ver bloque "v6" al final del archivo y
-- supabase/README.md.
-- =========================================================

-- =========================================================
-- 1. TIPOS ENUMERADOS
-- =========================================================

-- Perfiles de usuario según el enunciado (punto "Preparación inicial")
create type perfil_usuario as enum (
  'dueño',
  'supervisor',
  'metre',
  'mozo',
  'cocinero',
  'cantinero',
  'cliente_registrado',
  'cliente_anonimo'
);

-- Platos, bebidas y postres comparten estructura -> una sola tabla
-- diferenciada por este tipo (ver puntos 2, 3 y 11)
create type tipo_producto as enum ('plato', 'bebida', 'postre');

-- Tipo y estado de mesa (punto 4)
create type tipo_mesa as enum ('vip', 'estandar', 'movilidad_reducida');
create type estado_mesa as enum ('vacia', 'ocupada');

-- Estado de aprobación del cliente registrado (puntos 5, 6, 7, 8).
-- El alta de cliente (punto 5) inserta 'pendiente'; dueño/supervisor lo
-- pasan a 'aceptado' o 'rechazado'. NULL = usuario que no requiere
-- aprobación (empleados, dueño, supervisor).
create type estado_aprobacion as enum ('pendiente', 'aceptado', 'rechazado');

-- =========================================================
-- 2. TABLA: usuarios
-- Vinculada 1 a 1 con auth.users (Supabase Auth maneja la contraseña).
-- Puntos 1 y 5: alta de empleado / cliente registrado.
-- =========================================================

create table usuarios (
  id uuid primary key references auth.users(id) on delete cascade,
  apellidos text not null,
  nombres text not null,
  dni text,
  cuil text,
  email text,
  perfil perfil_usuario not null,
  foto_url text,
  created_at timestamptz not null default now()
);

-- Estado de aprobación (puntos 5-8). Columna aparte y nullable: los
-- usuarios ya existentes (seeds, empleados) quedan en NULL = "no requiere
-- aprobación". Sólo el cliente registrado usa este campo.
alter table usuarios add column estado_aprobacion estado_aprobacion;

create index idx_usuarios_perfil on usuarios(perfil);

-- Índices únicos PARCIALES (no NOT NULL): dni/cuil/email no pueden
-- repetirse entre usuarios, pero siguen siendo opcionales a nivel DB
-- porque el cliente_anonimo (punto 9) no los completa. "Obligatorio
-- según el perfil" se valida en el form Angular (Validators.required
-- condicional), no acá. Agregado 09/09/2026.
create unique index if not exists usuarios_dni_unico
  on usuarios (dni) where dni is not null;

create unique index if not exists usuarios_cuil_unico
  on usuarios (cuil) where cuil is not null;

create unique index if not exists usuarios_email_unico
  on usuarios (email) where email is not null;

alter table usuarios enable row level security;

-- =========================================================
-- 3. TABLA: productos (platos, bebidas, postres)
-- Puntos 2 y 3: alta por cocinero/cantinero, con validación de datos.
-- =========================================================

create table productos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  descripcion text not null,
  tipo tipo_producto not null,
  tiempo_elaboracion_minutos integer not null check (tiempo_elaboracion_minutos > 0),
  precio numeric(10,2) not null check (precio >= 0),
  activo_en_carta boolean not null default true,
  creado_por uuid references usuarios(id),
  created_at timestamptz not null default now()
);

alter table productos enable row level security;

-- Fotos de producto en tabla aparte (relación uno-a-muchos, no columnas
-- foto1/foto2/foto3) - puntos 2 y 3: "tres (3) fotos... individuales"
create table producto_fotos (
  id uuid primary key default gen_random_uuid(),
  producto_id uuid not null references productos(id) on delete cascade,
  url text not null,
  orden smallint not null check (orden between 1 and 3),
  unique (producto_id, orden)
);

-- =========================================================
-- 4. TABLA: mesas
-- Punto 4: alta de mesa por dueño/supervisor.
-- =========================================================

create table mesas (
  id uuid primary key default gen_random_uuid(),
  numero integer not null unique,
  cantidad_comensales integer not null check (cantidad_comensales > 0),
  tipo tipo_mesa not null,
  disponibilidad estado_mesa not null default 'vacia',
  foto_url text,
  qr_code text not null unique,
  creado_por uuid not null references usuarios(id),
  created_at timestamptz not null default now()
);

alter table mesas enable row level security;

-- =========================================================
-- 5. FUNCIÓN AUXILIAR: perfil del usuario autenticado
-- security definer + search_path fijo: evita recursión infinita con
-- políticas RLS que también dependen de esta función (detalle en README).
-- =========================================================

create function perfil_actual()
returns perfil_usuario
language sql
stable
security definer
set search_path = public
as $$
  select perfil from usuarios where id = auth.uid();
$$;

-- =========================================================
-- 6. POLÍTICAS RLS
-- =========================================================

-- usuarios ---------------------------------------------------

create policy "usuarios_pueden_ver_su_propio_perfil"
on usuarios
for select
using ( auth.uid() = id );

create policy "usuarios_dueño_supervisor_inserta_empleados"
on usuarios
for insert
to authenticated
with check (
  perfil_actual() in ('dueño', 'supervisor')
  and perfil in ('supervisor', 'metre', 'mozo', 'cocinero', 'cantinero')
);

create policy "dueño_supervisor_ven_todos_usuarios"
on usuarios
for select
to authenticated
using ( perfil_actual() in ('dueño', 'supervisor') );

-- UPDATE: dueño/supervisor aceptan o rechazan clientes registrados
-- pendientes (puntos 6, 7, 8). Versión "intermedia": acotada a
-- perfil = 'cliente_registrado', no un UPDATE genérico sobre toda la
-- tabla. El with check repite la condición para que en el mismo update
-- no se pueda cambiar el perfil de la fila y escaparse del scope.
create policy "usuarios_dueño_supervisor_actualiza_clientes"
on usuarios
for update
to authenticated
using ( perfil_actual() in ('dueño','supervisor') and perfil = 'cliente_registrado' )
with check ( perfil_actual() in ('dueño','supervisor') and perfil = 'cliente_registrado' );

-- productos --------------------------------------------------

create policy "productos_lectura_autenticados"
on productos
for select
to authenticated
using ( true );

create policy "productos_cocinero_inserta_platos"
on productos
for insert
to authenticated
with check ( perfil_actual() = 'cocinero' and tipo in ('plato', 'postre') );

create policy "productos_cantinero_inserta_bebidas"
on productos
for insert
to authenticated
with check ( perfil_actual() = 'cantinero' and tipo = 'bebida' );

-- mesas --------------------------------------------------------

create policy "mesas_lectura_autenticados"
on mesas
for select
to authenticated
using ( true );

create policy "mesas_dueño_supervisor_inserta"
on mesas
for insert
to authenticated
with check ( perfil_actual() in ('dueño', 'supervisor') );

-- UPDATE: dueño/supervisor modifican la disponibilidad de una mesa
-- (punto 4: "permitir la gestión de mesas, dando la posibilidad de
-- modificar la disponibilidad").
create policy "mesas_dueño_supervisor_actualiza"
on mesas
for update
to authenticated
using ( perfil_actual() in ('dueño', 'supervisor') )
with check ( perfil_actual() in ('dueño', 'supervisor') );

-- producto_fotos ------------------------------------------------

alter table producto_fotos enable row level security;

create policy "producto_fotos_lectura_autenticados"
on producto_fotos
for select
to authenticated
using ( true );

create policy "producto_fotos_cocinero_inserta"
on producto_fotos
for insert
to authenticated
with check (
  perfil_actual() = 'cocinero'
  and exists (
    select 1 from productos p
    where p.id = producto_fotos.producto_id
    and p.tipo in ('plato', 'postre')
  )
);

create policy "producto_fotos_cantinero_inserta"
on producto_fotos
for insert
to authenticated
with check (
  perfil_actual() = 'cantinero'
  and exists (
    select 1 from productos p
    where p.id = producto_fotos.producto_id
    and p.tipo = 'bebida'
  )
);

create policy "producto_fotos_cocinero_actualiza"
on producto_fotos
for update
to authenticated
using (
  perfil_actual() = 'cocinero'
  and exists (
    select 1 from productos p
    where p.id = producto_fotos.producto_id
    and p.tipo in ('plato', 'postre')
  )
);

create policy "producto_fotos_cantinero_actualiza"
on producto_fotos
for update
to authenticated
using (
  perfil_actual() = 'cantinero'
  and exists (
    select 1 from productos p
    where p.id = producto_fotos.producto_id
    and p.tipo = 'bebida'
  )
);

create policy "producto_fotos_cocinero_borra"
on producto_fotos
for delete
to authenticated
using (
  perfil_actual() = 'cocinero'
  and exists (
    select 1 from productos p
    where p.id = producto_fotos.producto_id
    and p.tipo in ('plato', 'postre')
  )
);

create policy "producto_fotos_cantinero_borra"
on producto_fotos
for delete
to authenticated
using (
  perfil_actual() = 'cantinero'
  and exists (
    select 1 from productos p
    where p.id = producto_fotos.producto_id
    and p.tipo = 'bebida'
  )
);

-- =========================================================
-- 7. USUARIOS DE PRUEBA
-- Crear primero en Authentication > Users del dashboard (Auto Confirm
-- User activado), y recién después correr este insert con el mismo id.
-- Password para todos: Test1234!
-- =========================================================

insert into usuarios (id, apellidos, nombres, dni, cuil, email, perfil) values
  ('3c6e305d-5593-4bde-a69a-7262e12e2611', 'Pérez',     'Juan',    '30111222', '20301112223', 'dueno@test.com',      'dueño'),
  ('29ab7b25-b921-4e13-92e7-1ad36425b611', 'Gómez',     'María',   '30222333', '27302223334', 'supervisor@test.com', 'supervisor'),
  ('3a9cf688-cfce-4ffa-bc2d-c3d2f9dcaab3', 'Fernández', 'Lucas',   '30333444', '20303334445', 'metre@test.com',      'metre'),
  ('bfe53d0c-8ecb-4e20-9cf7-39182af71a3e', 'Rodríguez', 'Sofía',   '30444555', '27304445556', 'mozo@test.com',       'mozo'),
  ('0ef1c165-5c3e-4154-b838-0cffea487630', 'López',     'Martín',  '30555666', '20305556667', 'cocinero@test.com',   'cocinero'),
  ('1ebd312c-d187-418b-b06c-2c0a84e7be2b', 'Díaz',      'Camila',  '30666777', '27306667778', 'cantinero@test.com',  'cantinero'),
  ('711748ed-5c4a-4d51-b765-956467fd1342', 'Torres',    'Julián',  '30777888', '20307778889', 'cliente@test.com',    'cliente_registrado');

-- Cliente de prueba en estado 'pendiente' para probar el listado del
-- punto 6 mientras el alta de cliente registrado (punto 5) no exista.
update usuarios set estado_aprobacion = 'pendiente' where email = 'cliente@test.com';

-- =========================================================
-- 8. PRODUCTOS DE PRUEBA (5 platos + 5 bebidas)
-- =========================================================

insert into productos (nombre, descripcion, tipo, tiempo_elaboracion_minutos, precio, creado_por) values
  ('Milanesa napolitana', 'Milanesa de carne con salsa, jamón y muzzarella gratinada', 'plato', 25, 8500.00, '0ef1c165-5c3e-4154-b838-0cffea487630'),
  ('Ravioles de ricota',  'Ravioles caseros rellenos de ricota y espinaca con salsa a elección', 'plato', 20, 7200.00, '0ef1c165-5c3e-4154-b838-0cffea487630'),
  ('Bife de chorizo',     'Bife de chorizo a la parrilla con guarnición', 'plato', 30, 12000.00, '0ef1c165-5c3e-4154-b838-0cffea487630'),
  ('Ensalada César',      'Lechuga, pollo grillado, crutones, parmesano y aderezo césar', 'plato', 15, 6300.00, '0ef1c165-5c3e-4154-b838-0cffea487630'),
  ('Salmón grillado',     'Filete de salmón grillado con puré de papas y vegetales salteados', 'plato', 22, 11500.00, '0ef1c165-5c3e-4154-b838-0cffea487630');

insert into productos (nombre, descripcion, tipo, tiempo_elaboracion_minutos, precio, creado_por) values
  ('Coca-Cola 500ml',      'Gaseosa línea Coca-Cola, botella 500ml', 'bebida', 2, 2200.00, '1ebd312c-d187-418b-b06c-2c0a84e7be2b'),
  ('Agua mineral 500ml',   'Agua mineral sin gas, botella 500ml', 'bebida', 2, 1800.00, '1ebd312c-d187-418b-b06c-2c0a84e7be2b'),
  ('Cerveza artesanal IPA','Pinta de cerveza artesanal estilo IPA', 'bebida', 3, 3500.00, '1ebd312c-d187-418b-b06c-2c0a84e7be2b'),
  ('Limonada casera',      'Limonada casera con menta y jengibre', 'bebida', 5, 2900.00, '1ebd312c-d187-418b-b06c-2c0a84e7be2b'),
  ('Copa de vino Malbec',  'Copa de vino tinto Malbec de la casa', 'bebida', 2, 4200.00, '1ebd312c-d187-418b-b06c-2c0a84e7be2b');

-- 3 fotos placeholder por producto (picsum.photos) - reemplazar por
-- URLs reales de Supabase Storage cuando estén disponibles.
insert into producto_fotos (producto_id, url, orden)
select p.id, 'https://picsum.photos/seed/' || p.id || '-' || s.orden || '/600/400', s.orden
from productos p
cross join generate_series(1, 3) as s(orden);

-- =========================================================
-- 9. MESAS DE PRUEBA (5 mesas)
-- qr_code: formato decidido por el equipo (16/09/2026, ver gap #17 en
-- AVANCES.md) - JSON discriminado por `tipo`, igual patrón que ya usa
-- QrAppService para el QR de ingreso: {"tipo":"mesa","numero":N}, con
-- `numero` (no `id`/uuid) para no tocar el tipado ya existente.
-- OJO: esto es el valor que la DB considera "correcto" para probar el
-- punto 10/11 - `mesa.service.ts` (punto 4) todavía no lo genera así
-- en runtime, sigue emitiendo `MESA-{numero}` en texto plano. Falta
-- coordinar esa actualización con quien tenga el punto 4.
-- =========================================================

insert into mesas (numero, cantidad_comensales, tipo, qr_code, creado_por) values
  (1, 2, 'estandar',           '{"tipo":"mesa","numero":1}', '3c6e305d-5593-4bde-a69a-7262e12e2611'),
  (2, 4, 'estandar',           '{"tipo":"mesa","numero":2}', '3c6e305d-5593-4bde-a69a-7262e12e2611'),
  (3, 4, 'vip',                '{"tipo":"mesa","numero":3}', '3c6e305d-5593-4bde-a69a-7262e12e2611'),
  (4, 6, 'estandar',           '{"tipo":"mesa","numero":4}', '3c6e305d-5593-4bde-a69a-7262e12e2611'),
  (5, 2, 'movilidad_reducida', '{"tipo":"mesa","numero":5}', '3c6e305d-5593-4bde-a69a-7262e12e2611');

  -- =========================================================
-- 10. STORAGE: bucket "fotos"
-- Punto "Preparación inicial" + puntos 1, 2, 3, 4, 5: fotos de
-- usuarios, productos y mesas. Bucket público (ver README: no hay
-- requisito de privacidad de datos en el enunciado, y evita la
-- complejidad de signed URLs para 5 puntos funcionales distintos).
-- =========================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'fotos',
  'fotos',
  true,
  5242880, -- 5MB
  array['image/jpeg', 'image/png', 'image/webp']
);

-- LECTURA: pública para todos (clientes anónimos ven fotos de productos
-- y mesas sin estar logueados como cliente_registrado)
create policy "storage_fotos_lectura_publica"
on storage.objects
for select
using ( bucket_id = 'fotos' );

-- INSERT: cada usuario sube únicamente su propia foto de perfil
create policy "storage_fotos_usuario_sube_propia"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'fotos'
  and (storage.foldername(name))[1] = 'usuarios'
  and (storage.foldername(name))[2] = auth.uid()::text
);

-- INSERT: cocinero sube fotos a la carpeta productos (sus platos/postres)
create policy "storage_fotos_cocinero_sube_productos"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'fotos'
  and (storage.foldername(name))[1] = 'productos'
  and perfil_actual() = 'cocinero'
);

-- INSERT: cantinero sube fotos a la carpeta productos (sus bebidas)
create policy "storage_fotos_cantinero_sube_productos"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'fotos'
  and (storage.foldername(name))[1] = 'productos'
  and perfil_actual() = 'cantinero'
);

-- INSERT: dueño/supervisor suben fotos de mesas
create policy "storage_fotos_dueño_supervisor_sube_mesas"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'fotos'
  and (storage.foldername(name))[1] = 'mesas'
  and perfil_actual() in ('dueño', 'supervisor')
);

-- UPDATE: mismo criterio que insert, para reemplazo de fotos
-- (puntos 2/3 piden "posibilidad de seleccionar otra imagen")
create policy "storage_fotos_usuario_actualiza_propia"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'fotos'
  and (storage.foldername(name))[1] = 'usuarios'
  and (storage.foldername(name))[2] = auth.uid()::text
);

-- UPDATE: cocinero reemplaza fotos en la carpeta productos (sus platos/postres)
create policy "storage_fotos_cocinero_actualiza_productos"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'fotos'
  and (storage.foldername(name))[1] = 'productos'
  and perfil_actual() = 'cocinero'
);

-- UPDATE: cantinero reemplaza fotos en la carpeta productos (sus bebidas)
create policy "storage_fotos_cantinero_actualiza_productos"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'fotos'
  and (storage.foldername(name))[1] = 'productos'
  and perfil_actual() = 'cantinero'
);

-- UPDATE: dueño/supervisor reemplazan fotos de mesas
create policy "storage_fotos_dueño_supervisor_actualiza_mesas"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'fotos'
  and (storage.foldername(name))[1] = 'mesas'
  and perfil_actual() in ('dueño', 'supervisor')
);

-- ============================================================
-- Punto 1: alta de empleado — dueño/supervisor suben la foto del
-- EMPLEADO NUEVO (carpeta ajena, no la propia).
-- Agregado 09/09/2026 — hueco detectado al diseñar el flujo del punto 1.
-- Sin esta policy, "storage_fotos_usuario_sube_propia" rechaza el
-- insert con 403: esa policy solo permite subir a la carpeta del
-- propio auth.uid(), y acá quien sube (el dueño) no es el dueño de la
-- carpeta de destino (la del empleado recién creado).
-- ============================================================
create policy "storage_fotos_dueño_supervisor_sube_usuarios"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'fotos'
  and (storage.foldername(name))[1] = 'usuarios'
  and perfil_actual() in ('dueño', 'supervisor')
);

-- ============================================================
-- Punto 5: autorregistro de cliente registrado
-- Agregado 03/09/2026 — hueco detectado en revisión de merge de `dev`.
-- Sin esta policy, ClienteService.registrarCliente() falla con 403:
-- no había ninguna policy de INSERT en `usuarios` para que un cliente
-- nuevo se dé de alta a sí mismo (solo existía la de dueño/supervisor
-- dando de alta empleados).
-- ============================================================
create policy "usuarios_cliente_se_autorregistra"
on usuarios
for insert
to authenticated
with check (
  auth.uid() = id
  and perfil = 'cliente_registrado'
  and estado_aprobacion = 'pendiente'
);
-- El with check fija perfil y estado_aprobacion para que un cliente
-- no pueda insertarse con otro perfil (ej. 'dueño') ni autoaprobarse
-- (ej. estado_aprobacion = 'aceptado') en el mismo insert.

-- ============================================================
-- Login / accesos rápidos (corrección profesor 13-09-2026)
-- Los botones de acceso rápido del login tienen que reflejar usuarios
-- reales (foto, nombre, perfil), no una lista hardcodeada. El login
-- todavía no tiene sesión, y las policies de SELECT sobre `usuarios`
-- exigen auth.uid() -> un cliente anónimo no puede leer la tabla
-- directamente. Esta vista bypassea esa RLS (corre con los permisos de
-- su dueño, no del rol que consulta) exponiendo solo las columnas que
-- hacen falta para el botón -- nunca dni/cuil. foto_url no es sensible:
-- el bucket `fotos` ya es público.
-- Un usuario representativo por perfil (el más antiguo), excluyendo
-- cliente_anonimo porque ese no requiere login.
-- ============================================================
create view public.accesos_rapidos as
select distinct on (perfil)
  perfil, nombres, apellidos, foto_url, email
from usuarios
where perfil <> 'cliente_anonimo'
order by perfil, created_at asc;

grant select on public.accesos_rapidos to anon;

-- ============================================================
-- Punto 12: pedido completo de la mesa
-- Agregado 14/09/2026.
-- El cliente (registrado o anónimo, con mesa asignada) arma un pedido
-- con productos para cada comensal; el mozo lo confirma. Cocina/cantina
-- (cuando existan sus pantallas, puntos siguientes) van a filtrar por
-- estado = 'confirmado' -- no hace falta ningún bloqueo extra acá para
-- cumplir "no derivar a los sectores hasta que el mozo confirme", alcanza
-- con que el pedido nazca en 'pendiente_confirmacion'.
--
-- ⚠️ Supuesto pendiente de confirmar con el equipo: las policies de abajo
-- exigen `to authenticated` (igual que productos/mesas), es decir que el
-- dispositivo del cliente ya tenga una sesión de Supabase Auth -- sea
-- cliente_registrado logueado, o cliente_anonimo vía signInAnonymously()
-- si el punto 9/10 termina resolviéndolo así. Hoy ese flujo anónimo
-- todavía no existe en el código (no encontré ningún signInAnonymously()
-- ni alta de fila en `usuarios` con perfil cliente_anonimo), así que por
-- ahora esto se puede probar de punta a punta logueado como
-- cliente@test.com (semilla ya cargada abajo) -- no bloqueé el punto 12
-- por esto, pero falta resolverlo junto con el punto 10.
-- ============================================================

create type estado_pedido as enum ('pendiente_confirmacion', 'confirmado');

create table pedidos (
  id uuid primary key default gen_random_uuid(),
  mesa_id uuid not null references mesas(id),
  estado estado_pedido not null default 'pendiente_confirmacion',
  -- Snapshot calculado por la app al armar el pedido (mismo criterio que
  -- pedido_items.precio_unitario): no se recalculan solos si cambia el
  -- precio o el tiempo de elaboración de un producto después.
  importe_total numeric(10,2) not null check (importe_total >= 0),
  -- Tiempo estimado = el MÁXIMO entre los productos pedidos, no la suma:
  -- cocina y cantina preparan en paralelo (ver PedidoService.crearPedido).
  tiempo_estimado_minutos integer not null check (tiempo_estimado_minutos > 0),
  creado_por uuid not null references usuarios(id),
  created_at timestamptz not null default now()
);

alter table pedidos enable row level security;

create table pedido_items (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references pedidos(id) on delete cascade,
  producto_id uuid not null references productos(id),
  -- Para qué comensal de la mesa es este ítem (punto 12: "elegir los
  -- productos... para todos los comensales"). No hay tabla de comensales
  -- aparte -- es un número de 1 a mesas.cantidad_comensales, validado en
  -- la app antes de insertar acá.
  comensal_numero integer not null check (comensal_numero > 0),
  cantidad integer not null check (cantidad > 0),
  precio_unitario numeric(10,2) not null check (precio_unitario >= 0)
);

alter table pedido_items enable row level security;

-- pedidos --------------------------------------------------------

create policy "pedidos_lectura_autenticados"
on pedidos
for select
to authenticated
using ( true );

-- INSERT: cualquier cliente (registrado o anónimo) crea un pedido para
-- una mesa ocupada. No verificamos acá que la mesa sea "la suya" -- esa
-- asociación depende de cómo termine resolviéndose el punto 10 (ver
-- aviso arriba); es una simplificación consciente para no bloquear este
-- punto.
create policy "pedidos_cliente_inserta"
on pedidos
for insert
to authenticated
with check (
  perfil_actual() in ('cliente_registrado', 'cliente_anonimo')
  and creado_por = auth.uid()
  and estado = 'pendiente_confirmacion'
  and exists (
    select 1 from mesas m
    where m.id = pedidos.mesa_id
    and m.disponibilidad = 'ocupada'
  )
);

-- UPDATE: solo el mozo, y solo pendiente -> confirmado (no puede
-- revertir un pedido confirmado ni saltar a otro estado).
create policy "pedidos_mozo_confirma"
on pedidos
for update
to authenticated
using ( perfil_actual() = 'mozo' and estado = 'pendiente_confirmacion' )
with check ( perfil_actual() = 'mozo' and estado = 'confirmado' );

-- pedido_items -----------------------------------------------------

create policy "pedido_items_lectura_autenticados"
on pedido_items
for select
to authenticated
using ( true );

create policy "pedido_items_cliente_inserta"
on pedido_items
for insert
to authenticated
with check (
  perfil_actual() in ('cliente_registrado', 'cliente_anonimo')
  and exists (
    select 1 from pedidos p
    where p.id = pedido_items.pedido_id
    and p.estado = 'pendiente_confirmacion'
    and p.creado_por = auth.uid()
  )
);

-- ============================================================
-- Punto 12 (nuevo enfoque, 2026): lock de "quién está armando el
-- pedido" de una mesa. Corrido en el SQL Editor -- no había quedado
-- documentado acá, se agrega ahora para que el archivo refleje lo que
-- de verdad está en la base.
--
-- Va por funciones SECURITY DEFINER en vez de un UPDATE directo +
-- policy: Supabase ya le da a "authenticated" un GRANT UPDATE amplio
-- sobre toda la tabla "mesas" por default, así que una policy nueva
-- acotada a estas dos columnas no hubiera evitado que cualquier cliente
-- reescriba numero/tipo/foto_url/qr_code de una mesa ocupada. La función
-- hace el UPDATE atómico (WHERE ... AND pedido_en_armado_por IS NULL)
-- para que dos comensales que aprietan "Crear pedido" al mismo tiempo no
-- se pisen el lock.
-- ============================================================

alter table mesas add column if not exists pedido_en_armado_por text;
alter table mesas add column if not exists pedido_en_armado_en timestamptz;

create or replace function tomar_pedido_en_curso(p_mesa_id uuid, p_nombre text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_filas integer;
begin
  if perfil_actual() not in ('cliente_registrado', 'cliente_anonimo') then
    raise exception 'No autorizado.';
  end if;

  update mesas
  set pedido_en_armado_por = p_nombre,
      pedido_en_armado_en = now()
  where id = p_mesa_id
    and disponibilidad = 'ocupada'
    and pedido_en_armado_por is null;

  get diagnostics v_filas = row_count;
  return v_filas > 0;
end;
$$;

create or replace function liberar_pedido_en_curso(p_mesa_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update mesas
  set pedido_en_armado_por = null,
      pedido_en_armado_en = null
  where id = p_mesa_id;
end;
$$;

grant execute on function tomar_pedido_en_curso(uuid, text) to authenticated;
grant execute on function liberar_pedido_en_curso(uuid) to authenticated;

-- Tiempo real (punto 12): para que el resto de los comensales vean en
-- vivo "[Nombre] está realizando el pedido" sin refrescar. Bloque
-- idempotente porque ya se corrió una vez -- "add table" solo, sin el
-- chequeo, tira error si la tabla ya es miembro de la publicación.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'mesas'
  ) then
    alter publication supabase_realtime add table mesas;
  end if;
end $$;

-- =========================================================
-- v4 (13/09/2026): Punto 9 — cliente anónimo + lista de espera.
-- Ver supabase/README.md para el detalle de decisiones.
-- =========================================================

-- El cliente anónimo (punto 9) solo carga nombre y foto, sin
-- apellido. La columna era NOT NULL desde el diseño original
-- (pensada para empleados/clientes registrados); se afloja acá.
alter table usuarios alter column apellidos drop not null;

-- =========================================================
-- Punto 9: lista de espera del cliente anónimo (y registrado,
-- cuando llega sin reserva). Separada de `usuarios` porque es un
-- estado transitorio ("estoy esperando mesa ahora"), no un dato
-- permanente del perfil.
-- =========================================================

create table lista_espera (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null unique references usuarios(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table lista_espera enable row level security;

-- El cliente (anónimo o registrado) se anota a sí mismo.
create policy "lista_espera_cliente_se_anota"
on lista_espera
for insert
to authenticated
with check ( auth.uid() = cliente_id );

-- El cliente ve su propia fila (para saber que sigue en la lista).
create policy "lista_espera_cliente_ve_su_fila"
on lista_espera
for select
to authenticated
using ( auth.uid() = cliente_id );

-- El cliente puede sacarse a sí mismo de la lista.
create policy "lista_espera_cliente_se_retira"
on lista_espera
for delete
to authenticated
using ( auth.uid() = cliente_id );

-- El metre/dueño/supervisor ven y gestionan toda la lista (punto 10).
create policy "lista_espera_metre_ve_todo"
on lista_espera
for select
to authenticated
using ( perfil_actual() in ('metre', 'dueño', 'supervisor') );

create policy "lista_espera_metre_elimina"
on lista_espera
for delete
to authenticated
using ( perfil_actual() in ('metre', 'dueño', 'supervisor') );

-- =========================================================
-- v5 (14/09/2026): política de INSERT faltante para cliente
-- anónimo. Se detectó al probar el punto 9: `clientes_se_
-- autorregistran` exige perfil = 'cliente_registrado', así que
-- un insert con perfil = 'cliente_anonimo' no calzaba en ninguna
-- policy existente -> 403 (42501).
-- =========================================================

create policy "clientes_anonimos_se_autorregistran"
on usuarios
for insert
to authenticated
with check (
  auth.uid() = id
  and perfil = 'cliente_anonimo'
);

-- =========================================================
-- v6 (16/09/2026): vínculo cliente↔mesa asignada, punto 10 (metre
-- asigna mesa a cliente). Corrida y confirmada en el SQL Editor.
-- Se agrega a `mesas` en vez de crear una tabla nueva: es una
-- extensión natural del estado transitorio que ya representa
-- `disponibilidad` (vacia/ocupada), no un dato permanente. Ver
-- supabase/README.md para el detalle de la decisión.
-- =========================================================

alter table mesas add column cliente_actual_id uuid references usuarios(id) on delete set null;

-- Garantiza a nivel DB que un mismo cliente no puede estar vinculado a
-- dos mesas a la vez (punto 10: "verificar que el cliente no pueda
-- vincularse con otra mesa"). Parcial porque NULL (mesa vacía) es el
-- estado normal y no debe contar para la unicidad.
create unique index mesas_cliente_actual_unico
  on mesas (cliente_actual_id) where cliente_actual_id is not null;

-- UPDATE: el metre asigna una mesa a un cliente. El `using` exige que
-- la mesa esté 'vacia' en el momento del update -> si dos asignaciones
-- llegan casi al mismo tiempo sobre la misma mesa, la segunda encuentra
-- la fila ya en 'ocupada' y es rechazada por la policy. Cubre a nivel
-- DB el requisito del enunciado de "verificar que NO se le pueda
-- asignar dicha mesa a otro cliente". Convive con
-- "mesas_dueño_supervisor_actualiza" (dueño/supervisor siguen pudiendo
-- modificar disponibilidad sin esta restricción, ej. para liberar una
-- mesa manualmente).
create policy "mesas_metre_asigna"
on mesas
for update
to authenticated
using ( perfil_actual() = 'metre' and disponibilidad = 'vacia' )
with check ( perfil_actual() = 'metre' );

-- El metre puede leer `lista_espera` (policy `lista_espera_metre_ve_todo`,
-- ya existente desde el punto 9) pero no está incluido en
-- `dueño_supervisor_ven_todos_usuarios` (esa es solo dueño/supervisor) ->
-- sin esto, la vista del metre solo podía mostrar el `cliente_id` (UUID)
-- de cada fila de la cola, sin poder resolverlo a nombre/foto reales.
-- Policy acotada, no una ampliación de la existente: el metre solo ve las
-- filas de `usuarios` que corresponden a alguien que está ahora mismo en
-- `lista_espera`, no a cualquier empleado/cliente de la base.
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

-- =========================================================
-- v7 (2026): Punto 11 — "consulta al mozo". Chat simple entre el
-- cliente vinculado a una mesa (mesas.cliente_actual_id) y
-- cualquier mozo. Igual que lista_espera: tabla aparte, no una
-- columna en otra tabla, porque es su propio hilo de conversación.
--
-- remitente_perfil / remitente_nombre van desnormalizados en la fila
-- en vez de resolverse con un join a `usuarios` al leer: la RLS de
-- `usuarios` no deja que un cliente vea el perfil de un mozo (ni al
-- revés), así que un join se rompería. Se guardan una sola vez, al
-- insertar el mensaje.
-- =========================================================

create table mensajes_mozo (
  id uuid primary key default gen_random_uuid(),
  mesa_id uuid not null references mesas(id) on delete cascade,
  remitente_id uuid not null references usuarios(id) on delete cascade,
  remitente_perfil perfil_usuario not null,
  remitente_nombre text not null,
  texto text not null,
  created_at timestamptz not null default now()
);

alter table mensajes_mozo enable row level security;

-- El cliente vinculado a la mesa manda mensajes en su propio hilo.
create policy "mensajes_mozo_cliente_envia"
on mensajes_mozo
for insert
to authenticated
with check (
  auth.uid() = remitente_id
  and perfil_actual() in ('cliente_registrado', 'cliente_anonimo')
  and mesa_id in (select id from mesas where cliente_actual_id = auth.uid())
);

-- Cualquier mozo puede responder en cualquier mesa.
create policy "mensajes_mozo_mozo_envia"
on mensajes_mozo
for insert
to authenticated
with check ( auth.uid() = remitente_id and perfil_actual() = 'mozo' );

-- El cliente ve solo el hilo de su propia mesa.
create policy "mensajes_mozo_cliente_ve_su_mesa"
on mensajes_mozo
for select
to authenticated
using (
  perfil_actual() in ('cliente_registrado', 'cliente_anonimo')
  and mesa_id in (select id from mesas where cliente_actual_id = auth.uid())
);

-- Todos los mozos ven todos los hilos (para poder atender cualquiera).
create policy "mensajes_mozo_mozo_ve_todo"
on mensajes_mozo
for select
to authenticated
using ( perfil_actual() = 'mozo' );

-- Realtime: corrido en el SQL Editor el 25/09/2026 junto con la tabla.
alter publication supabase_realtime add table mensajes_mozo;


-- =========================================================
-- v8 (21/09/2026): Punto 13 — mozo rechaza el pedido.
--
-- Se agrega 'rechazado' al enum y se reemplaza la policy de UPDATE
-- del mozo para permitir esa transición además de 'confirmado'. El
-- pedido rechazado NO se borra (se conserva como registro); el
-- cliente ve el cambio de estado por Realtime (mismo canal que ya
-- usa para "confirmado") y vuelve a la pantalla de armado con el
-- carrito que ya tenía en memoria, para poder modificar/agregar/
-- quitar productos y reenviarlo (PedidoPage.suscribirConfirmacion).
--
-- OJO al correr esto en el SQL Editor: "alter type ... add value"
-- no puede ejecutarse en la misma transacción en la que ya se usa el
-- valor nuevo. Si tirás todo el bloque junto y da error de "unsafe
-- use of new value", corré primero sola la línea del alter type,
-- confirmá, y después el resto (drop/create policy).
-- =========================================================

alter type estado_pedido add value if not exists 'rechazado';

drop policy if exists "pedidos_mozo_confirma" on pedidos;

create policy "pedidos_mozo_confirma"
on pedidos
for update
to authenticated
using ( perfil_actual() = 'mozo' and estado = 'pendiente_confirmacion' )
with check ( perfil_actual() = 'mozo' and estado in ('confirmado', 'rechazado') );


-- =========================================================
-- v9 (27/09/2026): Punto 20 — encuesta de satisfacción.
--
-- "Una por estadía": el esquema no tenía el concepto de estadía, se
-- define como el período en que un cliente está vinculado a una mesa
-- (mesas.cliente_actual_id, punto 10). mesas.asignada_en marca cuándo
-- empezó; la completa un trigger (no el código del metre) así funciona
-- sin tocar MesaService.asignarCliente(). La encuesta guarda ese mismo
-- valor en estadia_inicio y el unique (cliente_id, estadia_inicio) es lo
-- que impide cargar una segunda encuesta en la misma visita. En la
-- próxima visita (nueva asignación) hay un asignada_en distinto.
--
-- OJO al correr esto en el SQL Editor: igual que en v8, el create type
-- conviene correrlo solo primero si da error de transacción.
-- =========================================================

alter table mesas add column if not exists asignada_en timestamptz;

create or replace function marcar_asignacion_mesa()
returns trigger
language plpgsql
as $$
begin
  if new.cliente_actual_id is distinct from old.cliente_actual_id then
    new.asignada_en := case when new.cliente_actual_id is null then null else now() end;
  end if;
  return new;
end;
$$;

drop trigger if exists mesas_marcar_asignacion on mesas;
create trigger mesas_marcar_asignacion
before update of cliente_actual_id on mesas
for each row execute function marcar_asignacion_mesa();

-- Mesas que ya estaban asignadas antes de este cambio: sin esto quedarían
-- con asignada_en NULL y su cliente no podría completar la encuesta.
update mesas set asignada_en = now()
where cliente_actual_id is not null and asignada_en is null;

create type atencion_mozo as enum ('excelente', 'buena', 'regular', 'mala');

create table encuestas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references usuarios(id) on delete cascade,
  mesa_id uuid not null references mesas(id) on delete cascade,
  estadia_inicio timestamptz not null,
  -- Cada pregunta se responde con un control distinto (requisito
  -- excluyente "variedad de controles"): estrellas, opciones, deslizador,
  -- casillas, interruptor y texto libre.
  calificacion_general smallint not null check (calificacion_general between 1 and 5),
  atencion_mozo atencion_mozo not null,
  limpieza smallint not null check (limpieza between 1 and 10),
  aspectos_destacados text[] not null check (
    cardinality(aspectos_destacados) >= 1
    and aspectos_destacados <@ array['comida', 'bebida', 'atencion', 'ambiente', 'precio']
  ),
  recomendaria boolean not null,
  comentario text not null check (char_length(btrim(comentario)) between 10 and 300),
  created_at timestamptz not null default now(),
  unique (cliente_id, estadia_inicio)
);

alter table encuestas enable row level security;

-- INSERT: solo el cliente vinculado ahora a esa mesa, y solo para la
-- estadía en curso (estadia_inicio tiene que coincidir con asignada_en).
-- Así no puede cargar una encuesta para una mesa ajena ni "inventar" otra
-- estadía para saltearse el unique.
create policy "encuestas_cliente_inserta"
on encuestas
for insert
to authenticated
with check (
  auth.uid() = cliente_id
  and perfil_actual() in ('cliente_registrado', 'cliente_anonimo')
  and exists (
    select 1 from mesas m
    where m.id = encuestas.mesa_id
    and m.cliente_actual_id = auth.uid()
    and m.asignada_en = encuestas.estadia_inicio
  )
);

-- El cliente ve las suyas (para saber si ya respondió en esta estadía).
create policy "encuestas_cliente_ve_las_suyas"
on encuestas
for select
to authenticated
using ( auth.uid() = cliente_id );

create policy "encuestas_dueño_supervisor_ven_todas"
on encuestas
for select
to authenticated
using ( perfil_actual() in ('dueño', 'supervisor') );

-- Resultados para los gráficos: solo totales, nunca filas sueltas (no
-- expone quién respondió ni los comentarios). Security definer para que
-- la pueda llamar cualquiera, incluido el rol anon: el QR de ingreso al
-- local muestra los resultados antes de que el cliente se registre
-- (punto 9) y al salir, ya sin mesa (punto 22).
create or replace function resultados_encuestas()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'total', (select count(*) from encuestas),
    'promedio_por_dia', (
      select coalesce(json_agg(json_build_object('dia', dia, 'promedio', promedio) order by dia), '[]'::json)
      from (
        select (created_at at time zone 'America/Argentina/Buenos_Aires')::date as dia,
               round(avg(calificacion_general), 2) as promedio
        from encuestas
        group by 1
      ) t
    ),
    'atencion_mozo', (
      select coalesce(json_object_agg(atencion_mozo, cantidad), '{}'::json)
      from (select atencion_mozo, count(*) as cantidad from encuestas group by 1) t
    ),
    'limpieza', (
      select coalesce(json_object_agg(limpieza, cantidad), '{}'::json)
      from (select limpieza, count(*) as cantidad from encuestas group by 1) t
    ),
    'aspectos_destacados', (
      select coalesce(json_object_agg(aspecto, cantidad), '{}'::json)
      from (select unnest(aspectos_destacados) as aspecto, count(*) as cantidad from encuestas group by 1) t
    ),
    'recomendaria', json_build_object(
      'si', (select count(*) from encuestas where recomendaria),
      'no', (select count(*) from encuestas where not recomendaria)
    )
  );
$$;

grant execute on function resultados_encuestas() to anon, authenticated;

-- Datos simulados de cuatro semanas ("Preparación inicial": simular
-- encuestas y estadías de al menos cuatro semanas). Tres encuestas por
-- día a nombre del cliente de prueba, repartidas entre las 5 mesas;
-- cada una con su propia estadia_inicio para respetar el unique. setseed
-- para que los valores salgan iguales cada vez que se recrea la base.
select setseed(0.2026);

insert into encuestas (
  cliente_id, mesa_id, estadia_inicio, calificacion_general, atencion_mozo,
  limpieza, aspectos_destacados, recomendaria, comentario, created_at
)
select
  '711748ed-5c4a-4d51-b765-956467fd1342',
  (select id from mesas where numero = (s.n % 5) + 1),
  s.momento - interval '1 hour',
  s.calificacion,
  (array['mala', 'regular', 'buena', 'excelente']::atencion_mozo[])[least(4, greatest(1, s.calificacion - 1))],
  least(10, greatest(1, s.calificacion * 2 - (random() * 2)::int)),
  (select array_agg(a) from unnest(array['comida', 'bebida', 'atencion', 'ambiente', 'precio']) a
    where random() < 0.45 or a = (array['comida', 'ambiente', 'atencion'])[(s.n % 3) + 1]),
  s.calificacion >= 3,
  (array[
    'Muy rica la comida y la atención fue excelente.',
    'Lindo lugar, aunque la comida tardó un poco.',
    'Volvería sin dudas, el ambiente es muy agradable.',
    'Precios razonables para la calidad que ofrecen.',
    'La mesa estaba un poco sucia cuando llegamos.'
  ])[(s.n % 5) + 1],
  s.momento
from (
  select row_number() over () as n,
         date_trunc('day', now()) - (d || ' days')::interval + ((12 + h * 4) || ' hours')::interval as momento,
         -- Calificación sesgada hacia 4 y 5, con alguna mala cada tanto.
         -- Va en el select list (no en un join aparte) para que random()
         -- se evalúe una vez por fila y no una sola vez para todas.
         (array[2, 3, 4, 4, 5, 5, 5, 4, 3, 5])[1 + floor(random() * 10)::int] as calificacion
  from generate_series(1, 28) as d
  cross join generate_series(0, 2) as h
) s;

-- v10 (27/09/2026): Puntos 18 y 19 — estado por sector + entrega.
-- Corrido y confirmado en el SQL Editor.
--
-- Decisión de equipo (27/09, con Cicchelli, puntos 16/17): el avance
-- de cada sector se guarda en dos booleanos de `pedidos`
-- (cocina_lista, bar_listo), no en filas por sector. El punto 19
-- separa "el mozo entrega" de "el cliente confirma la recepción",
-- así que suma un tercer booleano (entregado_por_mozo): el mozo lo
-- marca al entregar y recién ahí el cliente puede pasar el pedido
-- a 'entregado'.
--
-- Nadie hace UPDATE directo sobre estas columnas ni sobre el estado:
-- todo va por funciones SECURITY DEFINER (mismo patrón que
-- tomar_pedido_en_curso), que validan el perfil adentro.
--
-- Flujo de estado: pendiente_confirmacion -> confirmado -> completo
--                  -> entregado (y rechazado, desde v8).
--
-- Cocina = todo producto que no sea bebida (decisión 13/09: postre
-- cuenta como plato; el valor 'postre' existe en el enum pero no se
-- usa). Bar = tipo 'bebida'.
--
-- OJO al correr esto en el SQL Editor: cada "alter type ... add
-- value" va solo y confirmado antes de usar el valor nuevo (mismo
-- error de "unsafe use of new value" que en v8).
-- =========================================================

alter table pedidos add column cocina_lista boolean not null default false;
alter table pedidos add column bar_listo boolean not null default false;
alter table pedidos add column entregado_por_mozo boolean not null default false;

alter type estado_pedido add value if not exists 'completo';
alter type estado_pedido add value if not exists 'entregado';

-- Cocinero/cantinero avisan que terminaron su parte. Si con eso todos
-- los sectores intervinientes quedaron listos, el pedido pasa a
-- 'completo'. Va en la misma función, sin trigger aparte.
create or replace function marcar_sector_listo(p_pedido_id uuid, p_sector text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_interviene_cocina boolean;
  v_interviene_bar boolean;
  v_cocina_lista boolean;
  v_bar_listo boolean;
begin
  if p_sector = 'cocina' then
    if perfil_actual() <> 'cocinero' then
      raise exception 'No autorizado.';
    end if;
    update pedidos set cocina_lista = true where id = p_pedido_id;
  elsif p_sector = 'bar' then
    if perfil_actual() <> 'cantinero' then
      raise exception 'No autorizado.';
    end if;
    update pedidos set bar_listo = true where id = p_pedido_id;
  else
    raise exception 'Sector inválido: %', p_sector;
  end if;

  select exists (
    select 1 from pedido_items pi join productos p on p.id = pi.producto_id
    where pi.pedido_id = p_pedido_id and p.tipo <> 'bebida'
  ) into v_interviene_cocina;

  select exists (
    select 1 from pedido_items pi join productos p on p.id = pi.producto_id
    where pi.pedido_id = p_pedido_id and p.tipo = 'bebida'
  ) into v_interviene_bar;

  select cocina_lista, bar_listo into v_cocina_lista, v_bar_listo
  from pedidos where id = p_pedido_id;

  if (not v_interviene_cocina or v_cocina_lista)
     and (not v_interviene_bar or v_bar_listo) then
    update pedidos set estado = 'completo'
    where id = p_pedido_id and estado = 'confirmado';
  end if;
end;
$$;

-- Punto 19, acción del mozo: solo marca que entregó físicamente.
create or replace function marcar_entregado_mozo(p_pedido_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if perfil_actual() <> 'mozo' then
    raise exception 'No autorizado.';
  end if;

  update pedidos set entregado_por_mozo = true
  where id = p_pedido_id and estado = 'completo';
end;
$$;

-- Punto 19, acción del cliente: confirma la recepción y pasa el pedido
-- a 'entregado'. Exige que el mozo ya haya marcado la entrega.
create or replace function confirmar_recepcion_cliente(p_pedido_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if perfil_actual() not in ('cliente_registrado', 'cliente_anonimo') then
    raise exception 'No autorizado.';
  end if;

  update pedidos set estado = 'entregado'
  where id = p_pedido_id
    and estado = 'completo'
    and entregado_por_mozo = true
    and creado_por = auth.uid();
end;
$$;

grant execute on function marcar_sector_listo(uuid, text) to authenticated;
grant execute on function marcar_entregado_mozo(uuid) to authenticated;
grant execute on function confirmar_recepcion_cliente(uuid) to authenticated;

-- Realtime en `pedidos`: no estaba en la publicación, y sin eso los
-- avisos de confirmado/rechazado/completo/entregado no disparan
-- (la suscripción conecta sin error pero el callback nunca corre).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'pedidos'
  ) then
    alter publication supabase_realtime add table pedidos;
  end if;
end $$;


-- =========================================================
-- v11 (30/09/2026): puntos 18/19 — marcar_entregado_mozo y
-- confirmar_recepcion_cliente fallaban en silencio cuando el UPDATE no
-- afectaba ninguna fila (perfil correcto pero condición no cumplida:
-- pedido que no está 'completo', mozo que todavía no entregó, o cliente
-- que no es el creador). El front no se enteraba -- el botón "no hacía
-- nada", sin mensaje ni vibración, contra la regla de diseno-visual.md
-- de que toda acción da feedback.
--
-- Se agrega `if not found then raise exception` después de cada UPDATE.
-- No cambia la firma (sigue devolviendo void): alcanza con
-- create or replace, sin drop function ni volver a correr los grant
-- execute. El servicio Angular ya convierte cualquier error de la
-- función en un mensaje visible (con vibración), así que no hace falta
-- tocar el front. Corrida y confirmada en el SQL Editor (30/09/2026).
--
-- OJO doble toque en marcar_entregado_mozo: la condición sigue siendo
-- solo `estado = 'completo'`, no `entregado_por_mozo = false` -- marcar
-- "entregado" dos veces no tira error a propósito (poner el booleano en
-- true de nuevo es inofensivo). El raise cubre los tres casos reales de
-- "no se pudo": pedido que no está completo, cliente que no es el
-- creador, o cliente que confirma antes de que el mozo entregue.
-- =========================================================

create or replace function marcar_entregado_mozo(p_pedido_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if perfil_actual() <> 'mozo' then
    raise exception 'No autorizado.';
  end if;

  update pedidos set entregado_por_mozo = true
  where id = p_pedido_id and estado = 'completo';

  if not found then
    raise exception 'El pedido no está listo para entregar.';
  end if;
end;
$$;

create or replace function confirmar_recepcion_cliente(p_pedido_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if perfil_actual() not in ('cliente_registrado', 'cliente_anonimo') then
    raise exception 'No autorizado.';
  end if;

  update pedidos set estado = 'entregado'
  where id = p_pedido_id
    and estado = 'completo'
    and entregado_por_mozo = true
    and creado_por = auth.uid();

  if not found then
    raise exception 'Todavía no se puede confirmar la recepción de este pedido.';
  end if;
end;
$$;



-- =========================================================
-- v14 (02/10/2026): Punto 21 — la cuenta: propina por QR, detalle y
-- pago simulado.
--
-- Una cuenta por estadía, con la misma definición que la encuesta (v13):
-- la asignación actual del cliente a la mesa (mesas.asignada_en).
--
-- Nadie hace INSERT/UPDATE directo sobre `cuentas`: todo va por
-- funciones SECURITY DEFINER (mismo patrón que los juegos, v11), y los
-- importes los calcula la base a partir de pedido_items -- el celular
-- nunca manda un total.
--
-- Pedidos que entran: los de la mesa desde asignada_en en estado
-- confirmado, completo o entregado (mismo criterio que
-- validar_pedido_para_juego, v11). Rechazados y pendientes no.
--
-- Cálculo: subtotal - descuento de juegos = base; la propina es un
-- porcentaje de esa  a la cuenta final");
-- total = base + pro
--
-- Descuento: se lee  descuento_juegos():
-- esa función solo ado, y en una mesa el
-- pedido lo puede ha() sobre los pedidos
de
-- la estadía mantieno".
--
-- OJO al correr estoe type conviene
-- correrlos solos pr).
-- =============================

create type estado_cu'pagada',
'confirmada');
create type metodo_paa', 'debito',
'credito');

create table cuentas
  id uuid primary key
  mesa_id uuid not nuelete cascade,
  cliente_id uuid not) on delete cascade,
  estadia_inicio time
  estado estado_cuentda',
  -- Todo lo de abajocliente escanea el QRde
  -- propina: "no se antes seleccionar el
  -- porcentaje de pr
  propina_porcentaje entaje in (0, 5, 10,
15, 20)),
  subtotal numeric(10
  descuento_porcentajporcentaje in (0, 10,
15, 20)),
  descuento_importe no_importe >= 0),
  propina_importe numporte >= 0),
  total numeric(10,2)
  metodo_pago metodo_pago,
  solicitada_en times),
  pagada_en timestamptz,
  confirmada_en times
  unique (mesa_id, es
);

alter table cuentas e

create policy "cuentas_cliente_ve_la_suya"
on cuentas for select
to authenticated
using ( cliente_id =

-- El mozo la necesitunto 22); dueño y
-- supervisor reciben el aviso de pago. También habilita que les
lleguen
-- los eventos de Reas policies).
create policy "cuenta
on cuentas for select
to authenticated
using ( perfil_actual() in ('mozo', 'dueño', 'supervisor') );

-- Punto 21: "el cliente solicita la cuenta al mozo". Se habilita
recién
-- con un pedido entre: si ya la había
pedido
-- en esta estadía, d
create or replace fun
returns cuentas
language plpgsql
security definer
set search_path = pub
as $$
declare
  v_mesa mesas;
  v_cuenta cuentas;
begin
  -- coalesce: sin se, y "NULL not in
(...)"
  -- no es true -- el
  if coalesce(perfil_'cliente_registrado',
'cliente_anonimo') th
    raise exception 'uede pedir la
cuenta.';
  end if;

  select * into v_mesctual_id = auth.uid();
  if not found or v_mesa.asignada_en is null then
    raise exception ';
  end if;

  if not exists (
    select 1 from ped
    where mesa_id = v
      and created_at
      and estado = 'e
  ) then
    raise exception 'cuando hayas recibido
tu pedido.';
  end if;

  insert into cuentasia_inicio)
  values (v_mesa.id, en)
  on conflict (mesa_ig;

  select * into v_cue
  from cuentas
  where mesa_id = v_mesa.id and estadia_inicio = v_mesa.asignada_en;

  return v_cuenta;
end;
$$;

-- Al escanear el QR s importes. Se puede
-- volver a escanear s no se haya pagado.
create or replace function aplicar_propina(p_porcentaje int)
returns cuentas
language plpgsql
security definer
set search_path = pub
as $$
declare
  v_cuenta cuentas;
  v_subtotal numeric(10,2);
  v_descuento int;
  v_descuento_importe numeric(10,2);
  v_propina_importe n
begin
  if p_porcentaje is (0, 5, 10, 15, 20)
then
    raise exception 'un porcentaje depropina válido.';
  end if;

  select c.* into v_c
  from cuentas c
  join mesas m on m.i_en = c.estadia_inicio
  where m.cliente_act
  for update of c;

  if not found then
    raise exception 'Primero tenés que pedir la cuenta.';
  end if;
  if v_cuenta.estado
    raise exception '
  end if;

  select coalesce(sum(pi.cantidad * pi.precio_unitario), 0) into
v_subtotal
  from pedido_items pi
  join pedidos p on p
  where p.mesa_id = v
    and p.created_at
    and p.estado in (ntregado');

  select coalesce(max(ji.porcentaje_obtenido), 0) into v_descuento
  from juegos_intento
  join pedidos p on p
  where p.mesa_id = v
    and p.created_at

  v_descuento_importe := round(v_subtotal * v_descuento / 100.0, 2);
  v_propina_importe :uento_importe) *p_porcentaje / 100.0, 2);

  update cuentas
  set propina_porcent
      subtotal = v_su
      descuento_porce
      descuento_impor
      propina_importe
      total = v_subtov_propina_importe
  where id = v_cuenta
  returning * into v_

  return v_cuenta;
end;
$$;

-- Pago simulado. Desirmación del mozo
-- (punto 22). p_metodo como text y no como el enum: así el mensaje de
-- error de un valor inválido es el nuestro, en español.
create or replace funtext)
returns cuentas
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cuenta cuentas;
begin
  if p_metodo is null_en_cuenta', 'debito',
'credito') then
    raise exception 'o.';
  end if;

  select c.* into v_cuenta
  from cuentas c
  join mesas m on m.i_en = c.estadia_inicio
  where m.cliente_act
  for update of c;

  if not found then
    raise exception 'uenta.';
  end if;
  if v_cuenta.estado
    raise exception 'La cuenta ya fue pagada.';
  end if;
  if v_cuenta.propina
    raise exception 'ina antes de pagar.';
  end if;

  update cuentas
  set estado = 'pagad
      metodo_pago = p
      pagada_en = now
  where id = v_cuenta.id
  returning * into v_

  return v_cuenta;
end;
$$;

-- Supabase da EXECUTiones nuevas, y
-- "revoke from publio que en v12).
revoke execute on funm public, anon;
revoke execute on funrom public, anon;
revoke execute on function pagar_cuenta(text) from public, anon;
grant execute on funcuthenticated;
grant execute on function aplicar_propina(int) to authenticated;
grant execute on funcuthenticated;

-- Realtime: aviso alzo/dueño/supervisor
-- (cuenta pagada). I con `mesas`.
do $$
begin
  if not exists (
    select 1 from pg_
    where pubname = 'aname = 'public' and
tablename = 'cuentas'
  ) then
    alter publication cuentas;
  end if;
end $$;