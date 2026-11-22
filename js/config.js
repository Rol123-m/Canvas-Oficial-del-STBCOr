/* ============================================================
   CONFIG.JS · Plataforma de Asignaturas del Seminario
   Editar este archivo para personalizar la aplicación.
   No hace falta tocar app.js.
   ============================================================ */
window.CONFIG = {
  app: 'STBCOr Gestión de Aulas',
  school: 'Seminario Teológico Bautista de Cuba Oriental',
  course: '2026–2027',
  logo: 'assets/logo.png',

  /* ---- Conexión con Supabase ---- */
  api: 'https://rkeplircgzzaqmpnfrbd.supabase.co/functions/v1/canvas-api',
  supabaseKey: 'sb_publishable_xjvD6DZ4KkluYDmD-NTIGQ_NxZC7tGL',

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
