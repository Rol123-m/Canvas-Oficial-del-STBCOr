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
     2) Extensiones → Apps Script y pega TODO el contenido de code.gs.
     3) Ejecuta una vez la función setup (autoriza los permisos).
     4) Implementar → Nueva implementación → Aplicación web
        · Ejecutar como: Yo
        · Quién puede acceder: Cualquier persona
     5) Copia la URL que termina en /exec y pégala aquí abajo.
     Mientras `api` quede vacío, la app funciona en MODO DEMO (datos locales). */
  api: 'https://script.google.com/macros/s/AKfycbzR8zwtAG7IixofncUKo_2kdLFAS047XHGk7qUrIouqJDaU6abVwyfuu3Ld_RHTz565ZA/exec',
  // api: 'https://script.google.com/macros/s/AKfycb…/exec',

  /* ---- Claves del personal de dirección (acceso a TODOS los grupos) ----
     Deben coincidir con las escritas en code.gs (constante CLAVES).
     Solo sirven para entrar como rectoría / decanato / secretaría. */
  claves: {
    rector: 'rector-kmczyts',
    decano: 'decano-sw7gfv3',
    secretaria: 'secretaria-kmp9fke'
  },

  /* ---- Foro de dudas (chat por asignatura) ----
     El profesor abre o cierra el foro de cada asignatura.
     intervaloMs: frecuencia de actualización en vivo (2000–10000). */
  foro: { intervaloMs: 4000 },

  /* ---- Paleta para los banners de asignaturas nuevas ---- */
  colores: ['#14385c', '#3f7d58', '#8a2f3c', '#5b3a7e', '#1f6f7a', '#94631f', '#42566b', '#7a3b1f'],

  /* ---- Tema visual (personalizable) ----
     Mismos colores que la página de griego. Cambia y recarga. */
  tema: {
    navy: '#14385c', navyD: '#0d2742', navyL: '#e8eef6',
    gold: '#b8892e', green: '#3f7d58', flame: '#c2462f', bg: '#f3f6fa'
  }
};
