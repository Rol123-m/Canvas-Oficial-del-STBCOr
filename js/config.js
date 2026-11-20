/* ============================================================
   CONFIG.JS · Plataforma de Asignaturas del Seminario
   Editar este archivo para personalizar la aplicación.
   No hace falta tocar app.js.
   ============================================================ */
window.CONFIG = {
  app: 'Plataforma del Seminario',
  school: 'Seminario Teológico Bautista de Cuba Oriental',
  course: '2026–2027',
  logo: 'assets/logo.png',

  /* ---- Conexión con la base de datos (Google Sheets + Apps Script) ----
     1) Crea una hoja de cálculo nueva en Google Drive.
     2) Extensiones → Apps Script y pega TODO el contenido de apps-script/code.gs.
     3) Ejecuta una vez la función setup (autoriza los permisos).
     4) Implementar → Nueva implementación → Aplicación web
        · Ejecutar como: Yo
        · Quién puede acceder: Cualquier persona
     5) Copia la URL que termina en /exec y pégala aquí abajo.
     Mientras `api` quede vacío, la app funciona en MODO DEMO (datos locales). */
  api: '',
  // api: 'https://script.google.com/macros/s/AKfycbxk2F9G2ZGQerPfS9Z7AB3orqMcdt6Aro9XA8EnkrwjvaqF5_n4MCvngUUI1duTR9uPuA/exec',

  /* ---- Claves del personal de dirección (acceso a TODOS los grupos) ---- */
  claves: {
    rector: 'rector-kmczyts',
    decano: 'decano-sw7gfv3',
    secretaria: 'secretaria-kmp9fke'
  },

  /* ---- Códigos de los profesores ----
     Cada profesor ve SOLO las asignaturas que él crea.
     Añade más líneas para más profesores. */
  profesores: [
    { codigo: 'profesor-seminario', nombre: 'Profesor' }
    // { codigo: 'profesor-mateo', nombre: 'Prof. Mateo' },
  ],

  /* ---- Tema visual (personalizable) ----
     Mismos colores que la página de griego. Cambia y recarga. */
  tema: {
    navy: '#14385c', navyD: '#0d2742', navyL: '#e8eef6',
    gold: '#b8892e', green: '#3f7d58', flame: '#c2462f', bg: '#f3f6fa'
  }
};
