-- =========================================================
-- ESQUEMA DE BASE DE DATOS - APP RESTAURANTE (TFI UTN)
-- v2 - Preparación inicial + políticas RLS (puntos 1, 2, 3, 4, 11)
-- Ver supabase/README.md para el detalle completo de decisiones,
-- pruebas realizadas y pendientes.
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

create index idx_usuarios_perfil on usuarios(perfil);

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
-- qr_code: valor placeholder, a definir con el equipo el formato final.
-- =========================================================

insert into mesas (numero, cantidad_comensales, tipo, qr_code, creado_por) values
  (1, 2, 'estandar',           'MESA-1', '3c6e305d-5593-4bde-a69a-7262e12e2611'),
  (2, 4, 'estandar',           'MESA-2', '3c6e305d-5593-4bde-a69a-7262e12e2611'),
  (3, 4, 'vip',                'MESA-3', '3c6e305d-5593-4bde-a69a-7262e12e2611'),
  (4, 6, 'estandar',           'MESA-4', '3c6e305d-5593-4bde-a69a-7262e12e2611'),
  (5, 2, 'movilidad_reducida', 'MESA-5', '3c6e305d-5593-4bde-a69a-7262e12e2611');