/* ============================================================
   APP.JS · Plataforma de Asignaturas del Seminario
   Modelo basado en la página de griego (mismo diseño y patrones).
   Roles: estudiante · profesor · rector · decano · secretaria
   ============================================================ */
(() => {
'use strict';
const C = window.CONFIG, API = window.API;
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const fmtD = iso => { try { return new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' }); } catch { return ''; } };
const fmtDT = iso => { try { const d = new Date(iso); return d.toLocaleDateString('es', { day: 'numeric', month: 'short' }) + ' · ' + d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };
const inicial = n => (n || '?').trim().charAt(0).toUpperCase();

/* ---------- utilidades UI ---------- */
function toast(msg) {
  const t = document.createElement('div'); t.className = 'toast'; t.innerHTML = `<span>${esc(msg)}</span>`;
  $('#toasts').append(t); setTimeout(() => t.remove(), 3800);
}
function dialog(title, body) {
  const d = $('#dlg'); d.innerHTML = `<div class="dh"><h3>${title}</h3><button aria-label="Cerrar" id="dx">&times;</button></div><div class="db">${body}</div>`;
  $('#dx').onclick = () => d.close(); if (!d.open) d.showModal(); return d;
}
const ring = (p, cls = '') => `<div class="ring ${cls}" style="--p:${p}"><b>${p}%</b></div>`;
function download(name, text, type = 'text/csv') {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name;
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
const csv = rows => '\ufeff' + rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
const chk = (cond, html) => cond ? html : '';

/* ---------- estado ---------- */
const KEYS = 'seminario.sesion.v1', KEYSEEN = 'seminario.seen.v1';
let S = {
  sesion: null,
  asigs: [], asigId: null,
  pestanas: [], examenes: [], matriculados: [], anuncios: [], progreso: [],
  estudiantes: [], profesores: [], grupos: [], resumen: null,
  misNotas: [], resIntentos: [], editQs: [], editExam: null, resExamen: null, reviewAttempt: null, ultimo: null,
  anunciosTodas: [], chat: { abierto: false, mensajes: [] }, chatTimer: null
};
const rol = () => S.sesion?.rol;
const esEst = () => rol() === 'estudiante';
const esProf = () => rol() === 'profesor';
const esDir = () => ['rector', 'decano', 'secretaria'].includes(rol());
const esStaff = () => esProf() || esDir();
const labelRol = r => ({ estudiante: 'Estudiante', profesor: 'Profesor', rector: 'Rectoría', decano: 'Decanato', secretaria: 'Secretaría' }[r] || r);
const asig = () => S.asigs.find(a => a.id === S.asigId);
function sesionPublica() { const { rol: r, nombre, usuario, grupo } = S.sesion; return { rol: r, nombre, usuario, grupo }; }
const seen = () => { try { return JSON.parse(localStorage.getItem(KEYSEEN)) || []; } catch { return []; } };
const unseen = () => S.anuncios.filter(a => !seen().includes(a.id)).length;
const TIPOS = { contenido: ['Lectura', 'fa-book'], leccion: ['Lección', 'fa-graduation-cap'], vocabulario: ['Vocabulario', 'fa-book-open'], recursos: ['Recursos', 'fa-folder-open'], enlace: ['Enlace', 'fa-link'] };
const notaTxt = n => n ? `${n.puntaje}/${n.total} (${n.total ? Math.round(n.puntaje / n.total * 100) : 0}%)` : null;

/* progreso (espejo de la lógica del servidor) */
function progresoDe(usuario) {
  const p = S.pestanas.filter(x => x.visible !== false), x = S.examenes.filter(x => x.visible !== false);
  const pg = S.progreso.filter(y => y.usuario === usuario);
  const dP = new Set(pg.filter(y => y.tipo === 'pestaña' && y.completado).map(y => y.itemId));
  const dX = new Set(pg.filter(y => y.tipo === 'examen' && y.completado).map(y => y.itemId));
  const tot = p.length + x.length;
  const done = p.filter(y => dP.has(y.id)).length + x.filter(y => dX.has(y.id)).length;
  return { done, tot, pct: tot ? Math.round(done / tot * 100) : 0 };
}
const progresoMedio = () => {
  const l = S.matriculados.map(m => progresoDe(m.usuario).pct);
  return l.length ? Math.round(l.reduce((a, x) => a + x, 0) / l.length) : 0;
};

/* ---------- carga de datos ---------- */
async function loadAsigs() {
  S.asigs = await API.call('getAsignaturas', { sesion: sesionPublica() });
  if (!S.asigs.some(a => a.id === S.asigId)) S.asigId = S.asigs[0]?.id || null;
}
async function loadAsigData() {
  if (!S.asigId) { S.pestanas = S.examenes = S.matriculados = S.anuncios = S.progreso = []; return; }
  const st = esStaff();
  const [p, x, m, a, g] = await Promise.all([
    API.call('getPestanas', { asigId: S.asigId, todas: st }),
    API.call('getExamenes', { asigId: S.asigId, todas: st }),
    st ? API.call('getMatriculados', { asigId: S.asigId, auth: authCod() }) : Promise.resolve(S.matriculados || []),
    API.call('getAnuncios', { asigId: S.asigId }),
    esEst() ? API.call('getProgreso', { asigId: S.asigId, usuario: S.sesion.usuario }) : API.call('getProgreso', { asigId: S.asigId, auth: authCod() })
  ]);
  S.pestanas = p; S.examenes = x; S.matriculados = m; S.anuncios = a; S.progreso = g;
}
const authCod = () => esDir()
  ? { rol: 'dir' }
  : { rol: 'prof', usuario: S.sesion.usuario };
const sesionForo = () => sesionPublica();

/* ---------- login ---------- */
let loginModo = 'est';
function loginView() {
  const demo = API.demo;
  const campos = loginModo === 'dir'
    ? `<div class="fld"><label for="c">Clave de dirección</label><div class="in"><input id="c" type="password" required autocapitalize="none" placeholder="rector-… · decano-… · secretaria-…"></div></div>`
    : `<div class="fld"><label for="u">Usuario</label><div class="in"><input id="u" name="username" required autocapitalize="none" autocomplete="username"></div></div>
       <div class="fld"><label for="p">Contraseña</label><div class="in"><input id="p" name="password" type="password" required autocomplete="current-password"><button type="button" id="eye" aria-label="Mostrar contraseña"><i class="fas fa-eye"></i></button></div></div>`;
  return `<div class="login"><section class="hero"><img src="${C.logo}" alt="Logo del Seminario"><span class="pill">CURSO ${esc(C.course)}</span>
  <h1>${esc(C.app)}</h1><p class="sub">${esc(C.school)}. Asignaturas con módulos, evaluaciones, progreso, anuncios y foro de dudas, siguiendo el modelo de la página de griego.</p>
  <div class="feats"><div><i class="fas fa-layer-group"></i>Módulos y pestañas que el profesor crea y ordena</div>
  <div><i class="fas fa-clipboard-check"></i>Quizzes de selección múltiple corregidos al instante</div>
  <div><i class="fas fa-comments"></i>Foro de dudas en vivo que el profesor abre y cierra</div>
  <div><i class="fas fa-chart-line"></i>Progreso registrado por estudiante y por grupo</div>
  <div><i class="fas fa-users-gear"></i>La dirección crea asignaturas, asigna profesores y envía credenciales</div></div></section>
  <section class="formside"><div class="form"><h2>Iniciar sesión</h2><p class="s">Entra con tu cuenta del seminario.</p>
  <div class="tabs" style="margin-bottom:1.1rem"><button type="button" data-m="est" class="${loginModo === 'est' ? 'on' : ''}">Estudiante</button><button type="button" data-m="prof" class="${loginModo === 'prof' ? 'on' : ''}">Profesor</button><button type="button" data-m="dir" class="${loginModo === 'dir' ? 'on' : ''}">Dirección</button></div>
  <form id="lf" autocomplete="on">${campos}
    <div class="err" id="er" role="alert"></div>
    <button class="btn" type="submit">Entrar <i class="fas fa-arrow-right"></i></button></form>
  ${demo ? `<div class="hint"><b>Modo demo</b> (sin servidor). Prueba con: estudiante <code>jose.aguilera</code> / <code>rk7bmsqr</code> · profesor <code>eliud.griego</code> / <code>griego2026</code> · dirección <code>rector-kmczyts</code>.<br>
  Conecta Google Sheets en <code>js/config.js</code> (campo <code>api</code>). <button class="btn sec sm" id="rstd" style="margin-top:.5rem"><i class="fas fa-rotate-left"></i> Restablecer datos de prueba</button></div>` : ''}
  <p class="foot-note">¿Olvidaste tu contraseña? Consúltala con tu profesor o con la secretaría.<br>© ${esc(C.course)} · ${esc(C.school)}</p></div></section></div>`;
}
function bindLogin() {
  $$('.tabs [data-m]').forEach(b => b.onclick = () => { loginModo = b.dataset.m; boot(); });
  $('#eye') && ($('#eye').onclick = () => { const p = $('#p'); p.type = p.type === 'password' ? 'text' : 'password'; });
  $('#rstd') && ($('#rstd').onclick = () => { window.DemoAPI.reset(); localStorage.removeItem(KEYS); toast('Datos de prueba restablecidos.'); boot(); });
  $('#lf').onsubmit = async e => {
    e.preventDefault(); const er = $('#er'); er.textContent = ''; $('#lf .btn').disabled = true;
    try {
      if (loginModo === 'est') {
        const d = await API.call('login', { u: $('#u').value.trim(), p: $('#p').value });
        S.sesion = { rol: 'estudiante', nombre: d.nombre, grupo: d.grupo, usuario: d.usuario };
      } else if (loginModo === 'prof') {
        const d = await API.call('loginProfesor', { u: $('#u').value.trim(), p: $('#p').value });
        S.sesion = { rol: 'profesor', nombre: d.nombre, usuario: d.usuario };
      } else {
        const d = await API.call('loginStaff', { codigo: $('#c').value.trim() });
        S.sesion = { rol: d.rol, nombre: d.nombre, usuario: d.usuario || null };
      }
      localStorage.setItem(KEYS, JSON.stringify(S.sesion));
      S.asigId = null; await loadAsigs();
      location.hash = esDir() ? '#/direccion' : (esProf() ? '#/asignaturas' : '#/mis');
      route();
    } catch (ex) { er.textContent = ex.message; $('#lf .btn').disabled = false; }
  };
}
async function boot() {
  document.documentElement.style.setProperty('--navy', C.tema.navy);
  document.documentElement.style.setProperty('--navy-d', C.tema.navyD);
  document.documentElement.style.setProperty('--navy-l', C.tema.navyL);
  document.documentElement.style.setProperty('--gold', C.tema.gold);
  document.documentElement.style.setProperty('--green', C.tema.green);
  document.documentElement.style.setProperty('--flame', C.tema.flame);
  document.documentElement.style.setProperty('--bg', C.tema.bg);
  if (!S.sesion) { try { S.sesion = JSON.parse(localStorage.getItem(KEYS)); } catch { S.sesion = null; } }
  if (S.sesion && !API.hasSession) { S.sesion = null; localStorage.removeItem(KEYS); }
  if (!S.sesion) { $('#app').innerHTML = loginView(); bindLogin(); return; }
  try { await loadAsigs(); }
  catch (ex) { $('#app').innerHTML = `<div class="notice"><i class="fas fa-triangle-exclamation"></i> ${esc(ex.message)}</div>`; return; }
  shell();
  route();
}

/* ---------- shell ---------- */
const STAFF_NAV = [['resumen', 'fa-gauge-high', 'Resumen'], ['modulos', 'fa-layer-group', 'Módulos'], ['estudiantes', 'fa-user-graduate', 'Estudiantes'], ['examenes', 'fa-clipboard-check', 'Exámenes'], ['anuncios', 'fa-bullhorn', 'Anuncios'], ['foro', 'fa-comments', 'Foro'], ['progreso', 'fa-chart-line', 'Progreso'], ['ajustes', 'fa-gear', 'Ajustes']];
function navItems() {
  if (esEst()) return [['mis', 'fa-graduation-cap', 'Mis asignaturas'], ['modulos', 'fa-layer-group', 'Módulos'], ['examenes', 'fa-clipboard-check', 'Exámenes'], ['anuncios', 'fa-bullhorn', 'Anuncios'], ['foro', 'fa-comments', 'Foro'], ['progreso', 'fa-chart-line', 'Mi progreso']];
  return esDir() ? [['direccion', 'fa-sitemap', 'Dirección'], ['base', 'fa-users', 'Estudiantes (base)'], ...STAFF_NAV] : [['asignaturas', 'fa-graduation-cap', 'Mis asignaturas'], ...STAFF_NAV];
}
const navLink = n => `<a href="#/${n[0]}" data-r="${n[0]}"><i class="fas ${n[1]}"></i>${n[2]}${n[0] === 'anuncios' && unseen() > 0 ? `<em class="bdg">${unseen()}</em>` : ''}</a>`;
function shell() {
  const s = S.sesion;
  const sel = S.asigs.length ? `<select class="sel" id="asel" title="Cambiar asignatura">${S.asigs.map(a => `<option value="${a.id}"${a.id === S.asigId ? ' selected' : ''}>${esc(a.nombre)}</option>`).join('')}</select>` : '';
  const staffSide = esStaff();
  const modulos = S.pestanas.filter(p => p.visible !== false);
  $('#app').innerHTML = `<header class="top"><a class="brand" href="#/${staffSide ? 'resumen' : 'mis'}"><img src="${C.logo}" alt=""><span><b>${esc(C.app)}</b><small>${esc(C.school)}</small></span></a><span class="sp"></span>${sel}
    <div class="who"><span>${esc(s.nombre)}<small>${labelRol(s.rol)}${esEst() ? ' · ' + esc(s.grupo || '') : ''}</small></span><div class="av">${esc(inicial(s.nombre))}</div></div>
    <button class="icn" id="out" title="Salir" aria-label="Cerrar sesión"><i class="fas fa-right-from-bracket"></i></button></header>
  <div class="layout"><aside class="side">${staffSide ? `<a href="#/asignaturas" data-r="asignaturas"><i class="fas fa-graduation-cap"></i>${esDir() ? 'Todas las asignaturas' : 'Mis asignaturas'}</a><h5>Asignatura</h5>${S.asigId ? STAFF_NAV.map(navLink).join('') : '<div class="mini">Selecciona o crea una asignatura para gestionarla.</div>'}<span class="grow"></span>` : `${navItems().map(navLink).join('')}<h5>Módulos</h5>${modulos.map(m => `<a href="#/modulo/${m.id}" data-r="modulo/${m.id}"><i class="fas ${esc(m.icono || 'fa-book')}"></i>${esc(m.titulo)}</a>`).join('')}<span class="grow"></span>`}
  <div class="mini">© ${esc(C.course)} · ${esc(C.school)}</div></aside><main id="view"></main></div>
  <nav class="bnav">${bnavLinks()}</nav>`;
  $('#out').onclick = () => { API.logout(); localStorage.removeItem(KEYS); S.sesion = null; S.asigId = null; location.hash = ''; boot(); };
  $('#asel') && ($('#asel').onchange = async e => { S.asigId = e.target.value; await loadAsigData(); shell(); route(); });
}
function bnavLinks() {
  const L = esEst()
    ? [['mis', 'fa-graduation-cap', 'Asignaturas'], ['modulos', 'fa-layer-group', 'Módulos'], ['examenes', 'fa-clipboard-check', 'Quizzes'], ['progreso', 'fa-chart-line', 'Progreso']]
    : [['resumen', 'fa-gauge-high', 'Resumen'], ['modulos', 'fa-layer-group', 'Módulos'], ['estudiantes', 'fa-user-graduate', 'Alumnos'], ['progreso', 'fa-chart-line', 'Progreso']];
  return L.map(navLink).join('') + `<a href="#/mas" data-act="mas"><i class="fas fa-ellipsis"></i>Más</a>`;
}

/* ---------- router ---------- */
const ROUTES = ['mis', 'panel', 'inicio', 'modulos', 'modulo', 'examenes', 'examen', 'examen-editar', 'resultados', 'revision', 'anuncios', 'foro', 'progreso', 'asignaturas', 'resumen', 'estudiantes', 'ajustes', 'direccion', 'base'];
async function route() {
  if (!S.sesion) return boot();
  detenerForo();
  const [r0, a] = (location.hash.slice(2) || (esStaff() ? 'resumen' : 'mis')).split('/');
  let r = r0;
  if (esEst() && r === 'asignaturas') r = 'mis';
  if (esStaff() && r === 'mis') r = 'asignaturas';
  if (!ROUTES.includes(r) || r === 'mas') return nav(esStaff() ? 'resumen' : 'mis');
  const soloStaff = ['resumen', 'estudiantes', 'examen-editar', 'resultados', 'revision', 'ajustes', 'asignaturas'];
  if (soloStaff.includes(r) && !esStaff()) return nav('mis');
  const soloDireccion = ['direccion', 'base'];
  if (soloDireccion.includes(r) && !esDir()) return nav(esStaff() ? 'resumen' : 'mis');
  if (r === 'examen' && esStaff()) r = 'resultados';
  if (esEst() && !S.asigId && ['panel', 'modulos', 'modulo', 'examenes', 'examen', 'anuncios', 'foro', 'progreso'].includes(r)) {
    shell();
    $('#view').innerHTML = '<div class="empty"><i class="fas fa-inbox"></i>Aún no estás matriculado en ninguna asignatura. Pide a la dirección que te añada.</div>';
    return;
  }
  try {
    if (esStaff() && !S.asigId && !['asignaturas', 'base', 'direccion'].includes(r)) return nav('asignaturas');
    if (['panel', 'modulos', 'modulo', 'examenes', 'examen', 'examen-editar', 'resultados', 'anuncios', 'foro', 'progreso', 'resumen', 'estudiantes', 'ajustes'].includes(r)) await loadAsigData();
    if (r === 'mis') S.anunciosTodas = await Promise.all(S.asigs.map(async asg => ({ asig, anuncios: await API.call('getAnuncios', { asigId: asg.id }) })));
    if (r === 'foro') S.chat = await API.call('getForo', { asigId: S.asigId, threadId: a || '' });
    if (esEst() && ['panel', 'examenes', 'progreso', 'modulos', 'examen'].includes(r)) S.misNotas = await API.call('getMisNotas', { usuario: S.sesion.usuario, clave: S.sesion.clave, asigId: S.asigId });
    if (r === 'resultados') S.resIntentos = await API.call('getIntentos', { auth: authCod(), examenId: a });
    if (r === 'revision') S.reviewAttempt = await API.call('getIntentoDetalle', { auth: authCod(), intentoId: a });
    if (r === 'progreso' && esStaff()) S.intentosAsig = await API.call('getIntentosAsig', { auth: authCod(), asigId: S.asigId });
    if (r === 'examen') { S.resExamen = null; S.examenActual = await API.call('getExamen', { id: a }); }
    if (r === 'examen-editar' && a !== 'nuevo') { const ex = await API.call('getExamen', { id: a }); S.editExam = ex; S.editQs = ex.preguntas.map(q => ({ ...q })); }
    if (r === 'examen-editar' && a === 'nuevo') { S.editExam = { titulo: '', descripcion: '', visible: true }; S.editQs = []; }
    if (r === 'direccion') { S.resumen = await API.call('getResumen', { auth: authCod() }); S.profesores = await API.call('getProfesores', { auth: authCod() }); }
    if (r === 'base') S.estudiantes = await API.call('getEstudiantes', { auth: authCod() });
    if (r === 'anuncios') localStorage.setItem(KEYSEEN, JSON.stringify(S.anuncios.map(x => x.id)));
    shell();
    const act = r === 'modulo' ? 'modulos' : r === 'panel' ? 'mis' : ['examen', 'examen-editar', 'resultados', 'revision'].includes(r) ? 'examenes' : r;
    $$('.side a,.bnav a').forEach(x => x.classList.toggle('on', (x.dataset.r || '') === r || (x.dataset.r || '') === act));
    $('#view').innerHTML = VIEW[r] ? VIEW[r](a) : VIEW[esStaff() ? 'resumen' : 'inicio']();
    BIND[r] && BIND[r](a);
    if (r === 'modulo') cargarRecursosHtml();
    window.scrollTo(0, 0);
  } catch (ex) { const v = $('#view'); if (v) v.innerHTML = `<div class="notice"><i class="fas fa-triangle-exclamation"></i> ${esc(ex.message)}</div>`; }
}
function nav(r) { location.hash = '#/' + r; }
window.addEventListener('hashchange', route);

/* ---------- renderizadores de contenido ---------- */
const docHtml = txt => String(txt || '').split(/\n\n+/).map(b => {
  let html = '', ul = false;
  b.split('\n').forEach(l => {
    if (/^##\s+/.test(l)) { if (ul) { html += '</ul>'; ul = false; } html += `<h4>${esc(l.replace(/^##\s+/, ''))}</h4>`; }
    else if (/^-\s+/.test(l)) { if (!ul) { html += '<ul>'; ul = true; } html += `<li>${esc(l.replace(/^-\s+/, ''))}</li>`; }
    else if (l.trim()) { if (ul) { html += '</ul>'; ul = false; } html += `<p>${esc(l)}</p>`; }
  });
  return html + (ul ? '</ul>' : '');
}).join('');
const vocabHtml = c => { try { const f = (JSON.parse(c).filas || []); return `<div class="vw-grid">${f.map(r => `<div class="vw"><span class="vw-g gk">${esc(r[0])}</span><span class="vw-e">${esc(r[1] || '')}</span>${r[2] ? `<small>${esc(r[2])}</small>` : ''}</div>`).join('')}</div>`; } catch { return '<p>Sin datos.</p>'; } };
const leccionHtml = c => { try {
  const data = JSON.parse(c), pages = data.paginas || [];
  const cards = pages.map((p, i) => {
    const url = String(p.src || '').replace(/^\/+/, '');
    const safe = /^contenido\/leccion\d+\/[A-Za-z0-9_ .-]+\.html$/i.test(url) || /^assets\/[A-Za-z0-9_.-]+\.pdf$/i.test(url);
    const href = safe ? 'https://rol123-m.github.io/Curso-de-Griego-del-STBCOr.-/' + url.split('/').map(encodeURIComponent).join('/') : '';
    return '<article class="card lesson-page"><span class="tag navy">Parte ' + (i + 1) + '</span><h3>' + esc(p.t || 'Material de estudio') + '</h3>' + (href ? '<a class="btn sec" href="' + esc(href) + '" target="_blank" rel="noopener noreferrer"><i class="fas fa-arrow-up-right-from-square"></i> Abrir lección</a>' : '<span class="tag">Ruta no válida</span>') + '</article>';
  }).join('');
  return '<section class="lesson-intro card"><div class="lesson-time"><i class="fas fa-clock"></i> ' + Number(data.min || 0) + ' min</div><p>' + esc(data.desc || '') + '</p></section><div class="grid gA lesson-pages">' + cards + '</div>';
} catch { return '<p>No se pudo interpretar el contenido de esta lección.</p>'; } };
const recursosHtml = c => { try {
  const it = (JSON.parse(c).items || []);
  return `<div class="grid gA">${it.map(r => {
    const url = String(r.u || '');
    const safe = /^https?:\/\//i.test(url) ? url : '';
    const kind = r.k || (/\.html?\.txt(?:$|[?#])/i.test(url) ? 'html' : /\.(?:png|jpe?g|webp|gif)(?:$|[?#])/i.test(url) ? 'image' : 'link');
    const media = safe && kind === 'image' ? `<a href="${esc(safe)}" target="_blank" rel="noopener"><img class="res-img" src="${esc(safe)}" alt="${esc(r.t)}" loading="lazy"></a>`
      : safe && kind === 'html' ? `<iframe class="res-html" data-html-src="${esc(safe)}" title="${esc(r.t)}" sandbox="allow-scripts" referrerpolicy="no-referrer" loading="lazy"></iframe>` : '';
    const action = safe && kind === 'link' ? `<a class="btn sec sm" href="${esc(safe)}" target="_blank" rel="noopener">${esc(r.b || 'Abrir')} <i class="fas fa-up-right-from-square"></i></a>` : '';
    return `<div class="card res"><i class="fas ${kind === 'image' ? 'fa-image' : kind === 'html' ? 'fa-code' : safe ? 'fa-up-right-from-square' : 'fa-hourglass'} big"></i><h3>${esc(r.t)}</h3><p>${esc(r.d || '')}</p>${media}${action}${!safe ? '<span class="tag">Recurso sin URL válida</span>' : ''}</div>`;
  }).join('')}</div>`;
} catch { return '<p>Sin datos.</p>'; } };

async function cargarRecursosHtml() {
  for (const frame of $$('#view iframe[data-html-src]')) {
    const src = frame.dataset.htmlSrc;
    try {
      const response = await fetch(src, { credentials: 'omit', cache: 'no-store' });
      if (!response.ok) throw new Error('No se pudo cargar el recurso HTML.');
      const html = await response.text();
      const base = new URL('.', src).href;
      const baseTag = '<base href="' + base.replace(/"/g, '%22') + '">';
      frame.srcdoc = /<head[^>]*>/i.test(html)
        ? html.replace(/<head[^>]*>/i, head => head + baseTag)
        : baseTag + html;
    } catch {
      frame.srcdoc = '<!doctype html><meta charset="utf-8"><p style="font:16px sans-serif;padding:1rem">No se pudo cargar este recurso. Comprueba la conexión.</p>';
    }
  }
}

/* ---------- vistas del estudiante ---------- */
const VIEW = {};
VIEW.inicio = () => esStaff() ? VIEW.resumen() : (() => {
  const todas = S.anunciosTodas || [];
  const anns = todas.flatMap(x => x.anuncios.map(an => ({ ...an, asig: x.asig })))
    .sort((x, y) => (y.pin ? 1 : 0) - (x.pin ? 1 : 0) || (y.fecha > x.fecha ? 1 : -1)).slice(0, 6);
  return `<div class="ph"><h2>Bienvenido, ${esc(S.sesion.nombre.split(' ')[0])}</h2>
  <p>Estas son las asignaturas en las que estás matriculado. Toca una para abrir su panel.</p></div>
  <div class="grid gA">${S.asigs.map(a => `<article class="card asigcard" style="border-top:5px solid ${esc(a.color || '#14385c')}">
    <h3>${esc(a.nombre)}</h3>
    <p style="color:var(--mut);font-size:.88rem">${esc(a.descripcion || '')}</p>
    <p style="font-size:.8rem;color:var(--mut);margin-bottom:.8rem"><i class="fas fa-chalkboard-user"></i> ${esc(a.profesorNombre || 'Profesor por asignar')}</p>
    <button class="btn" data-act="asigopen" data-id="${a.id}"><i class="fas fa-arrow-right"></i> Entrar a la asignatura</button></article>`).join('')
    || '<div class="empty"><i class="fas fa-inbox"></i>Aún no estás matriculado en ninguna asignatura.</div>'}</div>
  <h3 style="margin:1.6rem 0 .8rem"><i class="fas fa-bullhorn"></i> Anuncios recientes</h3>
  <div class="grid">${anns.map(an => `<article class="card ann ${an.pin ? 'pin' : ''}"><div class="ahd"><span class="tag navy">${esc(an.asig.nombre)}</span><span class="tag">${esc(an.tag || 'Aviso')}</span><small>${fmtDT(an.fecha)}${an.autor ? ' · ' + esc(an.autor) : ''}</small></div><h3>${esc(an.titulo)}</h3><p>${esc(an.cuerpo)}</p></article>`).join('') || '<div class="empty"><i class="fas fa-bullhorn"></i>No hay anuncios por ahora.</div>'}</div>`;
})();
VIEW.panel = () => (() => {
  const pr = progresoDe(S.sesion.usuario), a = asig();
  const conNota = S.examenes.filter(x => x.visible !== false && S.misNotas.some(n => n.examenId === x.id));
  const pend = S.examenes.filter(x => x.visible !== false).find(x => !S.misNotas.some(n => n.examenId === x.id));
  const an = S.anuncios[0];
  const foroAbierto = a?.chatAbierto === 'Si';
  return `<div class="ph"><p style="margin:0 0 .5rem"><a class="btn sec sm" href="#/mis"><i class="fas fa-arrow-left"></i> Mis asignaturas</a></p><h2>${esc(a?.nombre || 'Asignatura')}</h2>
  <p>${esc(a?.descripcion || '')}${a?.profesorNombre ? ' · ' + esc(a.profesorNombre) : ''}</p></div>
  ${pend ? `<div class="banner"><div class="grow"><h2>Pendiente ahora</h2><p>Tienes un quiz disponible para practicar.</p><a class="btn sm gold" style="margin-top:.9rem" href="#/examen/${pend.id}"><i class="fas fa-clipboard-check"></i> ${notaTxt(S.misNotas.find(n => n.examenId === pend.id)) ? 'Reintentar' : 'Realizar'}: ${esc(pend.titulo)}</a></div>${ring(pr.pct)}</div>` : ''}
  <div class="grid g4" style="margin-bottom:1.2rem">
    <div class="card stat"><i class="fas fa-layer-group"></i><div><b>${pr.done}/${pr.tot}</b><span>Módulos y quizzes completados</span></div></div>
    <div class="card stat"><i class="fas fa-clipboard-check"></i><div><b>${conNota.length}/${S.examenes.filter(x => x.visible !== false).length}</b><span>Quizzes con nota</span></div></div>
    <div class="card stat"><i class="fas fa-bullhorn"></i><div><b>${unseen() || '0'}</b><span>Anuncios nuevos</span></div></div>
    <a class="card stat" href="#/foro" style="text-decoration:none;color:inherit"><i class="fas fa-comments"></i><div><b style="font-size:1.1rem">${foroAbierto ? 'Abierto' : 'Cerrado'}</b><span>Foro de dudas</span></div></a></div>
  <div class="grid g2">
    <div class="card"><h3><i class="fas fa-bullhorn"></i> Último anuncio</h3>${an ? `<p><b>${esc(an.titulo)}</b></p><p style="color:var(--mut);font-size:.9rem;margin:.3rem 0 .8rem">${esc(an.cuerpo.slice(0, 160))}${an.cuerpo.length > 160 ? '…' : ''}</p><a class="btn sec sm" href="#/anuncios">Ver anuncios</a>` : '<p style="color:var(--mut)">Sin anuncios.</p>'}</div>
    <div class="card"><h3><i class="fas fa-layer-group"></i> Módulos</h3><ul class="list">${S.pestanas.filter(x => x.visible !== false).slice(0, 5).map(m => {
      const done = S.progreso.some(y => y.usuario === S.sesion.usuario && y.tipo === 'pestaña' && y.itemId === m.id && y.completado);
      return `<li><i class="fas ${esc(m.icono || 'fa-book')}"></i><div>${esc(m.titulo)}<small>${TIPOS[m.tipo]?.[0] || m.tipo}</small></div>${done ? '<span class="tag done">Completado</span>' : `<a class="btn sec sm" href="#/modulo/${m.id}">Abrir</a>`}</li>`;
    }).join('') || '<li><i class="fas fa-circle-info"></i><div>Aún no hay módulos<small>El profesor los publicará pronto</small></div></li>'}</ul></div></div>`;
})();
VIEW.modulos = () => {
  if (esStaff()) return VIEW.gestionModulos();
  const pr = progresoDe(S.sesion.usuario);
  return `<div class="ph"><h2>Módulos</h2><p>${esc(asig()?.nombre || '')} · ${pr.done} de ${pr.tot} completados</p></div>
  <div class="grid gA">${S.pestanas.filter(x => x.visible !== false).map(m => {
    const done = S.progreso.some(y => y.usuario === S.sesion.usuario && y.tipo === 'pestaña' && y.itemId === m.id && y.completado);
    return `<article class="card mod"><div class="hd"><span class="ic"><i class="fas ${esc(m.icono || 'fa-book')}"></i></span><div><span class="tag navy">${TIPOS[m.tipo]?.[0] || m.tipo}</span><h3 style="margin-top:.3rem">${esc(m.titulo)}</h3></div></div>
    <a class="btn ${done ? 'sec' : ''}" href="#/modulo/${m.id}">${done ? 'Repasar' : 'Abrir módulo'}</a></article>`;
  }).join('') || '<div class="empty"><i class="fas fa-layer-group"></i>Aún no hay módulos publicados.</div>'}</div>`;
};
VIEW.modulo = id => {
  const m = S.pestanas.find(x => x.id === id); if (!m) return '<div class="notice">Módulo no encontrado.</div>';
  const done = S.progreso.some(y => y.usuario === S.sesion.usuario && y.tipo === 'pestaña' && y.itemId === m.id && y.completado);
  const cuerpo = m.tipo === 'leccion' ? leccionHtml(m.contenido) : m.tipo === 'vocabulario' ? vocabHtml(m.contenido) : m.tipo === 'recursos' ? recursosHtml(m.contenido) : m.tipo === 'enlace'
    ? `<div class="card" style="display:flex;gap:1rem;align-items:center;flex-wrap:wrap"><div class="grow"><h3 style="margin:0">Recurso externo</h3><p style="color:var(--mut);font-size:.9rem">${esc(m.contenido || '')}</p></div><a class="btn" href="${esc(m.contenido || '#')}" target="_blank" rel="noopener"><i class="fas fa-up-right-from-square"></i> Abrir</a></div>`
    : `<div class="doc">${docHtml(m.contenido)}</div>`;
  return `<div class="ph"><h2>${esc(m.titulo)}</h2><p><span class="tag navy"><i class="fas ${esc(m.icono || 'fa-book')}"></i> ${TIPOS[m.tipo]?.[0] || m.tipo}</span></p></div>
  <div class="card" style="margin-bottom:1.1rem">${cuerpo}</div>
  ${m.tipo !== 'enlace' && esEst() ? `<button class="btn ${done ? 'sec' : 'ok'}" data-act="mcomp" ${done ? 'disabled' : ''}><i class="fas fa-check"></i> ${done ? 'Módulo completado' : 'Marcar como completado'}</button>` : ''}`;
};
VIEW.examenes = () => {
  if (esStaff()) return VIEW.gestionExamenes();
  return `<div class="ph"><h2>Exámenes</h2><p>Cuatro evaluaciones semanales. Cada examen permite una sola entrega; las preguntas objetivas se califican automáticamente y comprensión queda pendiente de revisión docente.</p></div>
  <div class="grid gA">${S.examenes.filter(x => x.visible !== false).map(x => {
    const mis = S.misNotas.filter(n => n.examenId === x.id);
    const mejor = mis.length ? Math.max(...mis.map(n => n.puntaje)) : null;
    const tot = mis.length ? Math.max(...mis.map(n => n.total)) : null;
    return `<article class="card exam"><div class="hd"><span class="nb">${esc(x.titulo)}</span><span class="tag ${mis.length ? 'done' : 'prog'}">${mis.some(n => n.estadoRevision === 'pending') ? 'Pendiente de revisión' : mejor != null ? `Nota: ${mejor}/${tot}` : 'Sin intento'}</span></div>
    <p style="color:var(--mut);font-size:.9rem">${esc(x.descripcion || '')}</p>
    <div class="info"><span><i class="fas fa-circle-question"></i> ${x.nPreg || '—'} preguntas</span>${mis.length ? `<span><i class="fas fa-rotate"></i> ${mis.length} intento${mis.length > 1 ? 's' : ''}</span>` : ''}</div>
    ${mis.length ? '<span class="tag done"><i class="fas fa-check"></i> Entregado</span>' : `<a class="btn" href="#/examen/${x.id}"><i class="fas fa-pen"></i> Realizar</a>`}</article>`;
  }).join('') || '<div class="empty"><i class="fas fa-clipboard-check"></i>Aún no hay exámenes disponibles.</div>'}</div>`;
};
VIEW.examen = id => {
  const x = S.examenActual || S.examenes.find(e => e.id === id);
  if (!x || !x.preguntas) return '<div class="notice">Examen no encontrado.</div>';
  if (S.resExamen) {
    const r = S.resExamen;
    return `<div class="ph"><h2>${esc(x.titulo)}</h2><p>Resultado de tu intento</p></div>
    <div class="card" style="display:flex;gap:1.2rem;align-items:center;margin-bottom:1.2rem">${ring(r.pct, 'dk')}<div><h3 style="margin:0">${r.puntaje} de ${r.totalAutomatico} puntos automáticos</h3><p style="color:var(--mut);font-size:.9rem">${r.pendienteRevision ? 'Tu examen incluye respuestas que debe revisar el profesor. La nota todavía es provisional.' : 'Tu examen fue calificado automáticamente.'}</p></div>
    <span class="grow" style="flex:1"></span><button class="btn sec" data-act="reintentar"><i class="fas fa-rotate"></i> Volver a exámenes</button></div>
    <div class="card"><h3>Resumen de respuestas</h3>${r.detalle.map((d, i) => `<div class="rv ${d.ok === null ? '' : d.ok ? 'ok' : 'bad'}"><div><b>${i + 1}. ${esc(d.texto)}</b><small>${d.ok === null ? 'Pendiente de revisión docente' : d.ok ? 'Correcta' : 'Incorrecta'} · ${d.obtenido}/${d.puntos} puntos</small></div></div>`).join('')}</div>`;
  }
  const previous = S.misNotas.find(n => n.examenId === id);
  if (previous) return `<div class="ph"><h2>${esc(x.titulo)}</h2><p>Este examen ya fue entregado. Cada estudiante dispone de una sola oportunidad.</p></div>
    <div class="card"><h3>${previous.estadoRevision === 'pending' ? 'Pendiente de revisión del profesor' : 'Calificación final'}</h3><p>${previous.estadoRevision === 'pending' ? 'La parte automática se ha calificado. La nota definitiva aparecerá cuando el profesor revise las respuestas de comprensión.' : (previous.puntaje + ' / ' + previous.total + ' puntos')}</p><a class="btn sec" href="#/examenes">Volver a exámenes</a></div>`;
  return `<div class="ph"><h2>${esc(x.titulo)}</h2><p>${esc(x.descripcion || '')}</p></div>
  <form id="xf"><div class="card" style="margin-bottom:1.1rem">${x.preguntas.map((q, i) => {
    const meta = q.metadata || {};
    let field = '';
    if (q.tipo === 'sm' || q.tipo === 'vf') field = `<div class="vopts">${q.opciones.map((o, k) => `<label class="opt"><input type="radio" name="q${i}" value="${k}" required>${esc(o)}</label>`).join('')}</div>`;
    else if (q.tipo === 'emp') field = `<input type="text" name="q${i}" required placeholder="Escribe tu respuesta">`;
    else if (q.tipo === 'rel') field = `<div class="grid">${(meta.leftItems || []).map((left, j) => `<label class="fld">${esc(left)}<select name="q${i}_${j}" required><option value="">Selecciona…</option>${(meta.rightOptions || []).map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join('')}</select></label>`).join('')}</div>`;
    else if (q.tipo === 'comprension' || q.tipo === 'red') field = `<div class="fld answer-writing"><label for="q${i}">Tu respuesta escrita</label><textarea id="q${i}" name="q${i}" rows="9" minlength="10" maxlength="12000" required placeholder="Escribe aquí tu respuesta completa. Puedes desarrollar tus ideas, justificar tu análisis y citar el texto cuando corresponda."></textarea><small>Esta respuesta quedará guardada y será revisada por el profesor.</small></div>`;
    else field = `<textarea name="q${i}" rows="5" required placeholder="Escribe tu respuesta…"></textarea>`;
    return `<div class="q"><h4>${i + 1}. ${esc(q.texto)} <span class="pts">· ${q.puntos} puntos · ${['comprension','red'].includes(q.tipo) ? 'Revisión docente' : 'Automática'}</span></h4>${field}</div>`;
  }).join('')}</div>
  <button class="btn" type="submit"><i class="fas fa-paper-plane"></i> Enviar examen</button> <button class="btn sec" type="button" data-act="cancelex"><i class="fas fa-xmark"></i> Cancelar</button></form>`;
};
VIEW.anuncios = () => {
  const lista = S.anuncios.map(a => `<article class="card ann ${a.pin ? 'pin' : ''}"><div class="ahd"><span class="tag ${a.pin ? 'prog' : ''}"><i class="fas fa-thumbtack"></i> ${esc(a.tag || 'Aviso')}</span><small>${fmtDT(a.fecha)}${a.autor ? ' · ' + esc(a.autor) : ''}</small></div><h3>${esc(a.titulo)}</h3><p>${esc(a.cuerpo)}</p></article>`).join('');
  if (esEst()) return `<div class="ph"><h2>Anuncios</h2><p>Avisos del profesor de ${esc(asig()?.nombre || 'la asignatura')}.</p></div><div class="grid">${lista || '<div class="empty"><i class="fas fa-bullhorn"></i>No hay anuncios.</div>'}</div>`;
  return VIEW.gestionAnuncios(lista);
};
VIEW.progreso = () => {
  if (esStaff()) return VIEW.matrizProgreso();
  const pr = progresoDe(S.sesion.usuario);
  const modulos = S.pestanas.filter(x => x.visible !== false).map(m => {
    const done = S.progreso.some(y => y.usuario === S.sesion.usuario && y.tipo === 'pestaña' && y.itemId === m.id && y.completado);
    const estado = done ? '<span class="tag done">Completado</span>' : '<span class="tag prog">Pendiente</span>';
    return { titulo: m.titulo, tipo: TIPOS[m.tipo]?.[0] || m.tipo, estado, url: '#/modulo/' + m.id, accion: 'Abrir', done };
  });
  const examenes = S.examenes.filter(x => x.visible !== false).map(x => {
    const n = S.misNotas.filter(y => y.examenId === x.id);
    const mejor = n.length ? Math.max(...n.map(y => y.puntaje)) : null, tot = n.length ? Math.max(...n.map(y => y.total)) : null;
    return { titulo: x.titulo, tipo: 'Quiz', estado: mejor != null ? '<span class="tag done">' + mejor + '/' + tot + '</span>' : '<span class="tag prog">Sin intento</span>', url: '#/examen/' + x.id, accion: n.length ? 'Ver estado' : 'Realizar', done: mejor != null };
  });
  const items = [...modulos, ...examenes];
  const rows = items.map(x => `<article class="student-progress-item"><div class="spi-main"><b>${esc(x.titulo)}</b><small>${esc(x.tipo)}</small></div><div class="spi-foot">${x.estado}<a class="btn sec sm" href="${x.url}">${x.accion}</a></div></article>`).join('');
  return `<div class="ph"><h2>Mi progreso</h2><p>${esc(asig()?.nombre || '')}</p></div>
  <div class="card student-progress-summary"><div class="student-ring">${ring(pr.pct, 'dk')}</div><div class="sps-copy"><h3>${pr.done} de ${pr.tot} completados</h3><p>Módulos completados y quizzes realizados.</p><div class="bar"><i style="width:${pr.pct}%"></i></div><b>${pr.pct}%</b></div></div>
  <div class="card tw student-progress-desktop"><table><thead><tr><th>Elemento</th><th>Tipo</th><th>Estado</th><th></th></tr></thead><tbody>
  ${S.pestanas.filter(x => x.visible !== false).map(m => {
    const done = S.progreso.some(y => y.usuario === S.sesion.usuario && y.tipo === 'pestaña' && y.itemId === m.id && y.completado);
    return `<tr><td>${esc(m.titulo)}</td><td><span class="tag navy">${TIPOS[m.tipo]?.[0] || m.tipo}</span></td><td>${done ? '<span class="tag done">Completado</span>' : '<span class="tag prog">Pendiente</span>'}</td><td><a class="btn sec sm" href="#/modulo/${m.id}">Abrir</a></td></tr>`;
  }).join('')}
  ${S.examenes.filter(x => x.visible !== false).map(x => {
    const n = S.misNotas.filter(y => y.examenId === x.id);
    const mejor = n.length ? Math.max(...n.map(y => y.puntaje)) : null, tot = n.length ? Math.max(...n.map(y => y.total)) : null;
    return `<tr><td>${esc(x.titulo)}</td><td><span class="tag">Quiz</span></td><td>${mejor != null ? `<span class="tag done">${mejor}/${tot}</span>` : '<span class="tag prog">Sin intento</span>'}</td><td><a class="btn sec sm" href="#/examen/${x.id}"> ${n.length ? 'Ver estado' : 'Realizar'}</a></td></tr>`;
  }).join('')}
  </tbody></table></div>
  <div class="student-progress-mobile">${rows || '<div class="empty"><i class="fas fa-book-open"></i>Aún no hay módulos ni quizzes disponibles.</div>'}</div>`;
};

/* ---------- foro por conversaciones ---------- */
const esForo = () => (location.hash.slice(2).split('/')[0] || '') === 'foro';
function detenerForo() { if (S.chatTimer) { clearInterval(S.chatTimer); S.chatTimer = null; } }
function foroListaHtml() {
  const items = S.chat?.conversaciones || [];
  return items.map(h => `<article class="card forum-thread">
    <div class="forum-thread-head"><div><span class="tag ${h.estado === 'closed' ? 'closed' : 'open'}">${h.estado === 'closed' ? 'Finalizada' : 'Activa'}</span>
    <h3>${esc(h.titulo)}</h3><small>${esc(h.autor)} · ${fmtDT(h.fecha)}</small></div>
    <span class="tag">${h.respuestas} respuesta${h.respuestas === 1 ? '' : 's'}</span></div>
    <p class="forum-last">${esc(h.ultimoTexto || 'Sin respuestas todavía')}</p>
    <div class="forum-actions"><a class="btn sec sm" href="#/foro/${encodeURIComponent(h.id)}">Abrir conversación</a>
    ${(esStaff() || h.autorUsuario === S.sesion.usuario) ? `<button class="btn danger sm" data-act="threaddel" data-id="${esc(h.id)}"><i class="fas fa-trash"></i> Eliminar</button>` : ''}</div>
  </article>`).join('') || '<div class="empty"><i class="fas fa-comments"></i>Aún no hay conversaciones. Inicia la primera.</div>';
}
function pintarChat() {
  const caja = $('#chatlist'); if (!caja) return;
  const posts = S.chat?.mensajes || [];
  caja.innerHTML = posts.map(m => {
    const mio = m.usuario === S.sesion.usuario;
    const del = esStaff() || mio;
    return `<div class="fmsg ${mio ? 'mio' : ''}"><div class="fmh"><b>${esc(m.nombre)}</b>${m.rol !== 'estudiante' ? `<span class="badge dir">${m.rol === 'profesor' ? 'Profesor' : 'Dirección'}</span>` : ''}<small>${fmtDT(m.fecha)}</small>${del ? `<button class="ibtn xs" data-act="postdel" data-id="${esc(m.id)}" title="Eliminar respuesta"><i class="fas fa-trash"></i></button>` : ''}</div><p>${esc(m.texto)}</p></div>`;
  }).join('') || '<div class="empty" style="padding:1.6rem"><i class="fas fa-comments"></i>Esta conversación aún no tiene respuestas.</div>';
  caja.scrollTop = caja.scrollHeight;
}
function iniciarForo() {
  detenerForo();
  S.chatTimer = setInterval(async () => {
    if (!esForo() || document.hidden || !S.chat) return;
    try {
      const threadId = location.hash.slice(2).split('/')[1] || '';
      const d = await API.call('getForo', { asigId: S.asigId, threadId });
      S.chat = d;
      const list = $('#forolist'); if (list) list.innerHTML = foroListaHtml();
      pintarChat();
      const status = $('#threadstatus');
      if (status && d.actual) status.innerHTML = d.actual.estado === 'closed' ? '<span class="tag closed">Conversación finalizada</span>' : '<span class="tag open">Conversación activa</span>';
      const form = $('#postform');
      if (form && (!d.actual || d.actual.estado !== 'open' || (!esStaff() && !d.abierto))) form.remove();
    } catch { /* reintenta en el próximo ciclo */ }
  }, (C.foro && C.foro.intervaloMs) || 5000);
}
VIEW.foro = id => {
  const abierto = !!S.chat?.abierto, actual = S.chat?.actual;
  const selected = !!id && !!actual;
  const puedeCrear = esStaff() || abierto;
  return `<div class="ph"><h2>Foro de conversaciones</h2><p>${esc(asig()?.nombre || '')} · cada tema conserva su propio historial.</p>
  <div class="forum-top"><span class="tag ${abierto ? 'open' : 'closed'}">${abierto ? 'Foro abierto' : 'Foro cerrado para estudiantes'}</span>
  ${esStaff() ? `<button class="btn ${abierto ? 'warn' : 'ok'} sm" data-act="chattoggle">${abierto ? 'Cerrar nuevas participaciones' : 'Permitir nuevas participaciones'}</button>` : ''}</div></div>
  ${selected ? `<section class="card forum-detail"><div class="forum-detail-head"><button class="btn sec sm" data-act="threadback"><i class="fas fa-arrow-left"></i> Todas las conversaciones</button><span id="threadstatus"><span class="tag ${actual.estado === 'closed' ? 'closed' : 'open'}">${actual.estado === 'closed' ? 'Conversación finalizada' : 'Conversación activa'}</span></span></div>
  <h3>${esc(actual.titulo)}</h3><p class="muted">Iniciada por ${esc(actual.autor)} · ${fmtDT(actual.fecha)}</p>
  <div class="fmsgbox" id="chatlist"></div>
  ${actual.estado === 'open' && (esStaff() || abierto) ? `<form id="postform" class="finput"><div class="in"><input id="ct" maxlength="4000" required placeholder="Escribe una respuesta…" autocomplete="off"><button class="btn" type="submit"><i class="fas fa-paper-plane"></i></button></div></form>` : '<p class="notice">Esta conversación está finalizada o el foro no admite nuevas respuestas.</p>'}
  <div class="forum-actions">
  ${esStaff() && actual.estado === 'open' ? '<button class="btn warn sm" data-act="threadclose" data-id="' + esc(actual.id) + '"><i class="fas fa-check"></i> Finalizar conversación</button>' : ''}
  ${(esStaff() || actual.autorUsuario === S.sesion.usuario) ? '<button class="btn danger sm" data-act="threaddel" data-id="' + esc(actual.id) + '"><i class="fas fa-trash"></i> Eliminar conversación</button>' : ''}
  </div></section>` : `
  ${puedeCrear ? `<section class="card forum-new"><h3><i class="fas fa-plus-circle"></i> Iniciar una conversación</h3><form id="threadform"><div class="fld"><label for="threadtitle">Título o tema</label><div class="in"><input id="threadtitle" maxlength="120" required placeholder="Ej. Duda sobre los casos gramaticales"></div></div><div class="fld"><label for="threadtext">Mensaje inicial</label><div class="in"><textarea id="threadtext" rows="4" maxlength="4000" required placeholder="Explica tu pregunta o plantea el tema…"></textarea></div></div><button class="btn" type="submit"><i class="fas fa-paper-plane"></i> Publicar conversación</button></form></section>` : '<div class="notice"><i class="fas fa-lock"></i> El profesor ha cerrado temporalmente la creación de conversaciones y respuestas.</div>'}
  <div class="ph"><h3>Conversaciones anteriores y activas</h3></div><div id="forolist" class="grid gA">${foroListaHtml()}</div>`}`;
};/* ---------- acciones del estudiante ---------- */
const BIND = {};
BIND.modulo = id => {
  const b = $('[data-act="mcomp"]'); if (!b) return;
  b.onclick = async () => {
    try {
      await API.call('setProgreso', { usuario: S.sesion.usuario, clave: S.sesion.clave, asigId: S.asigId, itemId: id, tipo: 'pestaña', completado: true });
      toast('Módulo marcado como completado.');
      await loadAsigData(); shell(); route();
    } catch (ex) { toast(ex.message); }
  };
};
BIND.examen = id => {
  const f = $('#xf'); if (!f) return;
  f.onsubmit = async e => {
    e.preventDefault();
    const btn = f.querySelector('button[type=submit]'); btn.disabled = true;
    try {
      const ex = await API.call('getExamen', { id });
      const respuestas = ex.preguntas.map((q, i) => {
        if (q.tipo === 'sm' || q.tipo === 'vf') { const v = f.querySelector(`input[name=q${i}]:checked`); return v ? Number(v.value) : null; }
        if (q.tipo === 'rel') { const value = {}; (q.metadata?.leftItems || []).forEach((left, j) => { value[left] = f.querySelector(`[name="q${i}_${j}"]`)?.value || ''; }); return value; }
        return f.querySelector(`[name=q${i}]`)?.value || '';
      });
      S.resExamen = await API.call('enviarIntento', { examenId: id, respuestas });
      await loadAsigData();
      $('#view').innerHTML = VIEW.examen(id); BIND.examen(id); window.scrollTo(0, 0);
      toast(S.resExamen.pendienteRevision ? 'Parte automática corregida. Comprensión pendiente de revisión.' : 'Examen calificado: ' + S.resExamen.puntaje + '/' + S.resExamen.total);
    } catch (ex2) { toast(ex2.message); btn.disabled = false; }
  };
};
BIND.foro = id => {
  pintarChat(); iniciarForo();
  const nf = $('#threadform');
  if (nf) nf.onsubmit = async e => {
    e.preventDefault();
    const titulo = $('#threadtitle').value.trim(), texto = $('#threadtext').value.trim();
    if (!titulo || !texto) return;
    const btn = nf.querySelector('button[type=submit]'); btn.disabled = true;
    try {
      const r = await API.call('crearConversacion', { asigId: S.asigId, titulo, texto });
      toast('Conversación publicada.');
      S.chat.actual = r.actual; S.chat.mensajes = r.mensajes || [];
      nav('foro/' + encodeURIComponent(r.actual.id));
    } catch (ex) { toast(ex.message); btn.disabled = false; }
  };
  const pf = $('#postform');
  if (pf) pf.onsubmit = async e => {
    e.preventDefault();
    const inp = $('#ct'), texto = inp.value.trim(); if (!texto) return;
    const btn = pf.querySelector('button[type=submit]'); btn.disabled = true;
    try {
      const r = await API.call('responderConversacion', { asigId: S.asigId, threadId: id, texto });
      S.chat.mensajes.push(r.mensaje); pintarChat(); inp.value = ''; inp.focus(); btn.disabled = false;
    } catch (ex) { toast(ex.message); btn.disabled = false; }
  };
};

/* ============================================================
   VISTAS Y ACCIONES DEL PERSONAL (profesor · dirección)
   ============================================================ */
const HINTS = {
  contenido: { l: 'Contenido', p: 'Párrafos separados por línea en blanco.\n## Título de sección\n- elemento de lista' },
  leccion: { l: 'Datos de la lección (JSON)', p: '{ "min": 45, "desc": "Descripción", "paginas": [{ "t": "Página 1", "src": "contenido/leccion1/alfabeto.html" }] }' },
  vocabulario: { l: 'Palabras', p: 'Una por línea: término | significado | dato gramatical' },
  recursos: { l: 'Recursos', p: 'Uno por línea: título | descripción | url | texto del botón' },
  enlace: { l: 'URL', p: '' }
};
function pestaToText(t) {
  if (t.tipo === 'vocabulario') { try { return (JSON.parse(t.contenido).filas || []).map(r => r.join(' | ')).join('\n'); } catch { return ''; } }
  if (t.tipo === 'recursos') { try { return (JSON.parse(t.contenido).items || []).map(r => [r.t, r.d, r.u, r.b].join(' | ')).join('\n'); } catch { return ''; } }
  if (t.tipo === 'enlace') return '';
  return t.contenido || '';
}
function textToPesta(tipo, txt) {
  if (tipo === 'vocabulario') return JSON.stringify({ filas: txt.split('\n').map(l => l.trim()).filter(Boolean).map(l => l.split('|').map(x => x.trim())) });
  if (tipo === 'recursos') return JSON.stringify({ items: txt.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
    const p = l.split('|').map(x => x.trim()), u = p[2] || '';
    const k = /\.html?\.txt(?:$|[?#])/i.test(u) ? 'html' : /\.(?:png|jpe?g|webp|gif)(?:$|[?#])/i.test(u) ? 'image' : 'link';
    return { t: p[0] || '', d: p[1] || '', u, b: p[3] || 'Abrir', k };
  }) });
  return txt;
}
function dlgPesta(t) {
  const tipos = Object.entries(TIPOS).map(([k, [n]]) => `<option value="${k}"${t && t.tipo === k ? ' selected' : ''}>${n}</option>`).join('');
  const d = dialog(t ? 'Editar módulo' : 'Nuevo módulo', `<form id="pf">
  <div class="fld"><label>Título</label><div class="in"><input id="pt" required value="${esc(t?.titulo || '')}"></div></div>
  <div class="fld"><label>Icono (clase de Font Awesome, ej. fa-book)</label><div class="in"><input id="pi" value="${esc(t?.icono || 'fa-book')}"></div></div>
  <div class="fld"><label>Tipo de módulo</label><div class="in"><select id="pty">${tipos}</select></div></div>
  <div class="fld" id="purlfld" style="display:none"><label>URL del enlace</label><div class="in"><input id="purl" placeholder="https://…"></div></div>
  <div class="fld" id="ptxtfld"><label id="ptxtlbl">Contenido</label><div class="in"><textarea id="ptxt" rows="8" placeholder=""></textarea></div></div>
  <div class="fld" id="pfilesfld" style="display:none"><label>Subir archivos al repositorio del seminario</label><div class="in"><input id="pfiles" type="file" multiple accept=".html,.htm,.png,.jpg,.jpeg,.webp,.gif" style="padding:.55rem"></div><small style="color:var(--mut)">HTML e imágenes PNG, JPG, WEBP o GIF. Los archivos se publican en GitHub; en Supabase solo se guarda el enlace.</small><div id="pfilemsg" class="tag" style="margin-top:.35rem;display:inline-block"></div></div>
  <label style="display:flex;gap:.5rem;align-items:center;font-size:.9rem;margin-bottom:.6rem"><input type="checkbox" id="pv" ${!t || t.visible !== false ? 'checked' : ''}> Visible para los estudiantes</label>
  <div class="err" id="per"></div><button class="btn" type="submit"><i class="fas fa-check"></i> Guardar módulo</button></form>`);
  const upd = () => {
    const ty = $('#pty').value;
    $('#purlfld').style.display = ty === 'enlace' ? '' : 'none';
    $('#ptxtfld').style.display = ty === 'enlace' ? 'none' : '';
    $('#pfilesfld').style.display = ty === 'recursos' ? '' : 'none';
    $('#ptxtlbl').textContent = HINTS[ty].l; $('#ptxt').placeholder = HINTS[ty].p;
  };
  $('#pty').onchange = upd; upd();
  $('#ptxt').value = t ? pestaToText(t) : '';
  if (t && t.tipo === 'enlace') $('#purl').value = t.contenido || '';
  $('#pfiles').onchange = async () => {
    const input = $('#pfiles'), files = [...(input.files || [])], status = $('#pfilemsg');
    status.textContent = '';
    for (const file of files) {
      try {
        const html = /\.html?$/i.test(file.name);
        const image = /\.(png|jpe?g|webp|gif)$/i.test(file.name);
        if (!html && !image) throw new Error('Formato no permitido: ' + file.name);
        if (file.size > (html ? 1024 * 1024 : 5 * 1024 * 1024)) throw new Error('El archivo supera el tamaño permitido: ' + file.name);
        const base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '');
          reader.onerror = () => reject(new Error('No se pudo leer ' + file.name));
          reader.readAsDataURL(file);
        });
        const result = await API.call('uploadResource', { auth: authCod(), asigId: S.asigId, filename: file.name, mime: file.type, base64 });
        const line = [file.name.replace(/\|/g, '-'), html ? 'Página HTML' : 'Imagen', result.url, 'Abrir'].join(' | ');
        $('#ptxt').value = ($('#ptxt').value.trim() ? $('#ptxt').value.trim() + '\n' : '') + line;
        status.textContent = 'Publicado: ' + file.name;
      } catch (ex) {
        status.textContent = ex.message;
        break;
      }
    }
    input.value = '';
  };
  $('#pf').onsubmit = async e => {
    e.preventDefault();
    try {
      const ty = $('#pty').value;
      const contenido = ty === 'enlace' ? $('#purl').value.trim() : textToPesta(ty, $('#ptxt').value);
      await API.call('savePestana', { auth: authCod(), pesta: { id: t?.id, asignaturaId: S.asigId, titulo: $('#pt').value.trim(), icono: $('#pi').value.trim() || 'fa-book', tipo: ty, contenido, visible: $('#pv').checked } });
      d.close(); toast('Módulo guardado.'); await loadAsigData(); route();
    } catch (ex) { $('#per').textContent = ex.message; }
  };
}
async function dlgAsignatura() {
  try {
    if (!S.profesores.length) S.profesores = await API.call('getProfesores', { auth: authCod() });
    if (!S.estudiantes.length) S.estudiantes = await API.call('getEstudiantes', { auth: authCod() });
  } catch { /* se cargan al enviar de nuevo */ }
  const gs = [...new Set(S.estudiantes.map(e => e.grupo))];
  const d = dialog('Nueva asignatura', `<form id="af">
  <div class="fld"><label>Nombre</label><div class="in"><input id="an" required placeholder="Ej. Hebreo Bíblico I"></div></div>
  <div class="fld"><label>Descripción</label><div class="in"><input id="ad" placeholder="Breve resumen de la asignatura"></div></div>
  <div class="fld"><label>Color del banner</label><div class="in"><input id="ac" type="color" value="${C.tema.navy}" style="height:2.6rem;padding:.3rem"></div></div>
  <div class="fld"><label>Profesor</label><div class="in"><select id="ap"><option value="">Sin asignar (por ahora)</option><option value="__nuevo__">Nuevo profesor…</option>${S.profesores.map(pr => `<option value="${esc(pr.usuario)}">${esc(pr.nombre)} · ${esc(pr.usuario)}</option>`).join('')}</select></div></div>
  <div id="apn" style="display:none"><div class="fld"><label>Nombre del nuevo profesor</label><div class="in"><input id="apnn" placeholder="Ej. Prof. Juan Pérez"></div></div>
  <div class="fld"><label>Correo (opcional, para enviarle las credenciales)</label><div class="in"><input id="apne" type="email" placeholder="profesor@correo.com"></div></div></div>
  <div class="fld"><label>Matricular grupos completos</label><div class="chklist" id="ags">${gs.map(g => `<label><input type="checkbox" value="${esc(g)}"> ${esc(g)}</label>`).join('') || '<p style="color:var(--mut);padding:.4rem">Aún no hay grupos en la base de estudiantes.</p>'}</div></div>
  <p style="color:var(--mut);font-size:.84rem;margin:0">El profesor recibirá sus credenciales si es nuevo y podrá montar la asignatura desde su cuenta.</p>
  <div class="err" id="aer"></div><button class="btn" type="submit"><i class="fas fa-plus"></i> Crear asignatura</button></form>`);
  $('#ap').onchange = () => $('#apn').style.display = $('#ap').value === '__nuevo__' ? '' : 'none';
  $('#af').onsubmit = async e => {
    e.preventDefault();
    try {
      const r = await API.call('saveAsignatura', { auth: authCod(), asig: {
        nombre: $('#an').value.trim(), descripcion: $('#ad').value.trim(), color: $('#ac').value,
        profesorUsuario: $('#ap').value,
        profesorNuevo: { nombre: $('#apnn')?.value.trim() || '', email: $('#apne')?.value.trim() || '' },
        grupos: $$('#ags input:checked').map(i => i.value)
      } });
      d.close(); await loadAsigs(); shell(); nav('asignaturas');
      if (r.credenciales) dlgCredenciales(r.credenciales); else toast('Asignatura creada.');
    } catch (ex) { $('#aer').textContent = ex.message; }
  };
}
async function dlgMatricularGrupo() {
  if (!S.estudiantes.length) S.estudiantes = await API.call('getCandidatosMatricula', { auth: authCod(), asigId: S.asigId });
  const gs = [...new Set(S.estudiantes.map(e => e.grupo))];
  const d = dialog('Añadir un grupo completo', `<form id="gf"><div class="fld"><label>Grupo</label><div class="in"><select id="gg">${gs.map(g => `<option>${esc(g)}</option>`).join('')}</select></div></div>
  <p style="color:var(--mut);font-size:.86rem">Se añadirán todos los estudiantes de ese grupo que aún no estén matriculados.</p>
  <div class="err" id="ger"></div><button class="btn" type="submit"><i class="fas fa-users"></i> Añadir grupo</button></form>`);
  $('#gf').onsubmit = async e => {
    e.preventDefault();
    try { const r = await API.call('matricularGrupo', { auth: authCod(), asigId: S.asigId, grupo: $('#gg').value }); d.close(); toast(r.n + ' estudiante(s) añadidos.'); await loadAsigData(); route(); }
    catch (ex) { $('#ger').textContent = ex.message; }
  };
}
async function dlgMatricularAlumnos() {
  if (!S.estudiantes.length) S.estudiantes = await API.call('getCandidatosMatricula', { auth: authCod(), asigId: S.asigId });
  const ya = new Set(S.matriculados.map(m => m.usuario));
  const libres = S.estudiantes.filter(e => !ya.has(e.usuario));
  const d = dialog('Añadir alumnos individualmente', `<input class="fld" style="width:100%;border:1px solid var(--line);border-radius:10px;padding:.6rem .8rem;font:inherit" id="msq" placeholder="Buscar por nombre o grupo…">
  <form id="mf"><div class="chklist" id="mlist">${[...new Set(libres.map(e => e.grupo))].map(g => `<div class="gh">${esc(g)}</div>` + libres.filter(e => e.grupo === g).map(e => `<label><input type="checkbox" value="${esc(e.usuario)}" data-b="${esc(norm(e.nombre + ' ' + e.grupo))}"> ${esc(e.nombre)} ${e.estado !== 'Activo' ? '<span class="badge off">Inactivo</span>' : ''}</label>`).join('')).join('') || '<p style="color:var(--mut);padding:.6rem">Todos los estudiantes ya están matriculados.</p>'}</div>
  <div class="err" id="mer"></div><button class="btn" type="submit"><i class="fas fa-user-plus"></i> Añadir seleccionados</button></form>`);
  $('#msq').oninput = () => { const q = norm($('#msq').value); $$('#mlist label').forEach(l => l.style.display = !q || norm(l.querySelector('input').dataset.b).includes(q) ? '' : 'none'); $$('#mlist .gh').forEach(h => h.style.display = q ? 'none' : ''); };
  $('#mf').onsubmit = async e => {
    e.preventDefault();
    try {
      const us = $$('#mlist input:checked').map(i => i.value);
      if (!us.length) return $('#mer').textContent = 'Marca al menos un estudiante.';
      const r = await API.call('matricular', { auth: authCod(), asigId: S.asigId, usuarios: us });
      d.close(); toast(r.n + ' estudiante(s) añadidos.'); await loadAsigData(); route();
    } catch (ex) { $('#mer').textContent = ex.message; }
  };
}

/* ----- dirección: profesores, credenciales e importación ----- */
async function dlgAsignarProfesor(asigId) {
  const a = S.asigs.find(x => x.id === asigId);
  try { if (!S.profesores.length) S.profesores = await API.call('getProfesores', { auth: authCod() }); } catch { /* reintenta al enviar */ }
  const d = dialog('Asignar profesor', `<form id="apf">
  <p style="color:var(--mut);font-size:.88rem;margin:0">Asignatura: <b>${esc(a?.nombre || '')}</b></p>
  <div class="fld"><label>Profesor</label><div class="in"><select id="apu"><option value="">— Elegir profesor —</option>${S.profesores.map(pr => `<option value="${esc(pr.usuario)}"${a && a.profesor === pr.usuario ? ' selected' : ''}>${esc(pr.nombre)} · ${esc(pr.usuario)}</option>`).join('')}<option value="__nuevo__">Nuevo profesor…</option></select></div></div>
  <div id="apn2" style="display:none"><div class="fld"><label>Nombre del nuevo profesor</label><div class="in"><input id="apn2n" placeholder="Ej. Prof. Juan Pérez"></div></div>
  <div class="fld"><label>Correo (opcional, para enviarle las credenciales)</label><div class="in"><input id="apn2e" type="email" placeholder="profesor@correo.com"></div></div></div>
  <p style="color:var(--mut);font-size:.84rem;margin:0">Si eliges «Nuevo profesor», se crearán su usuario y contraseña automáticamente para que entre a montar la asignatura.</p>
  <div class="err" id="aper"></div><button class="btn" type="submit"><i class="fas fa-user-check"></i> Asignar profesor</button></form>`);
  $('#apu').onchange = () => $('#apn2').style.display = $('#apu').value === '__nuevo__' ? '' : 'none';
  $('#apf').onsubmit = async e => {
    e.preventDefault();
    try {
      const nuevo = $('#apu').value === '__nuevo__';
      if (!nuevo && !$('#apu').value) return $('#aper').textContent = 'Elige un profesor o crea uno nuevo.';
      const r = await API.call('setProfesorAsignatura', { auth: authCod(), asigId, modo: nuevo ? 'nuevo' : 'existente', usuario: $('#apu').value, nombre: $('#apn2n')?.value.trim() || '', email: $('#apn2e')?.value.trim() || '' });
      d.close(); await loadAsigs(); route();
      if (r.credenciales) dlgCredenciales(r.credenciales); else toast('Profesor asignado.');
    } catch (ex) { $('#aper').textContent = ex.message; }
  };
}
function dlgProfesorNuevo() {
  const d = dialog('Añadir profesor', `<form id="pnf">
  <div class="fld"><label>Nombre completo</label><div class="in"><input id="pnn" required placeholder="Ej. Prof. Juan Pérez"></div></div>
  <div class="fld"><label>Correo (opcional, para enviarle las credenciales)</label><div class="in"><input id="pne" type="email" placeholder="profesor@correo.com"></div></div>
  <p style="color:var(--mut);font-size:.84rem;margin:0">Se generarán automáticamente su usuario y contraseña. Podrás copiarlos al cerrar.</p>
  <div class="err" id="pner"></div><button class="btn" type="submit"><i class="fas fa-user-plus"></i> Crear cuenta de profesor</button></form>`);
  $('#pnf').onsubmit = async e => {
    e.preventDefault();
    try {
      const r = await API.call('saveProfesor', { auth: authCod(), prof: { nombre: $('#pnn').value.trim(), email: $('#pne').value.trim() } });
      d.close(); toast('Profesor creado.'); dlgCredenciales(r.credenciales); route();
    } catch (ex) { $('#pner').textContent = ex.message; }
  };
}
function dlgCredenciales(c) {
  const d = dialog('Credenciales del profesor', `<p style="margin:0">Entrégale estas credenciales a <b>${esc(c.nombre)}</b> para que entre a la plataforma como <b>Profesor</b>:</p>
  <div class="credbox">
    <div><span>Usuario</span><b class="mono">${esc(c.usuario)}</b></div>
    <div><span>Contraseña</span><b class="mono">${esc(c.clave)}</b></div>
    ${c.email ? `<div><span>Correo</span><b>${esc(c.email)}</b></div>` : ''}
  </div>
  <div style="display:flex;gap:.6rem;flex-wrap:wrap">
    <button class="btn" id="ccopy"><i class="fas fa-copy"></i> Copiar credenciales</button>
    <button class="btn sec" id="cwmsg"><i class="fas fa-envelope"></i> Copiar mensaje de bienvenida</button>
  </div>
  <p style="color:var(--mut);font-size:.8rem;margin:0">La contraseña solo se muestra ahora. Cópiala antes de cerrar; después puedes generar otra con «Nueva clave».</p>`);
  const copiar = async txt => {
    try { await navigator.clipboard.writeText(txt); toast('Copiado al portapapeles.'); }
    catch { const t = document.createElement('textarea'); t.value = txt; document.body.append(t); t.select(); document.execCommand('copy'); t.remove(); toast('Copiado al portapapeles.'); }
  };
  $('#ccopy').onclick = () => copiar(`Usuario: ${c.usuario}\nContraseña: ${c.clave}`);
  $('#cwmsg').onclick = () => copiar(`¡Bienvenido(a) a la ${C.app}!\n\nEntra como PROFESOR con:\nUsuario: ${c.usuario}\nContraseña: ${c.clave}\n\nDesde tu asignatura podrás montar los módulos, exámenes, anuncios y abrir el foro de dudas.`);
}
function dlgImportar() {
  const d = dialog('Importar lista de estudiantes', `<form id="imf">
  <p style="color:var(--mut);font-size:.86rem;margin:0">Pega aquí tu lista, una persona por línea. Formato: <code>Nombre, Grupo, Usuario, Contraseña, Estado</code>. También acepta punto y coma o tabulaciones (copiado directo desde Google Sheets).</p>
  <div class="fld"><div class="in"><textarea id="imt" rows="9" placeholder="José Pérez, 1.er año, jose.perez, abc12345, Activo"></textarea></div></div>
  <div class="err" id="imer"></div><button class="btn" type="submit"><i class="fas fa-file-import"></i> Importar</button></form>`);
  $('#imf').onsubmit = async e => {
    e.preventDefault();
    try {
      const r = await API.call('importarEstudiantes', { auth: authCod(), texto: $('#imt').value });
      d.close(); toast(`Importación lista: ${r.nuevos} nuevos, ${r.actualizados} actualizados.`); route();
    } catch (ex) { $('#imer').textContent = ex.message; }
  };
}

/* ---------- vistas del personal ---------- */
VIEW.asignaturas = () => {
  const dir = esDir();
  return `<div class="ph"><h2>${dir ? 'Todas las asignaturas' : 'Mis asignaturas'}</h2><p>${dir ? 'Crea asignaturas, asigna profesores con sus credenciales y entra a cualquiera de ellas.' : 'La dirección te asigna las asignaturas; aquí las montas y modificas con total libertad.'}</p></div>
  ${dir ? `<div class="rowtools"><button class="btn" data-act="newasig"><i class="fas fa-plus"></i> Nueva asignatura</button><button class="btn sec" data-act="profnew"><i class="fas fa-user-plus"></i> Añadir profesor</button></div>` : ''}
  <div class="grid gA">${S.asigs.map(a => `<article class="card asigcard" style="border-top:5px solid ${esc(a.color || '#14385c')}">
    <h3>${esc(a.nombre)}</h3>
    <p style="color:var(--mut);font-size:.88rem">${esc(a.descripcion || '')}</p>
    <p style="font-size:.82rem;color:var(--mut);margin-bottom:.8rem"><i class="fas fa-chalkboard-user"></i> ${a.profesorNombre ? esc(a.profesorNombre) : '<span class="badge off">Sin profesor asignado</span>'}</p>
    <div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-top:auto">
      <button class="btn sm" data-act="asigopen" data-id="${a.id}"><i class="fas fa-arrow-right"></i> Abrir asignatura</button>
      ${dir ? `<button class="btn sec sm" data-act="asigprof" data-id="${a.id}"><i class="fas fa-user-check"></i> ${a.profesorNombre ? 'Cambiar profesor' : 'Asignar profesor'}</button>` : ''}
      ${dir ? `<button class="ibtn" data-act="asigdel2" data-id="${a.id}" title="Eliminar asignatura"><i class="fas fa-trash"></i></button>` : ''}
    </div></article>`).join('')}
  ${dir ? `<button class="card" style="border:2px dashed var(--line);background:none;display:grid;place-items:center;min-height:170px;gap:.4rem;cursor:pointer" data-act="newasig"><i class="fas fa-plus" style="font-size:1.6rem;color:var(--navy)"></i><b style="color:var(--navy)">Nueva asignatura</b></button>` : ''}
  </div>
  ${esProf() && !S.asigs.length ? '<div class="empty" style="margin-top:1.1rem"><i class="fas fa-chalkboard-user"></i>Aún no tienes asignaturas asignadas. La dirección creará tu asignatura y te hará llegar tus credenciales de acceso.</div>' : ''}`;
};
VIEW.resumen = () => {
  const a = asig(); if (!a) return '<div class="notice">Selecciona una asignatura.</div>';
  const pm = progresoMedio();
  return `<div class="banner" style="background:linear-gradient(120deg,${esc(a.color || '#14385c')},#245a8f)"><div class="grow"><h2>${esc(a.nombre)}</h2><p>${esc(a.descripcion || '')}</p>
  <button class="btn sm gold" data-act="npesta"><i class="fas fa-layer-group"></i> Nuevo módulo</button><button class="btn sm" style="background:rgba(255,255,255,.15)" data-act="matgrupo"><i class="fas fa-users"></i> Matricular grupo</button><button class="btn sm" style="background:rgba(255,255,255,.15)" data-act="xnew"><i class="fas fa-clipboard-check"></i> Nuevo examen</button><button class="btn sm" style="background:rgba(255,255,255,.15)" data-act="nanuncio"><i class="fas fa-bullhorn"></i> Nuevo anuncio</button><button class="btn sm" style="background:rgba(255,255,255,.15)" data-act="navforo"><i class="fas fa-comments"></i> Foro de dudas</button></div></div>${ring(pm)}</div>
  <div class="grid g4" style="margin-bottom:1.2rem">
  <div class="card stat"><i class="fas fa-user-graduate"></i><div><b>${S.matriculados.length}</b><span>Estudiantes matriculados</span></div></div>
  <div class="card stat"><i class="fas fa-layer-group"></i><div><b>${S.pestanas.length}</b><span>Módulos</span></div></div>
  <div class="card stat"><i class="fas fa-clipboard-check"></i><div><b>${S.examenes.length}</b><span>Exámenes</span></div></div>
  <div class="card stat"><i class="fas fa-bullhorn"></i><div><b>${S.anuncios.length}</b><span>Anuncios</span></div></div></div>
  <div class="grid g2"><div class="card"><h3><i class="fas fa-chart-line"></i> Progreso medio del grupo</h3><p style="color:var(--mut);font-size:.88rem;margin-bottom:.7rem">Módulos completados y quizzes realizados.</p><div class="bar" style="height:12px"><i style="width:${pm}%"></i></div><p style="margin-top:.5rem"><b>${pm}%</b> de media · ${S.matriculados.length} estudiantes</p></div>
  <div class="card"><h3><i class="fas fa-clock-rotate-left"></i> Actividad reciente</h3><ul class="list">${S.progreso.slice(-6).reverse().map(g => `<li><i class="fas ${g.tipo === 'examen' ? 'fa-clipboard-check' : 'fa-circle-check'}"></i><div>${esc(g.nombre || g.usuario)}<small>${g.tipo === 'examen' ? 'Realizó un quiz' : 'Completó un módulo'} · ${fmtDT(g.fecha)}</small></div></li>`).join('') || '<li><i class="fas fa-circle-info"></i><div>Sin actividad aún</div></li>'}</ul></div></div>`;
};
VIEW.gestionModulos = () => `<div class="ph"><h2>Módulos y pestañas</h2><p>Crea, ordena y publica el contenido de ${esc(asig()?.nombre || 'la asignatura')}.</p></div>
<div class="rowtools"><button class="btn" data-act="npesta"><i class="fas fa-plus"></i> Nuevo módulo</button><span class="tag navy">${S.pestanas.length} módulos</span></div>
${S.pestanas.map((m, i) => `<div class="mrow"><span style="width:40px;height:40px;border-radius:10px;background:var(--navy-l);color:var(--navy);display:grid;place-items:center;flex:none"><i class="fas ${esc(m.icono || 'fa-book')}"></i></span>
<div class="grow"><b>${esc(m.titulo)}</b><small>${TIPOS[m.tipo]?.[0] || m.tipo} · posición ${i + 1}</small></div>
<span class="badge ${m.visible !== false ? '' : 'off'}">${m.visible !== false ? 'Visible' : 'Oculto'}</span>
<span class="acts"><button class="ibtn" data-act="pmup" data-id="${m.id}" title="Subir"><i class="fas fa-chevron-up"></i></button>
<button class="ibtn" data-act="pmdown" data-id="${m.id}" title="Bajar"><i class="fas fa-chevron-down"></i></button>
<button class="ibtn" data-act="pmvis" data-id="${m.id}" title="Mostrar u ocultar"><i class="fas ${m.visible !== false ? 'fa-eye' : 'fa-eye-slash'}"></i></button>
<button class="ibtn" data-act="pmedit" data-id="${m.id}" title="Editar"><i class="fas fa-pen"></i></button>
<button class="ibtn" data-act="pmdel" data-id="${m.id}" title="Eliminar"><i class="fas fa-trash"></i></button></span></div>`).join('') || '<div class="empty"><i class="fas fa-layer-group"></i>Todavía no hay módulos. Crea el primero.</div>'}`;
VIEW.gestionExamenes = () => `<div class="ph"><h2>Exámenes</h2><p>Quizzes de selección múltiple (y verdadero/falso) con corrección automática.</p></div>
<div class="rowtools"><button class="btn" data-act="xnew"><i class="fas fa-plus"></i> Nuevo examen</button><span class="tag navy">${S.examenes.length} exámenes</span></div>
${S.examenes.map(x => `<div class="mrow"><span style="width:40px;height:40px;border-radius:10px;background:var(--navy-l);color:var(--navy);display:grid;place-items:center;flex:none"><i class="fas fa-clipboard-check"></i></span>
<div class="grow"><b>${esc(x.titulo)}</b><small>${esc(x.descripcion || '')} · ${x.nPreg || 0} preguntas</small></div>
<span class="badge ${x.visible !== false ? '' : 'off'}">${x.visible !== false ? 'Visible' : 'Oculto'}</span>
<span class="acts"><a class="btn sec sm" href="#/resultados/${x.id}"><i class="fas fa-chart-simple"></i> Resultados</a>
<a class="btn sec sm" href="#/examen-editar/${x.id}"><i class="fas fa-pen"></i> Editar</a>
<button class="ibtn" data-act="xvis" data-id="${x.id}" title="Mostrar u ocultar"><i class="fas ${x.visible !== false ? 'fa-eye' : 'fa-eye-slash'}"></i></button>
<button class="ibtn" data-act="xdel" data-id="${x.id}" title="Eliminar"><i class="fas fa-trash"></i></button></span></div>`).join('') || '<div class="empty"><i class="fas fa-clipboard-check"></i>Todavía no hay exámenes.</div>'}`;
VIEW['examen-editar'] = () => {
  const e = S.editExam;
  return `<div class="ph"><h2>Editor de examen</h2><p>${esc(asig()?.nombre || '')}</p></div>
  <form id="ef"><div class="card" style="margin-bottom:1.1rem">
  <div class="fld"><label>Título del examen</label><div class="in"><input id="et" required value="${esc(e.titulo || '')}"></div></div>
  <div class="fld"><label>Descripción</label><div class="in"><input id="ed" value="${esc(e.descripcion || '')}"></div></div>
  <label style="display:flex;gap:.5rem;align-items:center;font-size:.9rem"><input type="checkbox" id="ev" ${e.visible !== false ? 'checked' : ''}> Visible para los estudiantes</label></div>
  <h3 style="margin-bottom:.7rem">Preguntas (${S.editQs.length})</h3><div id="qlist"></div>
  <div class="rowtools"><button class="btn sec" type="button" data-act="qadd"><i class="fas fa-plus"></i> Añadir pregunta</button>
  <button class="btn" type="submit"><i class="fas fa-check"></i> Guardar examen</button>
  <a class="btn sec" href="#/examenes">Cancelar</a></div></form>`;
};
function qcardHtml(q, i) {
  const type = q.tipo || 'sm', meta = q.metadata || {}, autoChoice = ['sm','vf'].includes(type);
  const ops = type === 'vf' ? ['Verdadero','Falso'] : (q.opciones || ['','','','']);
  let detail = '';
  if (type === 'sm' || type === 'vf') detail = `<div class="opts">${ops.map((o,k)=>`<div><input type="radio" name="c${i}" data-f="correcta" value="${k}" ${q.correcta===k?'checked':''}><input type="text" data-oi="${k}" data-f="opt" value="${esc(o)}" placeholder="Opción ${k+1}" ${type==='vf'?'disabled':''}></div>`).join('')}</div><small>Selecciona la respuesta correcta.</small>`;
  else if (type === 'emp') detail = `<div class="fld"><label>Respuesta(s) correcta(s), separadas por |</label><input data-f="accepted" value="${esc((meta.accepted||[]).join(' | '))}" placeholder="λόγος | logos"></div>`;
  else if (type === 'rel') detail = `<div class="fld"><label>Pares correctos (una línea por par: elemento izquierdo | correspondencia)</label><textarea data-f="pairs" rows="5">${esc((meta.pairs||[]).map(p=>p.left+' | '+p.right).join('\n'))}</textarea></div>`;
  else detail = `<div class="fld"><label>Orientación / criterios para el profesor</label><textarea data-f="rubric" rows="3">${esc(meta.rubric||'')}</textarea><small>La respuesta del estudiante será evaluada manualmente.</small></div>`;
  return `<div class="qcard" data-qi="${i}"><div class="qh"><b>Pregunta ${i+1}</b><span class="grow"></span>${i>0?'<button type="button" class="ibtn" data-act="qup"><i class="fas fa-chevron-up"></i></button>':''}${i<S.editQs.length-1?'<button type="button" class="ibtn" data-act="qdown"><i class="fas fa-chevron-down"></i></button>':''}<button type="button" class="ibtn" data-act="qdel"><i class="fas fa-trash"></i></button></div>
  <div style="display:flex;gap:.6rem;flex-wrap:wrap"><select data-f="tipo" style="max-width:260px"><option value="sm" ${type==='sm'?'selected':''}>Selección múltiple</option><option value="vf" ${type==='vf'?'selected':''}>Verdadero / Falso</option><option value="emp" ${type==='emp'?'selected':''}>Completar (automática)</option><option value="rel" ${type==='rel'?'selected':''}>Relacionar (automática)</option><option value="comprension" ${type==='comprension'?'selected':''}>Comprensión (profesor)</option><option value="red" ${type==='red'?'selected':''}>Desarrollo (profesor)</option></select><input type="number" data-f="puntos" min="0.25" max="100" step="0.25" style="max-width:120px" value="${q.puntos||2}" title="Puntos"></div>
  <textarea data-f="texto" rows="2" placeholder="Enunciado de la pregunta">${esc(q.texto||'')}</textarea>${detail}</div>`;
}
function renderQs() { const el = $('#qlist'); if (el) el.innerHTML = S.editQs.map(qcardHtml).join(''); }
VIEW.resultados = id => {
  const x = S.examenes.find(e => e.id === id); if (!x) return '<div class="notice">Examen no encontrado.</div>';
  const map = {};
  S.resIntentos.forEach(i => {
    const o = map[i.usuario] || (map[i.usuario] = { nombre: i.nombre, n: 0, mejor: null, total: null, ultimo: null });
    o.n++; if (o.mejor == null || i.puntaje > o.mejor) { o.mejor = i.puntaje; o.total = i.total; } o.ultimo = i.fecha;
  });
  S.matriculados.forEach(m => { if (!map[m.usuario]) map[m.usuario] = { nombre: m.nombre, n: 0, mejor: null, total: null, ultimo: null }; });
  const filas = Object.entries(map).sort((a, b) => a[1].nombre.localeCompare(b[1].nombre));
  const pendientes = S.resIntentos.filter(i => i.estadoRevision === 'pending');
  return `<div class="ph"><h2>Resultados · ${esc(x.titulo)}</h2><p>${S.resIntentos.length} intentos registrados por ${filas.length} estudiantes · ${pendientes.length} pendientes de revisión.</p></div>
  <div class="rowtools"><a class="btn sec sm" href="#/examenes"><i class="fas fa-arrow-left"></i> Exámenes</a><button class="btn sm" data-act="csvres" data-id="${x.id}"><i class="fas fa-file-csv"></i> Exportar CSV</button></div>
  ${pendientes.length ? `<div class="card" style="margin-bottom:1rem"><h3>Respuestas pendientes de revisión</h3>${pendientes.map(i=>`<div class="mrow"><div class="grow"><b>${esc(i.nombre)}</b><small>${fmtDT(i.fecha)} · ${i.puntaje}/${i.total} puntos automáticos</small></div><a class="btn sm" href="#/revision/${i.id}">Revisar respuestas</a></div>`).join('')}</div>` : ''}
  <div class="card tw"><table><thead><tr><th>Estudiante</th><th>Grupo</th><th>Intentos</th><th>Mejor nota</th><th>Último intento</th></tr></thead><tbody>
  ${filas.map(([u, o]) => { const m = S.matriculados.find(m2 => m2.usuario === u); return `<tr><td><b>${esc(o.nombre)}</b></td><td>${esc(m?.grupo || '')}</td><td>${o.n || '—'}</td><td>${o.mejor != null ? `${o.mejor}/${o.total}` : '—'}</td><td>${o.ultimo ? fmtDT(o.ultimo) : '—'}</td></tr>`; }).join('') || '<tr><td colspan="5" style="text-align:center;color:var(--mut)">Sin matriculados.</td></tr>'}
  </tbody></table></div>`;
};
VIEW.revision = () => {
  const d = S.reviewAttempt; if (!d?.intento) return '<div class="notice">Intento no encontrado.</div>';
  const a = d.intento;
  return `<div class="ph"><h2>Revisión del examen</h2><p>${esc(a.nombre)} · ${fmtDT(a.fecha)}</p></div>
  <form id="reviewform"><div class="card"><h3>Calificación automática: ${a.puntaje}/${a.total}</h3>
  ${d.preguntas.filter(q=>['comprension','red'].includes(q.tipo)).map(q=>{const ans=a.respuestas.find(x=>x.preguntaId===q.id);return `<section class="q"><h4>${esc(q.texto)} <span class="pts">· máximo ${q.puntos}</span></h4><div class="notice answer-submission" style="white-space:pre-wrap">${esc(ans?.respuesta||'Sin respuesta')}</div>${q.metadata?.rubric?`<p><b>Criterios:</b> ${esc(q.metadata.rubric)}</p>`:''}<label>Puntos otorgados</label><input type="number" name="score_${q.id}" min="0" max="${q.puntos}" step="0.25" value="0" required></section>`}).join('')}
  <div class="fld"><label>Observaciones para el estudiante</label><textarea id="reviewcomment" rows="4"></textarea></div>
  <button class="btn" type="submit">Guardar calificación final</button> <a class="btn sec" href="#/resultados/${a.examenId}">Volver a resultados</a></div></form>`;
};
VIEW.gestionAnuncios = lista => `<div class="ph"><h2>Anuncios</h2><p>Publica avisos para los estudiantes de ${esc(asig()?.nombre || 'la asignatura')}.</p></div>
<div class="card" style="margin-bottom:1.2rem"><form id="af2"><input type="hidden" id="aid">
<div class="g2" style="gap:.8rem"><div class="fld"><label>Título</label><div class="in"><input id="at" required></div></div>
<div class="fld"><label>Etiqueta</label><div class="in"><input id="ag" placeholder="Bienvenida, Fechas, Importante…"></div></div></div>
<div class="fld"><label>Texto</label><div class="in"><textarea id="ab" rows="4" required></textarea></div></div>
<label style="display:flex;gap:.5rem;align-items:center;font-size:.9rem;margin-bottom:.8rem"><input type="checkbox" id="ap"> Fijar arriba</label>
<div class="rowtools" style="margin-bottom:0"><button class="btn" type="submit" id="abtn"><i class="fas fa-bullhorn"></i> Publicar anuncio</button><button class="btn sec" type="button" id="acan" style="display:none" data-act="acancel">Cancelar edición</button></div></form></div>
${lista || '<div class="empty"><i class="fas fa-bullhorn"></i>No hay anuncios todavía.</div>'}`;
VIEW.matrizProgreso = () => {
  const ms = S.pestanas, xs = S.examenes;
  const notas = {};
  (S.intentosAsig || []).forEach(i => { const o = notas[i.usuario] || (notas[i.usuario] = {}); if (o[i.examenId] == null || i.puntaje > o[i.examenId]) o[i.examenId] = i.puntaje; });
  const alumnos = [...S.matriculados].sort((a, b) => a.grupo.localeCompare(b.grupo) || a.nombre.localeCompare(b.nombre));
  const detalleMovil = alumnos.map(m => {
    const pr = progresoDe(m.usuario);
    const modulos = ms.map(mm => {
      const ok = S.progreso.some(y => y.usuario === m.usuario && y.tipo === 'pestaña' && y.itemId === mm.id && y.completado);
      return `<div class="progress-item"><span class="pi-icon"><i class="fas ${esc(mm.icono || 'fa-book')}"></i></span><span class="pi-name">${esc(mm.titulo)}</span><span class="pi-state ${ok ? 'is-done' : 'is-pending'}">${ok ? '<i class="fas fa-check"></i> Hecho' : 'Pendiente'}</span></div>`;
    }).join('');
    const examenes = xs.map(x => {
      const v = notas[m.usuario]?.[x.id];
      return `<div class="progress-item"><span class="pi-icon"><i class="fas fa-clipboard-check"></i></span><span class="pi-name">${esc(x.titulo)}</span><span class="pi-state ${v != null ? 'is-done' : 'is-pending'}">${v != null ? esc(v + ' pts') : 'Pendiente'}</span></div>`;
    }).join('');
    return `<article class="progress-student"><div class="ps-head"><div class="ps-person"><span class="ps-avatar">${esc(inicial(m.nombre))}</span><div><b>${esc(m.nombre)}</b><small>${esc(m.grupo || 'Sin grupo')}</small></div></div><div class="ps-percent"><b>${pr.pct}%</b><small>${pr.done} de ${pr.tot}</small></div></div><div class="bar ps-bar"><i style="width:${pr.pct}%"></i></div><div class="ps-details">${modulos || ''}${examenes || ''}${!ms.length && !xs.length ? '<p class="muted">Todavía no hay módulos ni exámenes.</p>' : ''}</div></article>`;
  }).join('');
  return `<div class="ph"><h2>Progreso del grupo</h2><p>${esc(asig()?.nombre || '')} · ${S.matriculados.length} estudiantes</p></div>
  <div class="progress-summary"><div><span>Estudiantes</span><b>${S.matriculados.length}</b></div><div><span>Módulos</span><b>${ms.length}</b></div><div><span>Exámenes</span><b>${xs.length}</b></div></div>
  <div class="rowtools"><button class="btn sm" data-act="csvmx"><i class="fas fa-file-csv"></i> Exportar CSV</button></div>
  <div class="card tw progress-desktop"><table class="mx"><thead><tr><th>Estudiante</th>${ms.map(m => `<th title="${esc(m.titulo)}"><i class="fas ${esc(m.icono || 'fa-book')}"></i> ${esc(m.titulo.length > 12 ? m.titulo.slice(0, 11) + '…' : m.titulo)}</th>`).join('')}${xs.map(x => `<th title="${esc(x.titulo)}"><i class="fas fa-clipboard-check"></i> ${esc(x.titulo.length > 12 ? x.titulo.slice(0, 11) + '…' : x.titulo)}</th>`).join('')}<th>Total</th></tr></thead><tbody>
  ${alumnos.map(m => {
    const pr = progresoDe(m.usuario);
    return `<tr><td><b>${esc(m.nombre)}</b><small style="display:block;color:var(--mut)">${esc(m.grupo)}</small></td>
    ${ms.map(mm => `<td>${S.progreso.some(y => y.usuario === m.usuario && y.tipo === 'pestaña' && y.itemId === mm.id && y.completado) ? '<i class="fas fa-circle-check ck"></i>' : '<i class="fas fa-circle nc"></i>'}</td>`).join('')}
    ${xs.map(x => { const v = notas[m.usuario]?.[x.id]; return `<td>${v != null ? v + ' pts' : '<i class="fas fa-circle nc"></i>'}</td>`; }).join('')}
    <td style="min-width:110px"><b>${pr.pct}%</b><div class="bar"><i style="width:${pr.pct}%"></i></div></td></tr>`;
  }).join('') || '<tr><td colspan="99" style="text-align:center;color:var(--mut)">Sin matriculados.</td></tr>'}
  </tbody></table></div>
  <div class="progress-mobile">${detalleMovil || '<div class="empty"><i class="fas fa-users"></i>No hay estudiantes matriculados.</div>'}</div>`;
};
VIEW.estudiantes = () => `<div class="ph"><h2>Estudiantes de la asignatura</h2><p>${esc(asig()?.nombre || '')} · ${S.matriculados.length} matriculados</p></div>
<div class="rowtools"><button class="btn" data-act="matgrupo"><i class="fas fa-users"></i> Añadir grupo completo</button>
<button class="btn sec" data-act="matalum"><i class="fas fa-user-plus"></i> Añadir alumnos</button>
${esDir() ? '<a class="btn sec" href="#/base"><i class="fas fa-database"></i> Base general de estudiantes</a>' : ''}</div>
<div class="card tw"><table><thead><tr><th>Estudiante</th><th>Grupo</th><th>Usuario</th><th>Estado</th><th></th></tr></thead><tbody>
${[...S.matriculados].sort((a, b) => a.grupo.localeCompare(b.grupo) || a.nombre.localeCompare(b.nombre)).map(m => `<tr><td><b>${esc(m.nombre)}</b></td><td>${esc(m.grupo)}</td><td class="mono">${esc(m.usuario)}</td><td><span class="badge ${m.estado === 'Activo' ? '' : 'off'}">${esc(m.estado)}</span></td><td>${esDir() ? `<button class="btn sec sm" data-act="quitar" data-user="${esc(m.usuario)}"><i class="fas fa-user-minus"></i> Quitar</button>` : '<span class="tag">Solo consulta</span>'}</td></tr>`).join('') || '<tr><td colspan="5" style="text-align:center;color:var(--mut);padding:1.4rem">Nadie matriculado aún. Usa «Añadir grupo completo».</td></tr>'}
</tbody></table></div>`;
VIEW.ajustes = () => { const a = asig(); return `<div class="ph"><h2>Ajustes de la asignatura</h2><p>Personaliza el nombre, la descripción y el color.</p></div>
<form id="ajf"><div class="card" style="margin-bottom:1.1rem">
<div class="fld"><label>Nombre</label><div class="in"><input id="ajn" required value="${esc(a?.nombre || '')}"></div></div>
<div class="fld"><label>Descripción</label><div class="in"><input id="ajd" value="${esc(a?.descripcion || '')}"></div></div>
<div class="fld"><label>Color</label><div class="in"><input id="ajc" type="color" value="${esc(a?.color || '#14385c')}" style="height:2.6rem;padding:.3rem"></div></div>
<button class="btn" type="submit"><i class="fas fa-check"></i> Guardar cambios</button></div></form>
${esDir() ? `<div class="card" style="margin-bottom:1.1rem"><h3><i class="fas fa-chalkboard-user"></i> Profesor de la asignatura</h3><p style="color:var(--mut);font-size:.88rem;margin-bottom:.8rem">Profesor actual: <b>${esc(a?.profesorNombre || '— sin asignar —')}</b>. Puedes asignar otro; si es nuevo, se generan sus credenciales para que entre a montar la asignatura.</p>
<button class="btn sec" data-act="asigprof" data-id="${esc(a?.id || '')}"><i class="fas fa-user-check"></i> Asignar o cambiar profesor</button></div>` : ''}
${esDir() ? `<div class="card"><h3 style="color:var(--flame)">Zona de riesgo</h3><p style="color:var(--mut);font-size:.88rem;margin-bottom:.8rem">Eliminar la asignatura borra también sus módulos, exámenes, notas, progreso y anuncios.</p>
<button class="btn warn" data-act="asigdel"><i class="fas fa-trash"></i> Eliminar asignatura</button></div>` : ''}`; };
VIEW.direccion = () => {
  const r = S.resumen || {};
  return `<div class="ph"><h2>Panel de dirección</h2><p>${labelRol(rol())} · acceso total: asignaturas, profesores, grupos y base de estudiantes.</p></div>
  <div class="grid g4" style="margin-bottom:1.2rem">
  <div class="card stat"><i class="fas fa-users"></i><div><b>${r.totales?.estudiantes ?? '—'}</b><span>Estudiantes</span></div></div>
  <div class="card stat"><i class="fas fa-user-check"></i><div><b>${r.totales?.activos ?? '—'}</b><span>Activos</span></div></div>
  <div class="card stat"><i class="fas fa-chalkboard-user"></i><div><b>${r.totales?.profesores ?? (S.profesores?.length ?? '—')}</b><span>Profesores</span></div></div>
  <div class="card stat"><i class="fas fa-graduation-cap"></i><div><b>${r.totales?.asignaturas ?? '—'}</b><span>Asignaturas</span></div></div></div>
  <div class="rowtools"><a class="btn" href="#/base"><i class="fas fa-database"></i> Base de datos de estudiantes</a>
  <button class="btn sec" data-act="profnew"><i class="fas fa-user-plus"></i> Añadir profesor</button>
  <button class="btn gold" data-act="newasig"><i class="fas fa-plus"></i> Nueva asignatura</button></div>
  <div class="grid g2">
  <div class="card tw"><h3><i class="fas fa-chalkboard-user"></i> Profesores</h3><table><thead><tr><th>Nombre</th><th>Usuario</th><th>Estado</th><th></th></tr></thead><tbody>
  ${(S.profesores || []).map(pr => `<tr><td><b>${esc(pr.nombre)}</b>${pr.email ? `<small style="display:block;color:var(--mut)">${esc(pr.email)}</small>` : ''}</td><td class="mono">${esc(pr.usuario)}</td><td><span class="badge ${pr.estado === 'Activo' ? '' : 'off'}">${esc(pr.estado)}</span></td><td style="white-space:nowrap"><button class="ibtn" data-act="profreset" data-user="${esc(pr.usuario)}" title="Generar nueva clave"><i class="fas fa-key"></i></button><button class="ibtn" data-act="profdel" data-user="${esc(pr.usuario)}" title="Eliminar"><i class="fas fa-trash"></i></button></td></tr>`).join('') || '<tr><td colspan="4" style="text-align:center;color:var(--mut)">Sin profesores aún. Usa «Añadir profesor».</td></tr>'}</tbody></table></div>
  <div class="card tw"><h3><i class="fas fa-graduation-cap"></i> Asignaturas</h3><table><thead><tr><th>Asignatura</th><th>Profesor</th><th>Alumnos</th><th>Progreso</th><th></th></tr></thead><tbody>
  ${(r.asignaturas || []).map(a => `<tr><td><b>${esc(a.nombre)}</b></td><td>${a.profesorNombre ? esc(a.profesorNombre) : '<span class="badge off">Sin asignar</span>'}</td><td>${a.estudiantes}</td><td style="min-width:90px"><div class="bar"><i style="width:${a.progresoMedio || 0}%"></i></div><small>${a.progresoMedio || 0}%</small></td><td style="white-space:nowrap"><button class="btn sec sm" data-act="asigopen" data-id="${a.id}">Abrir</button> <button class="btn sec sm" data-act="asigprof" data-id="${a.id}" title="Asignar profesor"><i class="fas fa-user-check"></i></button></td></tr>`).join('') || '<tr><td colspan="5" style="text-align:center;color:var(--mut)">Aún no hay asignaturas.</td></tr>'}</tbody></table></div></div>
  <div class="card tw" style="margin-top:1.1rem"><h3><i class="fas fa-sitemap"></i> Grupos</h3><table><thead><tr><th>Grupo</th><th>Total</th><th>Activos</th><th>Inactivos</th></tr></thead><tbody>
  ${(r.grupos || []).map(g => `<tr><td>${esc(g.grupo)}</td><td><b>${g.total}</b></td><td>${g.activos}</td><td>${g.inactivos || '—'}</td></tr>`).join('')}</tbody></table></div>`;
};
VIEW.base = () => {
  S.grupos = [...new Set(S.estudiantes.map(e => e.grupo))];
  return `<div class="ph"><h2>Base de datos de estudiantes</h2><p>${S.estudiantes.length} registros · los cambios se guardan de forma segura en Supabase.</p></div>
  <div class="rowtools"><button class="btn" data-act="badd"><i class="fas fa-user-plus"></i> Añadir estudiante</button>
  <button class="btn sec" data-act="bimp"><i class="fas fa-file-import"></i> Importar lista (pegar)</button>
  <div class="fld" style="margin:0"><div class="in"><input id="bsq" placeholder="Buscar…"></div></div>
  <div class="fld" style="margin:0"><div class="in"><select id="bgr"><option value="">Todos los grupos</option>${S.grupos.map(g => `<option>${esc(g)}</option>`).join('')}</select></div></div></div>
  <div class="card tw"><table id="btab"><thead><tr><th>Nombre</th><th>Grupo</th><th>Usuario</th><th>Contraseña</th><th>Estado</th><th></th></tr></thead><tbody>
  ${[...S.estudiantes].sort((a, b) => a.grupo.localeCompare(b.grupo) || a.nombre.localeCompare(b.nombre)).map(e => `<tr data-b="${esc(norm(e.nombre + ' ' + e.grupo + ' ' + e.usuario))}" data-g="${esc(e.grupo)}"><td><b>${esc(e.nombre)}</b></td><td>${esc(e.grupo)}</td><td class="mono">${esc(e.usuario)}</td><td class="mono">${esc(e.clave)}</td><td><span class="badge ${e.estado === 'Activo' ? '' : 'off'}">${esc(e.estado)}</span></td><td style="white-space:nowrap"><button class="ibtn" data-act="btoggle" data-id="${e.id}" title="Activar/Desactivar"><i class="fas fa-power-off"></i></button><button class="ibtn" data-act="bedit" data-id="${e.id}" title="Editar"><i class="fas fa-pen"></i></button><button class="ibtn" data-act="bdel" data-id="${e.id}" title="Eliminar"><i class="fas fa-trash"></i></button></td></tr>`).join('')}
  </tbody></table></div>`;
};

/* ---------- diálogos de la base de estudiantes ---------- */
function dlgEstudiante(e) {
  const gs = [...new Set(S.estudiantes.map(x => x.grupo))];
  const d = dialog(e ? 'Editar estudiante' : 'Añadir estudiante', `<form id="ef2">
  <div class="fld"><label>Nombre completo</label><div class="in"><input id="en" required value="${esc(e?.nombre || '')}"></div></div>
  <div class="fld"><label>Grupo</label><div class="in"><input id="eg" list="gls" required value="${esc(e?.grupo || '')}" placeholder="Ej. 1.er año"><datalist id="gls">${gs.map(g => `<option value="${esc(g)}">`).join('')}</datalist></div></div>
  <div class="fld"><label>Usuario</label><div class="in"><input id="eu" required autocapitalize="none" value="${esc(e?.usuario || '')}"></div></div>
  <div class="fld"><label>Contraseña</label><div class="in"><input id="ep" required value="${esc(e?.clave || '')}"></div></div>
  <div class="fld"><label>Estado</label><div class="in"><select id="es"><option${e?.estado !== 'Inactivo' ? ' selected' : ''}>Activo</option><option${e?.estado === 'Inactivo' ? ' selected' : ''}>Inactivo</option></select></div></div>
  <div class="err" id="eer"></div><button class="btn" type="submit"><i class="fas fa-check"></i> Guardar</button></form>`);
  $('#ef2').onsubmit = async ev => {
    ev.preventDefault();
    try {
      await API.call('saveEstudiante', { auth: authCod(), est: { id: e?.id, nombre: $('#en').value.trim(), grupo: $('#eg').value.trim(), usuario: $('#eu').value.trim(), clave: $('#ep').value.trim(), estado: $('#es').value } });
      d.close(); toast('Estudiante guardado.'); route();
    } catch (ex) { $('#eer').textContent = ex.message; }
  };
}

/* ---------- acciones globales ---------- */
document.addEventListener('click', async e => {
  if (e.target.closest('#dlg a[href^="#/"]')) $('#dlg').close();
  const t = e.target.closest('[data-act]'); if (!t) return;
  const a = t.dataset.act, id = t.dataset.id;
  const reroute = async () => { await loadAsigData(); route(); };
  try {
    if (a === 'mas') { e.preventDefault(); return dialog('Más secciones', [esEst() ? ['mis', 'fa-graduation-cap', 'Mis asignaturas'] : ['resumen', 'fa-gauge-high', 'Resumen'], ['anuncios', 'fa-bullhorn', 'Anuncios'], ['foro', 'fa-comments', 'Foro de dudas'], esEst() ? ['progreso', 'fa-chart-line', 'Mi progreso'] : ['progreso', 'fa-chart-line', 'Progreso'], esDir() ? ['base', 'fa-database', 'Base de estudiantes'] : null, esStaff() ? ['asignaturas', 'fa-graduation-cap', 'Asignaturas'] : null].filter(Boolean).map(n => `<a class="opt" href="#/${n[0]}"><i class="fas ${n[1]}"></i><span><b>${n[2]}</b></span></a>`).join('')); }
    if (a === 'reintentar') { S.resExamen = null; return route(); }
    if (a === 'cancelex') return nav('examenes');
    if (a === 'newasig') return dlgAsignatura();
    if (a === 'asigopen') { S.asigId = id; await loadAsigData(); shell(); return nav(esEst() ? 'panel' : 'resumen'); }
    if (a === 'npesta') return dlgPesta(null);
    if (a === 'pmedit') return dlgPesta(S.pestanas.find(x => x.id === id));
    if (a === 'pmdel') { if (confirm('¿Eliminar este módulo? El progreso asociado también se borra.')) { await API.call('deletePestana', { auth: authCod(), asigId: S.asigId, id }); toast('Módulo eliminado.'); return reroute(); } return; }
    if (a === 'pmvis') { const m = S.pestanas.find(x => x.id === id); await API.call('savePestana', { auth: authCod(), pesta: { ...m, visible: m.visible === false } }); return reroute(); }
    if (a === 'pmup' || a === 'pmdown') { await API.call('moverPestana', { auth: authCod(), asigId: S.asigId, id, dir: a === 'pmup' ? 'up' : 'down' }); return reroute(); }
    if (a === 'xnew') return nav('examen-editar/nuevo');
    if (a === 'xdel') { if (confirm('¿Eliminar el examen con sus preguntas y notas?')) { await API.call('deleteExamen', { auth: authCod(), asigId: S.asigId, id }); toast('Examen eliminado.'); return reroute(); } return; }
    if (a === 'xvis') { const ex = await API.call('getExamen', { id }); await API.call('saveExamen', { auth: authCod(), examen: { ...ex, visible: ex.visible === false } }); return reroute(); }
    if (a === 'qadd') { S.editQs.push({ tipo: 'sm', texto: '', opciones: ['', '', '', ''], correcta: 0, puntos: 2 }); return renderQs(); }
    if (a === 'qdel') { S.editQs.splice(+t.closest('.qcard').dataset.qi, 1); return renderQs(); }
    if (a === 'qup' || a === 'qdown') { const i = +t.closest('.qcard').dataset.qi, j = i + (a === 'qup' ? -1 : 1); if (j >= 0 && j < S.editQs.length) { [S.editQs[i], S.editQs[j]] = [S.editQs[j], S.editQs[i]]; } return renderQs(); }
    if (a === 'csvres') {
      const map = {};
      S.resIntentos.forEach(i => { const o = map[i.usuario] || (map[i.usuario] = { nombre: i.nombre, n: 0, mejor: null, total: null, ultimo: '' }); o.n++; if (o.mejor == null || i.puntaje > o.mejor) { o.mejor = i.puntaje; o.total = i.total; } o.ultimo = i.fecha; });
      return download('resultados.csv', csv([['Estudiante', 'Intentos', 'Mejor nota', 'Total', 'Último'], ...Object.values(map).map(o => [o.nombre, o.n, o.mejor ?? '', o.total ?? '', o.ultimo])]));
    }
    if (a === 'csvmx') {
      const ms = S.pestanas, xs = S.examenes;
      const notas = {}; (S.intentosAsig || []).forEach(i => { const o = notas[i.usuario] || (notas[i.usuario] = {}); if (o[i.examenId] == null || i.puntaje > o[i.examenId]) o[i.examenId] = i.puntaje; });
      return download('progreso_' + norm(asig()?.nombre || 'asignatura') + '.csv', csv([['Estudiante', 'Grupo', ...ms.map(m => m.titulo), ...xs.map(x => x.titulo), 'Total %'], ...S.matriculados.map(m => [m.nombre, m.grupo, ...ms.map(mm => S.progreso.some(y => y.usuario === m.usuario && y.tipo === 'pestaña' && y.itemId === mm.id && y.completado) ? 'Sí' : 'No'), ...xs.map(x => notas[m.usuario]?.[x.id] ?? ''), progresoDe(m.usuario).pct])]));
    }
    if (a === 'matgrupo') return dlgMatricularGrupo();
    if (a === 'matalum') return dlgMatricularAlumnos();
    if (a === 'quitar') { if (!esDir()) throw new Error('Solo rectoría, decanato o secretaría pueden retirar estudiantes.'); if (confirm('¿Quitar a este estudiante de la asignatura?')) { await API.call('desmatricular', { auth: authCod(), asigId: S.asigId, usuario: t.dataset.user }); toast('Estudiante retirado de la asignatura.'); return reroute(); } return; }
    if (a === 'nanuncio') { nav('anuncios'); setTimeout(() => $('#at')?.focus(), 300); return; }
    if (a === 'aedit') { const an = S.anuncios.find(x => x.id === id); $('#aid').value = an.id; $('#at').value = an.titulo; $('#ag').value = an.tag || ''; $('#ab').value = an.cuerpo; $('#ap').checked = !!an.pin; $('#abtn').innerHTML = '<i class="fas fa-check"></i> Guardar cambios'; $('#acan').style.display = ''; $('#at').focus(); return; }
    if (a === 'acancel') { $('#aid').value = ''; $('#af2').reset(); $('#abtn').innerHTML = '<i class="fas fa-bullhorn"></i> Publicar anuncio'; $('#acan').style.display = 'none'; return; }
    if (a === 'adel') { if (confirm('¿Eliminar este anuncio?')) { await API.call('deleteAnuncio', { auth: authCod(), id }); toast('Anuncio eliminado.'); return reroute(); } return; }
    if (a === 'asigdel') {
      if (confirm('¿ELIMINAR la asignatura completa? Esta acción no se puede deshacer.')) { await API.call('deleteAsignatura', { auth: authCod(), id: S.asigId }); toast('Asignatura eliminada.'); S.asigId = null; await loadAsigs(); shell(); return nav('asignaturas'); }
      return;
    }
    if (a === 'badd') return dlgEstudiante(null);
    if (a === 'bimp') return dlgImportar();
    if (a === 'bedit') return dlgEstudiante(S.estudiantes.find(x => x.id === id));
    if (a === 'btoggle') { const s2 = S.estudiantes.find(x => x.id === id); await API.call('saveEstudiante', { auth: authCod(), est: { ...s2, estado: s2.estado === 'Activo' ? 'Inactivo' : 'Activo' } }); toast('Estado actualizado.'); return route(); }
    if (a === 'bdel') { if (confirm('¿Eliminar este estudiante de la base de datos?')) { await API.call('deleteEstudiante', { auth: authCod(), id }); toast('Estudiante eliminado.'); return route(); } return; }
    if (a === 'asigprof') return dlgAsignarProfesor(id);
    if (a === 'asigdel2') { if (confirm('¿ELIMINAR la asignatura completa con todo su contenido? Esta acción no se puede deshacer.')) { await API.call('deleteAsignatura', { auth: authCod(), id }); toast('Asignatura eliminada.'); await loadAsigs(); return route(); } return; }
    if (a === 'profnew') return dlgProfesorNuevo();
    if (a === 'profreset') { const pr = S.profesores.find(x => x.usuario === t.dataset.user); if (!confirm('¿Generar una nueva contraseña para ' + (pr?.nombre || 'este profesor') + '?')) return; const r = await API.call('resetClaveProfesor', { auth: authCod(), usuario: t.dataset.user }); dlgCredenciales(r.credenciales); return route(); }
    if (a === 'profdel') { if (!confirm('¿Eliminar esta cuenta de profesor? Sus asignaturas quedarán sin profesor asignado.')) return; await API.call('deleteProfesor', { auth: authCod(), usuario: t.dataset.user }); toast('Profesor eliminado.'); return route(); }
    if (a === 'chattoggle') { const r = await API.call('setChatAbierto', { auth: authCod(), asigId: S.asigId, abierto: !S.chat.abierto }); S.chat.abierto = r.abierto; toast(r.abierto ? 'Se permiten nuevas participaciones.' : 'Se cerraron las nuevas participaciones.'); return route(); }
    if (a === 'threadback') return nav('foro');
    if (a === 'threadclose') { if (!confirm('¿Finalizar esta conversación? Se conservará en el historial.')) return; await API.call('cerrarConversacion', { asigId: S.asigId, threadId: id }); toast('Conversación finalizada.'); return route(); }
    if (a === 'threaddel') { if (!confirm('¿Eliminar esta conversación y todas sus respuestas? Esta acción no se puede deshacer.')) return; await API.call('eliminarConversacion', { asigId: S.asigId, threadId: id }); toast('Conversación eliminada.'); return nav('foro'); }
    if (a === 'postdel') { if (!confirm('¿Eliminar esta respuesta?')) return; await API.call('eliminarRespuesta', { asigId: S.asigId, postId: id }); toast('Respuesta eliminada.'); return route(); }
    if (a === 'navforo') return nav('foro');
  } catch (ex) { toast(ex.message); }
});

/* ---------- binds por vista ---------- */
BIND.anuncios = () => {
  const f = $('#af2'); if (!f) return;
  f.onsubmit = async e => {
    e.preventDefault();
    try {
      await API.call('saveAnuncio', { auth: authCod(), anuncio: { id: $('#aid').value || null, asignaturaId: S.asigId, titulo: $('#at').value.trim(), tag: $('#ag').value.trim(), cuerpo: $('#ab').value.trim(), pin: $('#ap').checked } });
      toast('Anuncio publicado.'); await loadAsigData(); route();
    } catch (ex) { toast(ex.message); }
  };
};
BIND['examen-editar'] = () => {
  renderQs();
  const f = $('#ef'); if (!f) return;
  $('#view').addEventListener('input', e => {
    const el = e.target, card = el.closest('.qcard'); if (!card) return;
    const i = +card.dataset.qi, q = S.editQs[i]; if (!q) return;
    if (el.dataset.f === 'texto') q.texto = el.value;
    if (el.dataset.f === 'puntos') q.puntos = +el.value || 1;
    if (el.dataset.f === 'opt') { q.opciones = q.opciones || ['', '', '', '']; q.opciones[+el.dataset.oi] = el.value; }
    if (el.dataset.f === 'accepted') { q.metadata = q.metadata || {}; q.metadata.accepted = el.value.split('|').map(x => x.trim()).filter(Boolean); }
    if (el.dataset.f === 'pairs') { q.metadata = q.metadata || {}; q.metadata.pairs = el.value.split('\n').map(line => line.split('|').map(x => x.trim())).filter(x => x.length >= 2 && x[0] && x[1]).map(x => ({left:x[0],right:x[1]})); q.metadata.leftItems = q.metadata.pairs.map(x=>x.left); q.metadata.rightOptions = q.metadata.pairs.map(x=>x.right); }
    if (el.dataset.f === 'rubric') { q.metadata = q.metadata || {}; q.metadata.rubric = el.value; }
  });
  $('#view').addEventListener('change', e => {
    const el = e.target, card = el.closest('.qcard'); if (!card) return;
    const i = +card.dataset.qi, q = S.editQs[i]; if (!q) return;
    if (el.dataset.f === 'tipo') { q.tipo = el.value; q.metadata = {}; q.opciones = el.value === 'vf' ? ['Verdadero','Falso'] : (el.value === 'sm' ? ['','','',''] : []); q.correcta = 0; renderQs(); }
    if (el.dataset.f === 'correcta') q.correcta = +el.value;
  });
  f.onsubmit = async e => {
    e.preventDefault();
    try {
      const r = await API.call('saveExamen', { auth: authCod(), examen: { id: S.editExam.id, asignaturaId: S.asigId, titulo: $('#et').value.trim(), descripcion: $('#ed').value.trim(), visible: $('#ev').checked, preguntas: S.editQs } });
      toast('Examen guardado.'); await loadAsigData(); nav('examenes');
    } catch (ex) { toast(ex.message); }
  };
};
BIND.ajustes = () => {
  const f = $('#ajf'); if (!f) return;
  f.onsubmit = async e => {
    e.preventDefault();
    try { await API.call('saveAsignatura', { auth: authCod(), asig: { id: S.asigId, nombre: $('#ajn').value.trim(), descripcion: $('#ajd').value.trim(), color: $('#ajc').value } }); toast('Ajustes guardados.'); await loadAsigs(); shell(); route(); }
    catch (ex) { toast(ex.message); }
  };
};
BIND.base = () => {
  const q = $('#bsq'), g = $('#bgr');
  const filt = () => { const s = norm(q?.value || ''), gr = g?.value || ''; $$('#btab tbody tr').forEach(tr => tr.style.display = (!s || tr.dataset.b.includes(s)) && (!gr || tr.dataset.g === gr) ? '' : 'none'); };
  q && (q.oninput = filt); g && (g.onchange = filt);
};
BIND.estudiantes = () => { /* acciones por delegación global */ };
BIND.resultados = () => { /* idem */ };
BIND.revision = () => {
  const f=$('#reviewform'); if(!f)return;
  f.onsubmit=async e=>{e.preventDefault();const a=S.reviewAttempt.intento;const calificaciones=S.reviewAttempt.preguntas.filter(q=>['comprension','red'].includes(q.tipo)).map(q=>({preguntaId:q.id,puntos:Number(f.querySelector('[name="score_'+q.id+'"]').value)}));try{await API.call('revisarIntento',{intentoId:a.id,calificaciones,comentario:$('#reviewcomment').value});toast('Calificación final guardada.');nav('resultados/'+a.examenId);}catch(ex){toast(ex.message);}};
};

BIND.resumen = () => { /* idem */ };

/* ---------- arranque ---------- */
boot();
})();

