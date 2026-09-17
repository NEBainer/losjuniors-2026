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

-- Pendiente (fuera del alcance de esta tanda): activar Realtime para
-- esta tabla desde el dashboard (Database → Replication), igual que
-- se hizo con lista_espera.
