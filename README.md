<div align="center">

<img src="logo.la.mesa.png" alt="Logo LA MESA" width="130">

# LA MESA — Comanda QR

### Trabajo Final Integrador · Tecnicatura Universitaria en Programación · UTN

Aplicación móvil para la gestión integral de un restaurante mediante códigos QR.

![Ionic](https://img.shields.io/badge/Ionic-3880FF?style=for-the-badge&logo=ionic&logoColor=white)
![Angular](https://img.shields.io/badge/Angular-DD0031?style=for-the-badge&logo=angular&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Capacitor](https://img.shields.io/badge/Capacitor-119EFF?style=for-the-badge&logo=capacitor&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3FCF8E?style=for-the-badge&logo=supabase&logoColor=white)
![Android](https://img.shields.io/badge/Android-3DDC84?style=for-the-badge&logo=android&logoColor=white)
![Git](https://img.shields.io/badge/Git-F05032?style=for-the-badge&logo=git&logoColor=white)
![GitHub](https://img.shields.io/badge/GitHub-181717?style=for-the-badge&logo=github&logoColor=white)

</div>

---

## Índice

- [Descripción del Proyecto](#descripción-del-proyecto)
- [Integrantes](#integrantes)
- [Tecnologías Utilizadas](#tecnologías-utilizadas)
- [Organización del Equipo](#organización-del-equipo)
- [Estado Actual del Proyecto](#estado-actual-del-proyecto)
- [Capturas e Imágenes](#capturas-e-imágenes)
- [Base de Datos](#base-de-datos)

---

## Descripción del Proyecto

Aplicación móvil desarrollada como Trabajo Final Integrador de la Tecnicatura Universitaria en Programación de la UTN.

El sistema permitirá gestionar el funcionamiento de un restaurante mediante el uso de códigos QR, contemplando distintos perfiles de usuario:

| Perfil | Perfil | Perfil |
|---|---|---|
| Dueño | Metre | Cocinero |
| Supervisor | Mozo | Cantinero |
| Cliente | | |

---

## Integrantes

| Integrante |
|------------|
| Ezequiel Bainer |
| Maximiliano Arcieri |
| Noelia Storgato |
| Lucía Cicchelli |

---

## Tecnologías Utilizadas

<div align="center">

![Ionic](https://img.shields.io/badge/Ionic-3880FF?style=flat-square&logo=ionic&logoColor=white)
![Angular](https://img.shields.io/badge/Angular-DD0031?style=flat-square&logo=angular&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Capacitor](https://img.shields.io/badge/Capacitor-119EFF?style=flat-square&logo=capacitor&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3FCF8E?style=flat-square&logo=supabase&logoColor=white)
![Android Studio](https://img.shields.io/badge/Android_Studio-3DDC84?style=flat-square&logo=androidstudio&logoColor=white)
![Git](https://img.shields.io/badge/Git-F05032?style=flat-square&logo=git&logoColor=white)
![GitHub](https://img.shields.io/badge/GitHub-181717?style=flat-square&logo=github&logoColor=white)

</div>

---

## Organización del Equipo

### Estrategia de Ramas

| Rama | Uso |
|---|---|
| `main` | Rama estable. Solo recibe merges desde `dev` ya probados. |
| `dev` | Rama de integración. Ahí se mergean las ramas individuales para probar que todo funcione antes de pasar a `main`. |
| `Bainer`, `Arcieri`, `Storgato`, `Cicchelli` | Ramas personales de cada integrante para el desarrollo de sus módulos. |

### Integrantes y Módulos

| Integrante | Branch | Período | Módulos desarrollados |
|---|---|---|---|
| **Ezequiel Bainer** | `Bainer` | 28/08/2026 – En progreso | <details><summary>Ver detalle</summary><ul><li>Creación y administración del repositorio GitHub.</li><li>Organización general del proyecto.</li><li>Actualización y mantenimiento del README.</li><li>Investigación inicial de Ionic.</li><li>Investigación inicial de Android Studio.</li><li>Investigación inicial de Capacitor.</li><li>Alta de mesa (punto 4): formulario con foto por cámara y generación de QR.</li><li>Listado y gestión de mesas (punto 4): alternar disponibilidad, refresco automático de la lista al volver del alta, guard de ruta por perfil (dueño/supervisor).</li><li>Validaciones del formulario de alta de mesa: mensajes de error visibles por campo, foto obligatoria, bloqueo de notación no numérica (<code>e</code>/<code>+</code>/<code>-</code>) en los campos de número y comensales.</li><li>Correcciones de diseño de la preentrega del 13/09 en home, login, registro de cliente, alta de empleado, alta y gestión de mesas y carta.</li><li>Regeneración del ícono y del splash de la app a partir de los assets fuente.</li><li>Accesos rápidos del login traídos desde la base de datos (foto, perfil y nombre de cada usuario).</li><li>Consulta al mozo (punto 11): carta abierta desde el QR de mesa, chat en tiempo real entre cliente y mozos, y bandeja del mozo con las mesas que tienen consultas sin responder.</li><li>Validación de que el QR escaneado sea el de la mesa asignada al cliente (punto 10).</li><li>Notificaciones al dueño/supervisor por clientes pendientes, a los mozos por consultas nuevas y al cliente cuando el mozo le responde.</li><li>Botón para volver a ver el QR de una mesa ya creada.</li></ul></details> |
| **Maximiliano Arcieri** | `Arcieri` | 28/08/2026 – En progreso | <details><summary>Ver detalle</summary><ul><li>Configuración inicial de Supabase.</li><li>Diseño de entidades.</li><li>Creación del esquema inicial de base de datos.</li><li>Implementación de autenticación.</li><li>Configuración de políticas RLS.</li><li>Pantalla de dueño/supervisor con listado de clientes pendientes y botones aceptar/rechazar (integrada con las políticas RLS).</li><li>Filtrado del panel de control por perfil (dueño/supervisor ven clientes pendientes; cocinero/cantinero ven solo la card de lista de pedidos).</li><li>Base de datos para alta de empleados (punto 1): índices únicos parciales de DNI/CUIL/email y policy de Storage para que dueño/supervisor suban la foto de un empleado nuevo.</li><li>Alta de empleados (punto 1) completa: Edge Function <code>crear-empleado</code>, service, página de formulario, guard de ruta y card de acceso en el panel para dueño/supervisor.</li><li>Fix de compresión de foto: la imagen de la cámara superaba el límite de 5 MB del bucket <code>fotos</code> de Storage; se resolvió redimensionando/comprimiendo antes de subir (<code>imagen.util.ts</code>, pensado para reusarse en mesas y productos).</li><li>Integración final de <code>dev</code>: unificó los puntos 2/3 (alta de plato/bebida) de Cicchelli con el punto 1 (alta de empleado) propio.</li><li>Metre asigna mesa (punto 10): vínculo cliente–mesa en la base de datos, lista de espera del metre y anotación del cliente registrado.</li><li><code>NotificacionesService</code> con <code>@capacitor/local-notifications</code>: aviso al metre por clientes nuevos en la lista de espera y al cliente cuando se le asigna mesa.</li></ul></details> |
| **Noelia Storgato** | `Storgato` | 28/08/2026 – En progreso | <details><summary>Ver detalle</summary><ul><li>Formulario de Login.</li><li>Pantalla de accesos rápidos.</li><li>Implementación de Logout.</li><li>Guards de ruta por perfil.</li><li>Creación del proyecto Ionic.</li><li>Flujo de cliente registrado: pantalla de alta, estado "pendiente" y notificación visual del cambio de estado.</li><li>Migración de las pantallas de registro a Signals para reflejar los datos de Supabase sin depender de zone.js.</li><li>Mascotas ilustradas en las pantallas de Login y Registro de cliente.</li><li>Escaneo de DNI argentino (código PDF417 del dorso) con ML Kit para autocompletar nombre, apellido y DNI en el registro de cliente.</li><li>Envío automático de mails (Brevo) para los estados pendiente, aceptado y rechazado del cliente (puntos 5, 7 y 8), desde Edge Function.</li><li>Fix de seguridad: un cliente pendiente o rechazado no puede entrar al home.</li><li>Ingreso de cliente anónimo (punto 9): escaneo del QR de entrada, alta con nombre y foto, y lista de espera.</li><li>Unificación del CSS con variables compartidas y limpieza de colores hardcodeados en varias pantallas.</li></ul></details> |
| **Lucía Cicchelli** | `Cicchelli` | 28/08/2026 – En progreso | <details><summary>Ver detalle</summary><ul><li>Diseño del ícono de la aplicación.</li><li>Desarrollo de la pantalla de inicio (Splash Screen) estática y animada para el sistema "LA MESA".</li><li>Maquetación modular utilizando Angular y SCSS con paleta cromática temática.</li><li>Implementación de animaciones CSS3 mediante <code>@keyframes</code>, <code>clip-path</code>, efecto de estampado y entradas escalonadas de elementos visuales.</li><li>Botón para omitir la animación.</li><li>Adaptación responsive para distintos dispositivos.</li><li>Compatibilidad con <code>prefers-reduced-motion</code>.</li><li>Alta de plato y bebida (puntos 2 y 3), ya integrada a <code>dev</code>: formularios con foto, reutilizando el patrón de formulario del equipo.</li><li>Vista de la carta (punto 11): platos y bebidas con foto, precio, descripción y tiempo estimado.</li><li>Ajustes del splash: animación de 2 segundos fijos y líneas centradas.</li><li>Armado del pedido (punto 12): cantidades por producto, importe acumulado y tiempo estimado siempre visibles, envío al mozo y confirmación desde la lista de pedidos del mozo.</li><li>Rechazo de pedido por el mozo (punto 13): el cliente ve el aviso y puede revisar y reenviar el pedido.</li></ul></details> |

---

## Estado Actual del Proyecto

| Tarea | Estado |
|---|:---:|
| Repositorio GitHub creado | ✅ |
| Proyecto Ionic generado | ✅ |
| Configuración inicial de Supabase | ✅ |
| Diseño de entidades | ✅ |
| Esquema inicial de base de datos | ✅ |
| Configuración de autenticación | ✅ |
| Configuración de políticas RLS | ✅ |
| Diseño del ícono de la aplicación | ✅ |
| Diseño del splash screen estático | ✅ |
| Diseño del splash screen animado | ✅ |
| Login | ✅ |
| Accesos rápidos | ✅ |
| Logout | ✅ |
| Integración con Supabase | ✅ |
| Flujo de cliente registrado (alta, estado pendiente, notificación) | ✅ |
| Gestión de clientes pendientes (dueño/supervisor: aceptar/rechazar) | ✅ |
| Alta de mesa (punto 4: formulario, foto, QR) | ✅ |
| Listado y gestión de disponibilidad de mesas (punto 4) | ✅ |
| Base de datos lista para alta de empleados (punto 1: índices únicos + policy de Storage) | ✅ |
| Alta de empleados desde la app (punto 1: Edge Function + service + pantalla + guard) | ✅ |
| Alta de plato y bebida (puntos 2 y 3), integrada a `dev` | ✅ |
| Vista de la carta para el cliente (punto 11: platos, bebidas, foto, precio, tiempo) | ✅ |
| Mascotas en Login/Registro + escaneo de DNI (PDF417) con ML Kit | ✅ |
| Fix de compresión de fotos antes de subir a Storage (bug de tamaño máximo) | ✅ |
| Mails automáticos de estado del cliente con Brevo (puntos 5, 7 y 8) | ✅ |
| Correcciones de diseño de la preentrega del 13/09 (puntos 1 a 8) | ✅ |
| Accesos rápidos traídos desde la base de datos | ✅ |
| Ingreso de cliente anónimo y lista de espera (punto 9) | ✅ |
| Metre asigna mesa y cliente escanea el QR de su mesa (punto 10) | ✅ |
| Carta desde el QR de mesa y consulta al mozo por chat (punto 11) | ✅ |
| Armado del pedido y confirmación del mozo (punto 12) | ✅ |
| Formato del contenido de los QR de mesa e ingreso al local | ✅ |
| Notificaciones con la app abierta | ✅ |
| Rechazo de pedido por el mozo (punto 13) | ✅ |
| Notificaciones push con la app cerrada | ⏳ |
| QR de propina (punto 21) | ⏳ |

---

## Capturas e Imágenes

| Sección | Puntos |
|---|:---:|
| [Identidad visual y splash](#identidad) | — |
| [Altas](#altas) | 1 a 4 |
| [Acceso, registro y mails de estado](#acceso) | 5 a 8 |
| [Paneles de control por perfil](#paneles) | — |
| [Carta, consultas y pedido](#salon) | 11 a 13 |

<a id="identidad"></a>

<details>
<summary><b>Identidad visual y splash</b></summary>

<br>

<table>
<tr>
<td align="center" width="33%" valign="top">
<b>Ícono de la aplicación</b><br><br>
<img src="capturas/icono.png" alt="Ícono de la aplicación" width="200">
</td>
<td align="center" width="33%" valign="top">
<b>Splash estático</b><br><br>
<img src="capturas/splash-estatico.jpg" alt="Splash screen estático: logo sobre fondo crema" width="200"><br><sub>Lo primero que se ve al abrir la app.</sub>
</td>
<td align="center" width="33%" valign="top">
<b>Splash animado</b><br><br>
<img src="capturas/splash-animado.gif" alt="Arranque de la app: splash estático y después el animado" width="200"><br><sub>Grabado en el celular: splash estático y después el animado.</sub>
</td>
</tr>
<tr>
<td align="center" width="33%" valign="top">
<b>Splash con integrantes</b><br><br>
<img src="capturas/splash-animado.jpg" alt="Splash con el nombre del grupo y los integrantes" width="200"><br><sub>Nombre del grupo, integrantes y botón para saltar.</sub>
</td>
</tr>
</table>

</details>

<a id="altas"></a>

<details>
<summary><b>Altas (puntos 1 a 4)</b></summary>

<br>

<table>
<tr>
<td align="center" width="33%" valign="top">
<b>Alta de empleado</b><br><br>
<img src="capturas/alta-empleado.jpg" alt="Formulario de alta de empleado" width="200">
</td>
<td align="center" width="33%" valign="top">
<b>Alta de plato</b><br><br>
<img src="capturas/alta-plato.jpg" alt="Formulario de alta de plato con 3 fotos" width="200">
</td>
<td align="center" width="33%" valign="top">
<b>Alta de bebida</b><br><br>
<img src="capturas/alta-bebida.jpg" alt="Formulario de alta de bebida con 3 fotos" width="200">
</td>
</tr>
<tr>
<td align="center" width="33%" valign="top">
<b>Gestión de mesas</b><br><br>
<img src="capturas/gestion-mesas.jpg" alt="Listado de mesas con su estado" width="200">
</td>
<td align="center" width="33%" valign="top">
<b>Mesa creada</b><br><br>
<img src="capturas/alta-mesa-qr.jpg" alt="Confirmación de alta de mesa con su QR" width="200"><br><sub>QR generado automáticamente.</sub>
</td>
<td align="center" width="33%" valign="top">
<b>QR de una mesa</b><br><br>
<img src="capturas/mesa-qr.jpg" alt="QR de una mesa ya creada" width="200"><br><sub>Se puede volver a ver desde el listado.</sub>
</td>
</tr>
</table>

</details>

<a id="acceso"></a>

<details>
<summary><b>Acceso, registro y mails de estado (puntos 5 a 8)</b></summary>

<br>

<table>
<tr>
<td align="center" width="33%" valign="top">
<b>Login</b><br><br>
<img src="capturas/login.jpg" alt="Pantalla de login con accesos rápidos" width="200"><br><sub>Accesos rápidos traídos desde la base de datos.</sub>
</td>
<td align="center" width="33%" valign="top">
<b>Registro de cliente</b><br><br>
<img src="capturas/registro-cliente.jpg" alt="Formulario de registro de cliente" width="200"><br><sub>Con escaneo de DNI y foto.</sub>
</td>
<td align="center" width="33%" valign="top">
<b>Registro — validación</b><br><br>
<img src="capturas/registro-cliente-validacion.jpg" alt="Registro de cliente con error de validación" width="200"><br><sub>Envío con campos vacíos.</sub>
</td>
</tr>
<tr>
<td align="center" width="33%" valign="top">
<b>Registro pendiente</b><br><br>
<img src="capturas/registro-pendiente.jpg" alt="Pantalla de solicitud recibida" width="200"><br><sub>Estado intermedio mientras se aprueba.</sub>
</td>
</tr>
</table>

<table>
<tr>
<th colspan="3">Mails automáticos de estado (Brevo)</th>
</tr>
<tr>
<td align="center" width="33%" valign="top">
<b>Registro en revisión</b><br><br>
<img src="capturas/mail-revision.jpg" alt="Mail de registro recibido y en revisión" width="240"><br><sub>Llega apenas el cliente se registra (punto 5).</sub>
</td>
<td align="center" width="33%" valign="top">
<b>Registro aprobado</b><br><br>
<img src="capturas/mail-aprobado.jpg" alt="Mail de registro aprobado" width="240"><br><sub>Cuando el dueño o supervisor lo acepta (punto 7).</sub>
</td>
<td align="center" width="33%" valign="top">
<b>Registro rechazado</b><br><br>
<img src="capturas/mail-rechazado.jpg" alt="Mail de registro no aprobado" width="240"><br><sub>Cuando el dueño o supervisor lo rechaza (punto 8).</sub>
</td>
</tr>
</table>

</details>

<a id="paneles"></a>

<details>
<summary><b>Paneles de control por perfil</b></summary>

<br>

<table>
<tr>
<td align="center" width="33%" valign="top">
<b>Dueño / Supervisor</b><br><br>
<img src="capturas/panel-dueno.jpg" alt="Panel de control del dueño" width="200"><br><sub>Clientes pendientes integrados abajo.</sub>
</td>
<td align="center" width="33%" valign="top">
<b>Metre</b><br><br>
<img src="capturas/panel-metre.jpg" alt="Panel de control del metre" width="200">
</td>
<td align="center" width="33%" valign="top">
<b>Mozo</b><br><br>
<img src="capturas/panel-mozo.jpg" alt="Panel de control del mozo" width="200"><br><sub>Pedidos pendientes integrados abajo.</sub>
</td>
</tr>
<tr>
<td align="center" width="33%" valign="top">
<b>Cocinero</b><br><br>
<img src="capturas/panel-cocinero.jpg" alt="Panel de control del cocinero" width="200">
</td>
<td align="center" width="33%" valign="top">
<b>Cantinero</b><br><br>
<img src="capturas/panel-cantinero.jpg" alt="Panel de control del cantinero" width="200">
</td>
<td align="center" width="33%" valign="top">
<b>Cliente</b><br><br>
<img src="capturas/panel-cliente.jpg" alt="Panel de control del cliente con mesa asignada" width="200"><br><sub>Con la mesa ya asignada por el metre.</sub>
</td>
</tr>
<tr>
<td align="center" width="33%" valign="top">
<b>Acceso restringido por URL</b><br><br>
<img src="capturas/guard-mesas.jpg" alt="Guard de ruta bloqueando Gestión de Mesas" width="200"><br><sub>Perfil sin permiso entrando a /mesas a mano.</sub>
</td>
</tr>
</table>

</details>

<a id="salon"></a>

<details>
<summary><b>Carta, consultas y pedido (puntos 11 a 13)</b></summary>

<br>

<table>
<tr>
<td align="center" width="33%" valign="top">
<b>Carta</b><br><br>
<img src="capturas/carta.jpg" alt="Un producto de la carta a pantalla completa" width="200"><br><sub>Un producto por pantalla, swipe entre fotos.</sub>
</td>
<td align="center" width="33%" valign="top">
<b>Consulta al mozo — cliente</b><br><br>
<img src="capturas/consulta-mozo-vista-cliente.jpg" alt="Chat de consulta visto por el cliente" width="200">
</td>
<td align="center" width="33%" valign="top">
<b>Consulta al mozo — mozo</b><br><br>
<img src="capturas/consulta-mozo-vista-mozo.jpg" alt="Chat de consulta visto por el mozo" width="200">
</td>
</tr>
<tr>
<td align="center" width="33%" valign="top">
<b>Armado del pedido</b><br><br>
<img src="capturas/pedido.jpg" alt="Armado del pedido por comensal" width="200"><br><sub>Importe y tiempo estimado siempre visibles.</sub>
</td>
<td align="center" width="33%" valign="top">
<b>Esperando al mozo</b><br><br>
<img src="capturas/pedido-esperando.jpg" alt="Pedido esperando confirmación del mozo" width="200">
</td>
<td align="center" width="33%" valign="top">
<b>Pedido confirmado</b><br><br>
<img src="capturas/pedido-confirmado.jpg" alt="Pedido confirmado por el mozo" width="200">
</td>
</tr>
<tr>
<td align="center" width="33%" valign="top">
<b>Pedido rechazado</b><br><br>
<img src="capturas/pedido-rechazado.jpg" alt="Aviso de pedido rechazado por el mozo" width="200"><br><sub>El mozo lo rechaza y el cliente lo revisa (punto 13).</sub>
</td>
</tr>
</table>

</details>

---

## Base de Datos

La base corre en **Supabase** (PostgreSQL + Auth + Storage + Realtime). Todas las tablas tienen **RLS** activado: cada perfil solo puede leer y modificar lo que le corresponde.

| Tabla / objeto | Para qué se usa | Punto |
|---|---|:---:|
| `usuarios` | Perfil de cada persona (dueño, empleados, clientes), con su estado de aprobación | 1, 5–8 |
| `productos` | Platos y bebidas de la carta: precio, descripción y tiempo de elaboración | 2, 3 |
| `producto_fotos` | Las 3 fotos de cada producto | 2, 3 |
| `mesas` | Número, capacidad, tipo, disponibilidad, QR y cliente asignado | 4, 10 |
| `lista_espera` | Clientes esperando que el metre les asigne mesa | 9, 10 |
| `mensajes_mozo` | Chat entre el cliente de una mesa y los mozos | 11 |
| `pedidos` | Pedido de cada mesa, con importe, tiempo estimado y estado (pendiente / confirmado / rechazado) | 12, 13 |
| `pedido_items` | Productos de cada pedido, por comensal y cantidad | 12 |
| Vista `accesos_rapidos` | Un usuario por perfil para los botones de acceso rápido del login | Login |
| Bucket `fotos` (Storage) | Fotos de usuarios, productos y mesas | 1–5 |
| Edge Functions | `crear-empleado` (alta de empleados) y `enviar-correo-estado` (mails de aprobación con Brevo) | 1, 5–8 |

La documentación completa está en [`supabase/README.md`](./supabase/README.md): decisiones de diseño, políticas RLS de cada tabla, datos de prueba y bugs resueltos. El script para recrear la base está en [`supabase/schema.sql`](./supabase/schema.sql).

> **Importante para el equipo:** no hay migraciones automáticas. Cada cambio que se agrega a `schema.sql` hay que **correrlo a mano en el SQL Editor de Supabase** y anotarlo en `supabase/README.md`.
