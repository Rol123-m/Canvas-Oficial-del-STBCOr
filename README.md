# Plataforma de Asignaturas del Seminario

Aplicación web estilo **Canvas/moodle ligero** para el seminario, basada en el modelo de la página de griego: cada asignatura se abre con sus **módulos (pestañas)**, **exámenes tipo quiz**, **anuncios**, **progreso** y un **foro de dudas en vivo** que el profesor abre o cierra.

- **Estudiantes**: entran con su usuario y contraseña; ven **solo las asignaturas en las que están matriculados**, sus anuncios y su progreso.
- **Profesores**: cuenta creada por la dirección (usuario + contraseña); gestionan **únicamente su asignatura** con total libertad (módulos, exámenes, anuncios, matrícula, foro).
- **Dirección (rector · decano · secretaría)**: entra con su clave; **ve y modifica todo**. Crea asignaturas, **asigna profesores, genera sus credenciales y se las entrega**, matricula grupos completos y administra la base de datos.

## Arquitectura

```
[ Navegador ]
   index.html · css/app.css · js/app.js
   js/config.js  ← configuración y URL de la API
        │  fetch (JSON)
        ▼
[ Google Apps Script ]  code.gs  ← TODO el servidor, un solo archivo
        │
        ▼
[ Google Sheets ]  (una hoja por tabla: Estudiantes, Profesores,
                    Asignaturas, Matriculas, Pestanas, Examenes,
                    Preguntas, Intentos, Progreso, Anuncios, Chat)
```

Mientras `api` esté vacío en `js/config.js`, la app funciona en **MODO DEMO** (datos en el navegador), útil para probar sin servidor.

## Despliegue con Google Sheets + Apps Script

1. **Base de datos**: crea una hoja de cálculo nueva en Google Drive (el nombre da igual).
2. **Servidor**: en la hoja → *Extensiones → Apps Script*. Borra lo que haya y pega **todo el contenido de `code.gs`**.
3. **Instalar**: en el editor, ejecuta una vez la función **`setup`** (elige `setup` y pulsa ▶). Autoriza los permisos cuando los pida. Esto crea todas las tablas.
4. **Publicar la API**: *Implementar → Nueva implementación → tipo: Aplicación web*
   - *Ejecutar como*: **Yo**
   - *Quién puede acceder*: **Cualquier persona**
   - Copia la URL que termina en **`/exec`**.
5. **Conectar el frontal**: abre `js/config.js` y pega esa URL en `api: ''`.
6. **Publicar la app**: sube la carpeta a GitHub y activa **GitHub Pages** (o usa Netlify/Vercel). Los profesores y estudiantes entran por esa URL.

> Si prefieres usar una hoja de cálculo que ya tienes, abre Apps Script → *Configuración del proyecto → Propiedades del script* y añade `BD_ID` con el ID de esa hoja (el que aparece en la URL entre `/d/` y `/edit`).

## Cargar la base de estudiantes (72)

Tres opciones, en orden de comodidad:

1. **Desde la app** (recomendado): entra como dirección → *Estudiantes (base) → Importar lista (pegar)* y pega el contenido de `estudiantes.csv` (o copia y pega desde tu Google Sheet; acepta comas, punto y coma y tabulaciones).
2. **Archivo**: importa `estudiantes.csv` en la hoja **Estudiantes** de la base de datos (Archivo → Importar → Reemplazar datos desde la fila 2).
3. **Copiar y pegar** las columnas en la hoja: `Nombre | Grupo | Usuario | Contraseña | Estado`.

## Primer uso (flujo completo)

1. **Dirección entra** (pestaña *Dirección*, clave `rector-kmczyts`, `decano-sw7gfv3` o `secretaria-kmp9fke` — cámbialas en `code.gs` y en `js/config.js`).
2. **Crea la asignatura**: botón *Nueva asignatura* → nombre, color, y en el mismo formulario:
   - **Profesor**: elige uno existente o «Nuevo profesor…» (se generan automáticamente su **usuario y contraseña**; si indicas su correo, además **se le envían por email**).
   - **Matricular grupos**: marca uno o varios grupos (1.er año, 2.º año…) y quedarán matriculados al crear.
   - Al guardar aparece el **recuadro de credenciales** con botones *Copiar credenciales* y *Copiar mensaje de bienvenida* para enviárselas al profesor.
3. **El profesor entra** (pestaña *Profesor*) y monta su asignatura: *Módulos* (lecturas, vocabulario, recursos, enlaces), *Exámenes* (quizzes con corrección automática), *Anuncios*, matrícula individual o por grupo, y **Ajustes**.
4. **Foro de dudas**: en la asignatura, el profesor pulsa **«Abrir el foro»**; a partir de ese momento los estudiantes matriculados pueden escribir y todo se actualiza **en vivo** (cada 4 s, configurable en `js/config.js`). El profesor puede cerrarlo cuando quiera y eliminar mensajes.
5. **Los estudiantes entran** con su usuario/contraseña, ven sus asignaturas matriculadas y los anuncios; al tocar una asignatura acceden a su panel con módulos, quizzes, anuncios, foro y su progreso.

## Personalización (sin tocar la lógica)

Todo en `js/config.js`:

| Campo | Qué hace |
| --- | --- |
| `app`, `school`, `course`, `logo` | Nombres y logo de la cabecera |
| `api` | URL del Web App de Apps Script |
| `claves` | Claves de rectoría/decanato/secretaría (modo demo; en servidor van en `code.gs`) |
| `foro.intervaloMs` | Frecuencia de actualización del foro (2000–10000) |
| `colores` | Paleta sugerida al crear asignaturas |
| `tema` | Colores generales (mismos que la página de griego) |

Tipos de módulo disponibles: **Lectura** (texto con títulos y listas), **Vocabulario** (término | significado | dato), **Recursos** (título | descripción | url | botón) y **Enlace**.

## Seguridad y repo

- **`.gitignore` excluye `code.gs`**: el código del servidor (con las claves de la dirección) **nunca se sube al repositorio**; vive solo en Google Apps Script.
- Las contraseñas de estudiantes y profesores se guardan en la hoja (visibles para la dirección desde *Estudiantes (base)*). Es una solución deliberadamente simple para el seminario; la dirección puede regenerar la clave de cualquier profesor con un clic.
- La API valida en **cada acción** quién eres y sobre qué asignatura tienes permiso: un profesor no puede tocar la asignatura de otro y un estudiante solo escribe en el foro de la suya, y solo si está abierto.

## Pruebas sin servidor (modo demo)

Abre `index.html` con un servidor local (`python3 -m http.server`) o sube a GitHub Pages con `api` vacío:

- Estudiante: `jose.aguilera` / `rk7bmsqr`
- Profesor: `eliud.griego` / `griego2026`
- Dirección: `rector-kmczyts`

Botón *Restablecer datos de prueba* para volver al estado inicial.

## Archivos

```
index.html            Página única de la aplicación
css/app.css           Estilos (tema de la página de griego)
js/config.js          Configuración editable
js/demo-data.js       Base de los 72 estudiantes + asignatura modelo (demo)
js/api.js             Capa API: demo (localStorage) o Apps Script
js/app.js             Interfaz y lógica de las tres vistas
code.gs               SERVIDOR completo (no se sube al repo)
estudiantes.csv       Base de estudiantes lista para importar
.gitignore            Excluye code.gs del repositorio
```
