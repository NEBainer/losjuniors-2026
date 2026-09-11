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
| **Ezequiel Bainer** | `Bainer` | 28/08/2026 – En progreso | <details><summary>Ver detalle</summary><ul><li>Creación y administración del repositorio GitHub.</li><li>Organización general del proyecto.</li><li>Actualización y mantenimiento del README.</li><li>Investigación inicial de Ionic.</li><li>Investigación inicial de Android Studio.</li><li>Investigación inicial de Capacitor.</li><li>Alta de mesa (punto 4): formulario con foto por cámara y generación de QR.</li><li>Listado y gestión de mesas (punto 4): alternar disponibilidad, refresco automático de la lista al volver del alta, guard de ruta por perfil (dueño/supervisor).</li><li>Validaciones del formulario de alta de mesa: mensajes de error visibles por campo, foto obligatoria, bloqueo de notación no numérica (<code>e</code>/<code>+</code>/<code>-</code>) en los campos de número y comensales.</li></ul></details> |
| **Maximiliano Arcieri** | `Arcieri` | 28/08/2026 – En progreso | <details><summary>Ver detalle</summary><ul><li>Configuración inicial de Supabase.</li><li>Diseño de entidades.</li><li>Creación del esquema inicial de base de datos.</li><li>Implementación de autenticación.</li><li>Configuración de políticas RLS.</li><li>Pantalla de dueño/supervisor con listado de clientes pendientes y botones aceptar/rechazar (integrada con las políticas RLS).</li><li>Filtrado del panel de control por perfil (dueño/supervisor ven clientes pendientes; cocinero/cantinero ven solo la card de lista de pedidos).</li><li>Base de datos para alta de empleados (punto 1): índices únicos parciales de DNI/CUIL/email y policy de Storage para que dueño/supervisor suban la foto de un empleado nuevo.</li></ul></details> |
| **Noelia Storgato** | `Storgato` | 28/08/2026 – En progreso | <details><summary>Ver detalle</summary><ul><li>Formulario de Login.</li><li>Pantalla de accesos rápidos.</li><li>Implementación de Logout.</li><li>Guards de ruta por perfil.</li><li>Creación del proyecto Ionic.</li><li>Flujo de cliente registrado: pantalla de alta, estado "pendiente" y notificación visual del cambio de estado.</li><li>Migración de las pantallas de registro a Signals para reflejar los datos de Supabase sin depender de zone.js.</li></ul></details> |
| **Lucía Cicchelli** | `Cicchelli` | 28/08/2026 – En progreso | <details><summary>Ver detalle</summary><ul><li>Diseño del ícono de la aplicación.</li><li>Desarrollo de la pantalla de inicio (Splash Screen) estática y animada para el sistema "LA MESA".</li><li>Maquetación modular utilizando Angular y SCSS con paleta cromática temática.</li><li>Implementación de animaciones CSS3 mediante <code>@keyframes</code>, <code>clip-path</code>, efecto de estampado y entradas escalonadas de elementos visuales.</li><li>Botón para omitir la animación.</li><li>Adaptación responsive para distintos dispositivos.</li><li>Compatibilidad con <code>prefers-reduced-motion</code>.</li><li>Implementación de las pantallas de alta de plato y bebida (puntos 2 y 3), reutilizando el patrón de formulario del equipo — en su rama, todavía sin integrar a <code>dev</code>.</li></ul></details> |

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
| Alta de empleados desde la app (punto 1: falta la Edge Function y la pantalla) | 🔄 |
| Alta de plato y bebida (puntos 2 y 3) | 🔄 |
| Formato del contenido del QR como deep link (mesas, ingreso al local, propinas) | ⏳ A definir en equipo |

---

## Capturas e Imágenes

<details>
<summary><b>Ver capturas del proyecto</b></summary>

<br>

<table>
<tr>
<td align="center" width="50%">
<b>Ícono de la aplicación</b><br><br>
<img src="image-2.png" alt="Ícono de la aplicación" width="160">
</td>
<td align="center" width="50%">
<b>Splash Screen (modo claro)</b><br><br>
<img src="captura-splash.jpg" alt="Splash Screen en modo claro, fondo crema" width="220">
</td>
</tr>
</table>

<table>
<tr>
<td align="center" width="50%">
<b>Login</b><br><br>
<img src="captura-login.jpg" alt="Pantalla de Login" width="220">
</td>
<td align="center" width="50%">
<b>Registro de cliente</b><br><br>
<img src="captura-registro-cliente.jpg" alt="Registro de cliente" width="220">
</td>
</tr>
<tr>
<td align="center">
<b>Panel de Control — Dueño</b><br><br>
<img src="captura-panel-dueno.jpg" alt="Panel de Control, perfil dueño" width="220">
</td>
<td align="center">
<b>Panel de Control — Cocinero</b><br><br>
<img src="captura-panel-cocinero.jpg" alt="Panel de Control, perfil cocinero" width="220">
<br><sub>Mismo panel, filtrado por perfil: sin la card de Gestión de Mesas.</sub>
</td>
</tr>
<tr>
<td align="center">
<b>Gestión de Mesas (listado)</b><br><br>
<img src="captura-gestion-mesas.jpg" alt="Listado de gestión de mesas" width="220">
</td>
<td align="center">
<b>Acceso restringido por URL</b><br><br>
<img src="captura-guard-mesas.jpg" alt="Guard de ruta bloqueando Gestión de Mesas a un perfil sin permiso" width="220">
<br><sub>Cocinero intentando entrar a /mesas escribiendo la URL a mano.</sub>
</td>
</tr>
<tr>
<td align="center">
<b>Alta de Mesa</b><br><br>
<img src="captura-alta-mesa.jpg" alt="Formulario de alta de mesa" width="220">
</td>
<td align="center">
<b>Alta de Mesa — validación</b><br><br>
<img src="captura-alta-mesa-validacion.jpg" alt="Formulario de alta de mesa mostrando errores de validación por campo" width="220">
<br><sub>Envío con campos vacíos: error por campo + foto obligatoria.</sub>
</td>
</tr>
<tr>
<td align="center" colspan="2">
<b>Clientes Pendientes</b><br><br>
<img src="captura-clientes-pendientes.jpg" alt="Listado de clientes pendientes de aprobación" width="320">
</td>
</tr>
</table>

</details>

---

## Base de Datos

La documentación de la base de datos se encuentra en [`/supabase/README.md`](./supabase/README.md).

Incluye:

- Diseño de entidades.
- Esquema SQL inicial.
- Configuración de autenticación.
- Políticas RLS.
- Datos de prueba.
</content>
