# Plataforma de Asignaturas del Seminario

Aplicación web académica para el Seminario Teológico Bautista de Cuba Oriental. Incluye gestión de estudiantes, asignaturas, matrículas, módulos, evaluaciones, calificaciones, progreso, anuncios y foro de dudas.

## Arquitectura actual

```
Navegador
  index.html · css/app.css · js/app.js
  js/config.js · js/api.js
          │ HTTPS + token de sesión
          ▼
Supabase Edge Function: canvas-api
          │ service role (solo en servidor)
          ▼
Supabase Postgres
  app_users · subjects · enrollments · modules
  exams · questions · exam_attempts · progress
  announcements · chat_messages · canvas_sessions
```

La aplicación ya no utiliza Google Apps Script ni Google Sheets. El navegador solo contiene la clave pública de Supabase; la clave de servicio permanece en el entorno privado de la Edge Function.

## Proyecto conectado

- Proyecto Supabase: `Canvas-STBCOr`
- Región: `us-east-2`
- Función: `/functions/v1/canvas-api`
- Configuración del frontend: `js/config.js`

No publiques claves de servicio, contraseñas ni tokens de sesión.

## Base de datos

Las migraciones SQL se encuentran en `supabase/migrations/`:

1. `20261121160000_initial_schema.sql`: tablas académicas y relaciones.
2. `20261121173000_secure_sessions_and_auth.sql`: sesiones y autenticación segura.
3. `20261121180000_add_chat_messages.sql`: mensajes persistentes del foro.

Las tablas tienen RLS habilitado y no conceden acceso directo a los roles públicos. Las operaciones pasan por la Edge Function, que valida la sesión y los permisos de cada rol.

## Autenticación y permisos

- **Estudiantes**: usuario y contraseña; solo consultan las asignaturas en las que están matriculados.
- **Profesores**: cuentas creadas desde Dirección; administran las asignaturas que tienen asignadas.
- **Rectoría, Decanato y Secretaría**: acceso de dirección para administrar la plataforma.

Las contraseñas se almacenan como hashes PBKDF2-SHA-256 con salt individual. El frontend no guarda las contraseñas; utiliza tokens de sesión con vencimiento. Las respuestas de los exámenes no revelan la opción correcta antes de la entrega.

Para crear profesores, entra con una cuenta de dirección y usa **Añadir profesor** o la asignación de profesor al crear una asignatura. La plataforma genera credenciales nuevas para cada cuenta.

## Datos iniciales

El proyecto se preparó para comenzar sin asignaturas de prueba. El padrón inicial contiene 72 estudiantes: 71 activos y 1 inactivo. Las asignaturas, matrículas, módulos, exámenes, preguntas, intentos, progreso, anuncios y mensajes comienzan vacíos.

Para actualizar o volver a importar el padrón, entra como dirección, abre **Estudiantes (base) → Importar lista** y pega el contenido del archivo CSV local que conservas. El servidor vuelve a generar los hashes de las contraseñas; no guardes el CSV ni sus contraseñas en el repositorio público.

## Desarrollo local

Puedes servir el repositorio con cualquier servidor estático, por ejemplo:

```bash
python3 -m http.server 8000
```

Abre `http://localhost:8000`. La configuración de Supabase está en `js/config.js`. No uses una copia antigua del archivo de datos de demostración.

## Estructura relevante

```
index.html
css/app.css
js/config.js
js/api.js
js/app.js
supabase/
  functions/canvas-api/index.ts
  migrations/
.gitignore
```

## Seguridad operativa

- No subas archivos con contraseñas ni claves de personal.
- No expongas `SUPABASE_SERVICE_ROLE_KEY` en JavaScript del navegador.
- Mantén las credenciales de los estudiantes bajo control y rótalas antes de abrir el acceso general si pudieron aparecer en versiones públicas anteriores del repositorio.
- Revisa los permisos al crear nuevas acciones en la Edge Function.
