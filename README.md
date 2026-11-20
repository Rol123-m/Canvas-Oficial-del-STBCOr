# Plataforma del Seminario · Modelo de asignaturas

Aplicación web lista para montar **cualquier asignatura del seminario** siguiendo el
formato y diseño de la página de griego (misma paleta, tipografía y componentes).
El profesor crea módulos, matricula a grupos o alumnos, publica exámenes y anuncios,
y consulta el progreso. Rectoría, decanato y secretaría acceden a **todos los grupos**
con su código. La base de datos vive en **Google Sheets**, administrada por **un único
archivo `code.gs`** (Google Apps Script) conectado mediante `js/config.js`.

## Estructura

```
plataforma-seminario/
├── index.html              → página única (SPA)
├── css/app.css             → diseño (basado en la página de griego)
├── js/config.js            → PERSONALIZACIÓN: nombre, colores, claves y API
├── js/demo-data.js         → base de estudiantes (72) + asignatura de ejemplo
├── js/api.js               → capa de datos: demo local o Google Sheets
├── js/app.js               → lógica de la aplicación (roles, vistas, acciones)
├── apps-script/code.gs     → backend ÚNICO para Google Apps Script (NO subir al repo)
├── .gitignore              → excluye code.gs (contiene las claves)
├── vendor/                 → fuentes e iconos locales (sin conexión)
└── assets/                 → logo e iconos
```

## Arranque rápido (modo demo, sin servidor)

1. Sube la carpeta a cualquier alojamiento estático (GitHub Pages, Netlify…) o abre
   `index.html` con un servidor local.
2. Entra como estudiante: `jose.aguilera` / `rk7bmsqr` · como profesor:
   `profesor-seminario` · como dirección: `rector-kmczyts`.
3. Todo se guarda en el navegador (localStorage). Botón «Restablecer datos de prueba»
   en la pantalla de acceso.

Mientras `api` esté vacío en `js/config.js`, la app funciona en modo demo.

## Conectar la base de datos (Google Sheets + Apps Script)

1. Crea una **hoja de cálculo nueva** en Google Drive.
2. Menú **Extensiones → Apps Script**. Borra lo que haya y pega **todo el contenido**
   de `apps-script/code.gs`.
3. Pulsa **Ejecutar → función `setup`** y autoriza los permisos. Esto crea las 9 hojas
   (Estudiantes, Asignaturas, Matriculas, Pestanas, Examenes, Preguntas, Intentos,
   Progreso, Anuncios), **carga los 72 estudiantes** y una asignatura de ejemplo.
4. **Implementar → Nueva implementación → Aplicación web**, con:
   - *Ejecutar como*: **Yo**
   - *Quién puede acceder*: **Cualquier persona**
5. Copia la URL que termina en `/exec` y pégala en `js/config.js`:
   ```js
   api: 'https://script.google.com/macros/s/XXXX…/exec',
   ```
6. Vuelve a publicar la web (config.js actualizado). Listo: todo queda guardado en la
   hoja y compartido entre todos los dispositivos.

> Si más adelante cambias el código de `code.gs`, crea una **nueva implementación**
> (o «Gestionar implementaciones → editar → Nueva versión»).

## Roles y permisos

| Rol | Entra con | Ve |
|---|---|---|
| Estudiante | usuario + contraseña (hoja *Estudiantes*) | Sus asignaturas: módulos, quizzes, anuncios, su progreso |
| Profesor | código de `PROFESORES` (config.js / code.gs) | Solo sus asignaturas: todo el panel de gestión |
| Rector | `rector-kmczyts` | Todas las asignaturas y grupos + panel de dirección |
| Decano | `decano-sw7gfv3` | Todas las asignaturas y grupos + panel de dirección |
| Secretaría | `secretaria-kmp9fke` | Todas las asignaturas y grupos + panel de dirección |

Las claves están en **dos sitios** (deben coincidir): `js/config.js` (claves → para el
modo demo) y `apps-script/code.gs` (constantes `CLAVES` y `PROFESORES` → para el modo
Google Sheets). Cámbialas ahí cuando lo necesites.

### Qué puede hacer el personal
- **Asignaturas**: crear (nombre, descripción, color), editar, eliminar.
- **Módulos/pestañas**: 4 tipos — *Lectura* (texto con subtítulos y listas),
  *Vocabulario* (`término | significado | dato`, una por línea), *Recursos*
  (`título | descripción | url | texto del botón`) y *Enlace*. Ordenar, ocultar,
  editar, eliminar.
- **Matrícula**: añadir un **grupo completo**, alumnos individuales (buscador y
  casillas), quitar alumnos.
- **Base de estudiantes**: alta, edición, activar/desactivar y eliminar registros
  (también para el grupo nuevo del próximo curso).
- **Exámenes**: editor con preguntas de **selección múltiple** (4 opciones) y
  **verdadero/falso**, puntos por pregunta, respuesta correcta; resultados por
  estudiante y exportación CSV.
- **Anuncios**: publicar, fijar arriba, editar, eliminar.
- **Progreso**: matriz del grupo (módulos marcados + mejor nota de cada quiz + %)
  y exportación CSV.
- **Dirección**: estadísticas por grupo, listado de todas las asignaturas con su
  progreso medio y acceso directo a cada una.

El progreso se calcula así: módulos marcados como completados + quizzes realizados,
sobre el total de módulos y quizzes visibles.

## Personalización (js/config.js)

- `app`, `school`, `course` → nombres que se muestran en el acceso y la barra superior.
- `tema` → colores (los mismos de la página de griego por defecto).
- `PROFESORES` / `profesores` → códigos y nombres de cada profesor.
- `CLAVES` / `claves` → códigos de rector, decano y secretaría.

Para montar **otra asignatura**: entra con el código del profesor, crea la asignatura,
añade módulos y exámenes desde el propio panel. No hace falta tocar código.

## Seguridad y .gitignore

- El `.gitignore` excluye **`code.gs`** (y la carpeta `apps-script/`): ese archivo
  contiene las claves del personal y **no debe subirse** al repositorio.
  Consérvalo localmente o en un lugar privado; a Apps Script se pega a mano.
- Las contraseñas de estudiantes se guardan tal cual en la hoja (es el modelo
  solicitado): comparte la hoja solo con el personal autorizado.
- La app web de Apps Script debe publicarse como «Cualquier persona» para que el
  navegador pueda llamarla; las credenciales siguen validándose en cada acción.

## Notas técnicas

- Sin servidor propio: GitHub Pages (frontend) + Apps Script (API) + Sheets (BD).
- Las llamadas usan `fetch` con `Content-Type: text/plain` para evitar la petición
  previa CORS de Apps Script; la respuesta llega en JSON.
- Iconos y fuentes van en `vendor/` (Font Awesome local + Open Sans/Merriweather),
  igual que en la página de griego, así funciona sin conexión tras la primera carga.
- El diseño es responsive: en móvil el menú lateral pasa a una barra inferior y las
  tablas se desplazan horizontalmente.
