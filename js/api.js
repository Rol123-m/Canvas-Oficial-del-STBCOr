/* ============================================================
   API.JS · Capa de datos de la plataforma
   · Con CONFIG.api vacío → MODO DEMO (localStorage, sin servidor)
   · Con CONFIG.api lleno  → Google Apps Script (code.gs) + Google Sheets
   Las dos modalidades implementan exactamente las mismas acciones.

   Modelo de accesos:
   · Estudiante  → entra con usuario y contraseña (base de datos)
   · Profesor    → cuenta creada por la dirección; gestiona SOLO su asignatura
   · Dirección   → rector / decano / secretaría con su clave; acceso total
   ============================================================ */
window.API = {
  get demo() { return !window.CONFIG.api; },
  async call(action, payload = {}) {
    if (this.demo) return window.DemoAPI.handle(action, payload);
    const res = await fetch(window.CONFIG.api, {
      method: 'POST', redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, payload })
    });
    if (!res.ok) throw new Error('No se pudo conectar con el servidor (' + res.status + ')');
    const j = await res.json();
    if (!j.ok) throw new Error(j.error || 'Error del servidor');
    return j.data;
  }
};

/* ---------- API DEMO (localStorage) ---------- */
window.DemoAPI = (() => {
  'use strict';
  const KEY = 'seminario.db.v1';
  let db;
  try { db = JSON.parse(localStorage.getItem(KEY)); } catch { db = null; }
  if (!db || !db.estudiantes) { db = window.DEMO.db(); persist(); }
  function persist() { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { /* almacenamiento lleno */ } }
  const uid = p => (p || 'id') + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const now = () => new Date().toISOString();
  const C = () => window.CONFIG;

  /* -- helpers de negocio (idénticos a code.gs) -- */
  const err = m => { throw new Error(m); };
  const normTxt = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '');
  const estByU = u => db.estudiantes.find(e => e.usuario.toLowerCase() === String(u || '').toLowerCase());
  const profByU = u => db.profesores.find(p => p.usuario.toLowerCase() === String(u || '').toLowerCase());

  /* autenticación del personal: dirección por clave, profesor por cuenta */
  function staff(auth) {
    const a = auth || {};
    if (a.rol === 'dir') {
      const c = String(a.codigo || '').trim();
      for (const clave of Object.values(C().claves)) if (clave === c) return { nivel: 'dir' };
      err('Clave de dirección no válida.');
    }
    if (a.rol === 'prof') {
      const p = profByU(a.usuario);
      if (!p || p.clave !== a.clave) err('Credenciales de profesor incorrectas.');
      if (p.estado !== 'Activo') err('Cuenta de profesor inactiva. Consulta con la dirección.');
      return { nivel: 'prof', usuario: p.usuario };
    }
    err('Sesión no válida. Vuelve a entrar.');
  }
  const dir = auth => { const s = staff(auth); if (s.nivel !== 'dir') err('Esta acción es solo para la dirección.'); return s; };

  /* acceso a una asignatura: dirección siempre; profesor solo la suya */
  function accesoAsig(auth, asigId) {
    const s = staff(auth);
    const a = db.asignaturas.find(x => x.id === asigId);
    if (!a) err('Asignatura no encontrada.');
    if (s.nivel === 'dir') return { ...s, asig: a };
    if (a.profesor !== s.usuario) err('Solo puedes gestionar tu propia asignatura.');
    return { ...s, asig: a };
  }

  /* usuario y clave automáticos */
  function genUsuario(nombre) {
    const base = normTxt(nombre).split('.').slice(0, 2).join('.') || 'prof';
    let u = base, n = 2;
    const ocupado = x => db.profesores.some(p => p.usuario.toLowerCase() === x) || db.estudiantes.some(e => e.usuario.toLowerCase() === x);
    while (ocupado(u)) u = base + n++;
    return u;
  }
  function genClave() {
    const abc = 'abcdefghjkmnpqrstuvwxyz23456789';
    let c = ''; for (let i = 0; i < 8; i++) c += abc[Math.floor(Math.random() * abc.length)];
    return c;
  }
  const cred = p => ({ nombre: p.nombre, usuario: p.usuario, clave: p.clave, email: p.email || '' });

  function verEst(u, p) { const e = estByU(u); if (!e || e.clave !== p) err('Usuario o contraseña incorrectos.'); if (e.estado !== 'Activo') err('Cuenta inactiva. Consulta con la secretaría.'); return e; }
  const visibles = arr => arr.filter(x => x.visible !== false);
  function itemsDeAsig(aid) { return { p: visibles(db.pestanas.filter(x => x.asignaturaId === aid)), x: visibles(db.examenes.filter(x => x.asignaturaId === aid)) }; }
  function progresoEst(aid, usuario) {
    const it = itemsDeAsig(aid), pg = db.progreso.filter(x => x.asignaturaId === aid && x.usuario === usuario);
    const doneP = pg.filter(x => x.tipo === 'pestaña' && x.completado).map(x => x.itemId);
    const doneX = new Set(db.intentos.filter(x => db.examenes.some(e => e.id === x.examenId && e.asignaturaId === aid) && x.usuario === usuario).map(x => x.examenId));
    const tot = it.p.length + it.x.length;
    const done = it.p.filter(x => doneP.includes(x.id)).length + it.x.filter(x => doneX.has(x.id)).length;
    return { done, tot, pct: tot ? Math.round(done / tot * 100) : 0 };
  }
  function notasExamen(examenId, usuario) {
    const its = db.intentos.filter(x => x.examenId === examenId && x.usuario === usuario);
    return { n: its.length, mejor: its.length ? Math.max(...its.map(i => i.puntaje)) : null, ultimo: its.length ? its[its.length - 1] : null };
  }

  /* -- router de acciones -- */
  async function handle(action, p) {
    switch (action) {
      case 'ping': return { ok: true, modo: 'demo' };

      /* ----- sesiones ----- */
      case 'login': {
        const e = verEst(p.u, p.p);
        return { nombre: e.nombre, grupo: e.grupo, usuario: e.usuario };
      }
      case 'loginProfesor': {
        const pr = profByU(p.u);
        if (!pr || pr.clave !== p.p) err('Usuario o contraseña incorrectos.');
        if (pr.estado !== 'Activo') err('Cuenta inactiva. Consulta con la dirección.');
        return { nombre: pr.nombre, usuario: pr.usuario };
      }
      case 'loginStaff': {
        const c = String(p.codigo || '').trim();
        for (const [rol, clave] of Object.entries(C().claves)) if (clave === c)
          return { rol, nombre: { rector: 'Rectoría', decano: 'Decanato', secretaria: 'Secretaría' }[rol] };
        err('Clave de acceso no válida.');
      }

      /* ----- base de estudiantes (lectura: personal; escritura: dirección) ----- */
      case 'getEstudiantes': staff(p.auth); return db.estudiantes.map(e => ({ ...e }));
      case 'saveEstudiante': {
        dir(p.auth);
        const e = p.est;
        if (!e.nombre || !e.usuario) err('Nombre y usuario son obligatorios.');
        const dup = db.estudiantes.find(x => x.usuario.toLowerCase() === e.usuario.toLowerCase() && x.id !== e.id);
        if (dup) err('Ya existe un estudiante con ese usuario.');
        if (e.id) {
          const i = db.estudiantes.findIndex(x => x.id === e.id);
          if (i < 0) err('Estudiante no encontrado.');
          db.estudiantes[i] = { ...db.estudiantes[i], ...e };
        } else {
          if (!e.clave) err('El estudiante nuevo necesita contraseña.');
          db.estudiantes.push({ id: uid('e'), nombre: e.nombre, grupo: e.grupo || '1.er año', usuario: e.usuario, clave: e.clave, estado: e.estado || 'Activo' });
        }
        persist(); return { ok: true };
      }
      case 'deleteEstudiante': {
        dir(p.auth);
        const viejo = db.estudiantes.find(x => x.id === p.id);
        db.estudiantes = db.estudiantes.filter(x => x.id !== p.id);
        if (viejo) db.matriculas = db.matriculas.filter(x => x.usuario !== viejo.usuario);
        persist(); return { ok: true };
      }
      case 'importarEstudiantes': {
        dir(p.auth);
        let nuevos = 0, actualizados = 0;
        String(p.texto || '').split(/\r?\n/).forEach(linea => {
          const c = linea.trim(); if (!c) return;
          const v = c.split(/[;,\t]/).map(x => x.trim());
          if (!v[0] || /nombre/i.test(v[0]) && !v[1]) return;
          const [nombre, grupo, usuario, clave, estado] = v;
          if (!nombre || !usuario || !clave) return;
          const ex = estByU(usuario);
          if (ex) { ex.nombre = nombre; ex.grupo = grupo || ex.grupo; ex.clave = clave; ex.estado = estado || ex.estado || 'Activo'; actualizados++; }
          else { db.estudiantes.push({ id: uid('e'), nombre, grupo: grupo || 'Sin grupo', usuario, clave, estado: estado || 'Activo' }); nuevos++; }
        });
        persist(); return { nuevos, actualizados };
      }

      /* ----- profesores (dirección) ----- */
      case 'getProfesores': dir(p.auth); return db.profesores.map(x => ({ ...x }));
      case 'saveProfesor': {
        dir(p.auth);
        const q = p.prof;
        if (!q.nombre) err('El profesor necesita un nombre.');
        let credNueva = null;
        if (q.id) {
          const i = db.profesores.findIndex(x => x.id === q.id);
          if (i < 0) err('Profesor no encontrado.');
          db.profesores[i] = { ...db.profesores[i], nombre: q.nombre, email: q.email || '', estado: q.estado || db.profesores[i].estado };
          if (q.clave) { db.profesores[i].clave = q.clave; credNueva = cred(db.profesores[i]); }
        } else {
          const np = {
            id: uid('pr'), nombre: q.nombre, email: q.email || '', estado: 'Activo', creado: now(),
            usuario: q.usuario || genUsuario(q.nombre), clave: q.clave || genClave()
          };
          db.profesores.push(np); credNueva = cred(np);
        }
        persist(); return { ok: true, credenciales: credNueva };
      }
      case 'resetClaveProfesor': {
        dir(p.auth);
        const pr = profByU(p.usuario); if (!pr) err('Profesor no encontrado.');
        pr.clave = genClave(); persist(); return { credenciales: cred(pr) };
      }
      case 'deleteProfesor': {
        dir(p.auth);
        db.profesores = db.profesores.filter(x => x.usuario !== p.usuario);
        db.asignaturas.forEach(a => { if (a.profesor === p.usuario) { a.profesor = ''; a.profesorNombre = ''; } });
        persist(); return { ok: true };
      }

      /* ----- asignaturas ----- */
      case 'getAsignaturas': {
        const s = p.sesion || {};
        if (s.rol === 'estudiante') {
          const mias = db.matriculas.filter(m => m.usuario === s.usuario).map(m => m.asignaturaId);
          return db.asignaturas.filter(a => mias.includes(a.id));
        }
        if (s.rol === 'profesor') return db.asignaturas.filter(a => a.profesor === s.usuario);
        return db.asignaturas; // rectoría / decanato / secretaría → todas
      }
      case 'saveAsignatura': {
        const s = staff(p.auth);
        const a = p.asig;
        if (!a.nombre) err('La asignatura necesita un nombre.');
        let credNueva = null;
        if (a.id) {
          const i = db.asignaturas.findIndex(x => x.id === a.id);
          if (i < 0) err('Asignatura no encontrada.');
          const cur = db.asignaturas[i];
          if (s.nivel === 'prof') {
            if (cur.profesor !== s.usuario) err('Solo puedes gestionar tu propia asignatura.');
            cur.nombre = a.nombre; cur.descripcion = a.descripcion ?? cur.descripcion; cur.color = a.color || cur.color;
          } else {
            db.asignaturas[i] = { ...cur, ...a };
          }
        } else {
          if (s.nivel !== 'dir') err('Solo la dirección puede crear asignaturas.');
          /* profesor: existente, nuevo (se crean sus credenciales) o sin asignar */
          let profUsuario = '', profNombre = '';
          if (a.profesorUsuario === '__nuevo__') {
            const q = a.profesorNuevo || {};
            if (!q.nombre) err('Escribe el nombre del nuevo profesor.');
            const np = { id: uid('pr'), nombre: q.nombre, email: q.email || '', estado: 'Activo', creado: now(), usuario: genUsuario(q.nombre), clave: genClave() };
            db.profesores.push(np); credNueva = cred(np);
            profUsuario = np.usuario; profNombre = np.nombre;
          } else if (a.profesorUsuario) {
            const pr = profByU(a.profesorUsuario);
            if (!pr) err('Profesor no encontrado.');
            profUsuario = pr.usuario; profNombre = pr.nombre;
          }
          const na = {
            id: uid('asig'), nombre: a.nombre, descripcion: a.descripcion || '', color: a.color || C().tema.navy,
            profesor: profUsuario, profesorNombre: profNombre, chatAbierto: 'No', creada: now()
          };
          db.asignaturas.push(na);
          (a.grupos || []).forEach(g => db.estudiantes.filter(e => e.grupo === g).forEach(e => {
            if (!db.matriculas.some(m => m.asignaturaId === na.id && m.usuario === e.usuario))
              db.matriculas.push({ id: uid('m'), asignaturaId: na.id, usuario: e.usuario, grupo: e.grupo, fecha: now() });
          }));
        }
        persist(); return { ok: true, credenciales: credNueva };
      }
      case 'setProfesorAsignatura': {
        dir(p.auth);
        const a = db.asignaturas.find(x => x.id === p.asigId); if (!a) err('Asignatura no encontrada.');
        let credNueva = null;
        if (p.modo === 'nuevo') {
          if (!p.nombre) err('Escribe el nombre del nuevo profesor.');
          const np = { id: uid('pr'), nombre: p.nombre, email: p.email || '', estado: 'Activo', creado: now(), usuario: genUsuario(p.nombre), clave: genClave() };
          db.profesores.push(np); credNueva = cred(np);
          a.profesor = np.usuario; a.profesorNombre = np.nombre;
        } else {
          const pr = profByU(p.usuario); if (!pr) err('Profesor no encontrado.');
          a.profesor = pr.usuario; a.profesorNombre = pr.nombre;
        }
        persist(); return { ok: true, credenciales: credNueva };
      }
      case 'deleteAsignatura': {
        dir(p.auth);
        db.asignaturas = db.asignaturas.filter(x => x.id !== p.id);
        db.matriculas = db.matriculas.filter(x => x.asignaturaId !== p.id);
        const xs = db.examenes.filter(x => x.asignaturaId === p.id).map(x => x.id);
        db.examenes = db.examenes.filter(x => x.asignaturaId !== p.id);
        db.preguntas = db.preguntas.filter(x => !xs.includes(x.examenId));
        db.intentos = db.intentos.filter(x => !xs.includes(x.examenId));
        db.pestanas = db.pestanas.filter(x => x.asignaturaId !== p.id);
        db.progreso = db.progreso.filter(x => x.asignaturaId !== p.id);
        db.anuncios = db.anuncios.filter(x => x.asignaturaId !== p.id);
        db.chat = (db.chat || []).filter(x => x.asignaturaId !== p.id);
        persist(); return { ok: true };
      }

      /* ----- matrícula ----- */
      case 'getMatriculados': {
        accesoAsig(p.auth, p.asigId);
        const us = db.matriculas.filter(m => m.asignaturaId === p.asigId).map(m => m.usuario);
        return db.estudiantes.filter(e => us.includes(e.usuario));
      }
      case 'matricular': {
        accesoAsig(p.auth, p.asigId);
        let n = 0;
        (p.usuarios || []).forEach(u => {
          const e = estByU(u); if (!e) return;
          if (!db.matriculas.some(m => m.asignaturaId === p.asigId && m.usuario === e.usuario)) {
            db.matriculas.push({ id: uid('m'), asignaturaId: p.asigId, usuario: e.usuario, grupo: e.grupo, fecha: now() }); n++;
          }
        });
        persist(); return { n };
      }
      case 'matricularGrupo': {
        accesoAsig(p.auth, p.asigId);
        let n = 0;
        db.estudiantes.filter(e => e.grupo === p.grupo).forEach(e => {
          if (!db.matriculas.some(m => m.asignaturaId === p.asigId && m.usuario === e.usuario)) {
            db.matriculas.push({ id: uid('m'), asignaturaId: p.asigId, usuario: e.usuario, grupo: e.grupo, fecha: now() }); n++;
          }
        });
        persist(); return { n };
      }
      case 'desmatricular': {
        accesoAsig(p.auth, p.asigId);
        db.matriculas = db.matriculas.filter(m => !(m.asignaturaId === p.asigId && m.usuario === p.usuario));
        persist(); return { ok: true };
      }

      /* ----- módulos (pestañas) ----- */
      case 'getPestanas': {
        let arr = db.pestanas.filter(x => x.asignaturaId === p.asigId).sort((a, b) => a.orden - b.orden);
        if (!p.todas) arr = visibles(arr);
        return arr;
      }
      case 'savePestana': {
        accesoAsig(p.auth, p.pesta?.asignaturaId);
        const t = p.pesta;
        if (!t.asignaturaId) err('Falta la asignatura.');
        if (t.id) {
          const i = db.pestanas.findIndex(x => x.id === t.id);
          if (i < 0) err('Módulo no encontrado.');
          db.pestanas[i] = { ...db.pestanas[i], ...t };
        } else {
          const orden = Math.max(0, ...db.pestanas.filter(x => x.asignaturaId === t.asignaturaId).map(x => x.orden)) + 1;
          db.pestanas.push({ id: uid('p'), asignaturaId: t.asignaturaId, titulo: t.titulo || 'Nuevo módulo', icono: t.icono || 'fa-book', tipo: t.tipo || 'contenido', contenido: t.contenido || '', orden, visible: t.visible !== false });
        }
        persist(); return { ok: true };
      }
      case 'deletePestana': {
        accesoAsig(p.auth, p.asigId);
        db.pestanas = db.pestanas.filter(x => x.id !== p.id);
        db.progreso = db.progreso.filter(x => !(x.tipo === 'pestaña' && x.itemId === p.id));
        persist(); return { ok: true };
      }
      case 'moverPestana': {
        accesoAsig(p.auth, p.asigId);
        const t = db.pestanas.find(x => x.id === p.id); if (!t) err('Módulo no encontrado.');
        const her = db.pestanas.filter(x => x.asignaturaId === t.asignaturaId).sort((a, b) => a.orden - b.orden);
        const i = her.findIndex(x => x.id === p.id), j = i + (p.dir === 'up' ? -1 : 1);
        if (j >= 0 && j < her.length) { [her[i].orden, her[j].orden] = [her[j].orden, her[i].orden]; }
        persist(); return { ok: true };
      }

      /* ----- exámenes ----- */
      case 'getExamenes': {
        let arr = db.examenes.filter(x => x.asignaturaId === p.asigId);
        if (!p.todas) arr = visibles(arr);
        return arr.map(e => ({ ...e, nPreg: db.preguntas.filter(q => q.examenId === e.id).length }));
      }
      case 'getExamen': {
        const e = db.examenes.find(x => x.id === p.id); if (!e) err('Examen no encontrado.');
        const preguntas = db.preguntas.filter(q => q.examenId === p.id).sort((a, b) => a.orden - b.orden)
          .map(q => ({ ...q, opciones: JSON.parse(q.opciones || '[]') }));
        return { ...e, preguntas };
      }
      case 'saveExamen': {
        accesoAsig(p.auth, p.examen?.asignaturaId);
        const e = p.examen, qs = e.preguntas || [];
        if (!e.titulo) err('El examen necesita un título.');
        let id = e.id;
        if (id) {
          const i = db.examenes.findIndex(x => x.id === id);
          if (i < 0) err('Examen no encontrado.');
          db.examenes[i] = { ...db.examenes[i], titulo: e.titulo, descripcion: e.descripcion || '', visible: e.visible !== false };
        } else {
          id = uid('x');
          db.examenes.push({ id, asignaturaId: e.asignaturaId, titulo: e.titulo, descripcion: e.descripcion || '', visible: e.visible !== false, creado: now() });
        }
        db.preguntas = db.preguntas.filter(q => q.examenId !== id);
        qs.forEach((q, k) => db.preguntas.push({
          id: uid('q'), examenId: id, tipo: q.tipo || 'sm', texto: q.texto || '',
          opciones: JSON.stringify(q.tipo === 'vf' ? ['Verdadero', 'Falso'] : (q.opciones || ['', '', '', ''])),
          correcta: q.correcta | 0, puntos: +q.puntos || 1, orden: k + 1
        }));
        persist(); return { id };
      }
      case 'deleteExamen': {
        accesoAsig(p.auth, p.asigId);
        db.examenes = db.examenes.filter(x => x.id !== p.id);
        db.preguntas = db.preguntas.filter(q => q.examenId !== p.id);
        db.intentos = db.intentos.filter(x => x.examenId !== p.id);
        db.progreso = db.progreso.filter(x => !(x.tipo === 'examen' && x.itemId === p.id));
        persist(); return { ok: true };
      }

      /* ----- intentos y calificación ----- */
      case 'enviarIntento': {
        const e = verEst(p.usuario, p.clave);
        const ex = db.examenes.find(x => x.id === p.examenId); if (!ex) err('Examen no encontrado.');
        const qs = db.preguntas.filter(q => q.examenId === p.examenId).sort((a, b) => a.orden - b.orden);
        let puntaje = 0; const total = qs.reduce((a, q) => a + (+q.puntos || 0), 0);
        const detalle = qs.map((q, i) => {
          const eleccion = (p.respuestas || [])[i] ?? null;
          const ok = eleccion === q.correcta;
          if (ok) puntaje += +q.puntos || 0;
          return { texto: q.texto, eleccion, correcta: q.correcta, opciones: JSON.parse(q.opciones || '[]'), ok };
        });
        db.intentos.push({ id: uid('i'), examenId: ex.id, usuario: e.usuario, nombre: e.nombre, fecha: now(), puntaje, total, respuestas: JSON.stringify(p.respuestas || []) });
        if (!db.progreso.some(x => x.asignaturaId === ex.asignaturaId && x.usuario === e.usuario && x.tipo === 'examen' && x.itemId === ex.id))
          db.progreso.push({ id: uid('g'), asignaturaId: ex.asignaturaId, usuario: e.usuario, nombre: e.nombre, tipo: 'examen', itemId: ex.id, completado: true, fecha: now() });
        persist();
        return { puntaje, total, pct: total ? Math.round(puntaje / total * 100) : 0, detalle };
      }
      case 'getIntentos': {
        accesoAsig(p.auth, db.examenes.find(x => x.id === p.examenId)?.asignaturaId);
        return db.intentos.filter(x => x.examenId === p.examenId).map(x => ({ ...x, respuestas: undefined }));
      }
      case 'getIntentosAsig': {
        accesoAsig(p.auth, p.asigId);
        const xs = db.examenes.filter(x => x.asignaturaId === p.asigId).map(x => x.id);
        return db.intentos.filter(x => xs.includes(x.examenId)).map(x => ({ ...x, respuestas: undefined }));
      }

      /* ----- progreso ----- */
      case 'getProgreso': {
        if (p.usuario) return db.progreso.filter(x => x.asignaturaId === p.asigId && x.usuario === p.usuario);
        accesoAsig(p.auth, p.asigId);
        return db.progreso.filter(x => x.asignaturaId === p.asigId);
      }
      case 'setProgreso': {
        const e = verEst(p.usuario, p.clave);
        const i = db.progreso.findIndex(x => x.asignaturaId === p.asigId && x.usuario === e.usuario && x.tipo === 'pestaña' && x.itemId === p.itemId);
        if (i >= 0) db.progreso[i].completado = !!p.completado, db.progreso[i].fecha = now();
        else db.progreso.push({ id: uid('g'), asignaturaId: p.asigId, usuario: e.usuario, nombre: e.nombre, tipo: 'pestaña', itemId: p.itemId, completado: !!p.completado, fecha: now() });
        persist(); return { ok: true };
      }
      case 'getMisNotas': {
        const e = verEst(p.usuario, p.clave);
        return db.intentos.filter(x => x.usuario === e.usuario && db.examenes.some(ex => ex.id === x.examenId && ex.asignaturaId === p.asigId))
          .map(x => ({ examenId: x.examenId, puntaje: x.puntaje, total: x.total, fecha: x.fecha }));
      }

      /* ----- anuncios ----- */
      case 'getAnuncios': {
        return db.anuncios.filter(a => a.asignaturaId === p.asigId).sort((a, b) => (b.pin ? 1 : 0) - (a.pin ? 1 : 0) || (b.fecha > a.fecha ? 1 : -1));
      }
      case 'saveAnuncio': {
        const s = accesoAsig(p.auth, p.anuncio?.asignaturaId);
        const a = p.anuncio;
        if (!a.titulo || !a.cuerpo) err('El anuncio necesita título y texto.');
        const autor = s.nivel === 'dir' ? 'Dirección' : s.asig.profesorNombre || 'Profesor';
        if (a.id) {
          const i = db.anuncios.findIndex(x => x.id === a.id);
          if (i < 0) err('Anuncio no encontrado.');
          db.anuncios[i] = { ...db.anuncios[i], ...a };
        } else {
          db.anuncios.push({ id: uid('a'), asignaturaId: a.asignaturaId, titulo: a.titulo, cuerpo: a.cuerpo, tag: a.tag || 'Aviso', autor, fecha: now(), pin: !!a.pin });
        }
        persist(); return { ok: true };
      }
      case 'deleteAnuncio': {
        const an = db.anuncios.find(x => x.id === p.id); if (!an) err('Anuncio no encontrado.');
        accesoAsig(p.auth, an.asignaturaId);
        db.anuncios = db.anuncios.filter(x => x.id !== p.id); persist(); return { ok: true };
      }

      /* ----- foro de dudas (chat por asignatura) ----- */
      case 'getChat': {
        const s = p.sesion || {};
        const a = db.asignaturas.find(x => x.id === p.asigId); if (!a) err('Asignatura no encontrada.');
        if (s.rol === 'estudiante' && !db.matriculas.some(m => m.asignaturaId === p.asigId && m.usuario === s.usuario)) err('No estás matriculado en esta asignatura.');
        const todos = (db.chat || []).filter(c => c.asignaturaId === p.asigId).sort((x, y) => x.fecha < y.fecha ? -1 : 1);
        const desde = p.desde ? todos.filter(c => c.fecha > p.desde) : todos.slice(-120);
        return { abierto: a.chatAbierto === 'Si', mensajes: desde.map(c => ({ id: c.id, usuario: c.usuario, nombre: c.nombre, rol: c.rol, texto: c.texto, fecha: c.fecha })) };
      }
      case 'enviarChat': {
        const s = p.sesion || {};
        const a = db.asignaturas.find(x => x.id === p.asigId); if (!a) err('Asignatura no encontrada.');
        const texto = String(p.texto || '').trim().slice(0, 1000);
        if (!texto) err('Escribe un mensaje.');
        let nombre, usuario, rolR;
        if (s.rol === 'estudiante') {
          const e = verEst(s.usuario, s.clave);
          if (!db.matriculas.some(m => m.asignaturaId === p.asigId && m.usuario === e.usuario)) err('No estás matriculado en esta asignatura.');
          if (a.chatAbierto !== 'Si') err('El foro está cerrado. Tu profesor lo abrirá cuando corresponda.');
          nombre = e.nombre; usuario = e.usuario; rolR = 'estudiante';
        } else {
          const st = accesoAsig(p.auth, p.asigId);
          nombre = st.nivel === 'dir' ? 'Dirección' : (a.profesorNombre || 'Profesor');
          usuario = st.nivel === 'dir' ? 'direccion' : st.usuario; rolR = st.nivel === 'dir' ? 'direccion' : 'profesor';
        }
        const m = { id: uid('c'), asignaturaId: p.asigId, usuario, nombre, rol: rolR, texto, fecha: now() };
        (db.chat = db.chat || []).push(m); persist();
        return { mensaje: { id: m.id, usuario, nombre, rol: rolR, texto, fecha: m.fecha } };
      }
      case 'eliminarMensaje': {
        const s = p.sesion || {};
        const chat = (db.chat || []).find(c => c.id === p.id); if (!chat) err('Mensaje no encontrado.');
        if (s.rol === 'estudiante') {
          if (chat.usuario !== s.usuario) err('Solo puedes eliminar tus propios mensajes.');
        } else accesoAsig(p.auth, chat.asignaturaId);
        db.chat = db.chat.filter(c => c.id !== p.id); persist(); return { ok: true };
      }
      case 'setChatAbierto': {
        accesoAsig(p.auth, p.asigId);
        const a = db.asignaturas.find(x => x.id === p.asigId);
        a.chatAbierto = p.abierto ? 'Si' : 'No'; persist(); return { ok: true, abierto: p.abierto };
      }

      /* ----- resumen de dirección ----- */
      case 'getResumen': {
        dir(p.auth);
        const grupos = db.grupos.map(g => {
          const es = db.estudiantes.filter(e => e.grupo === g);
          return { grupo: g, total: es.length, activos: es.filter(e => e.estado === 'Activo').length, inactivos: es.filter(e => e.estado !== 'Activo').length };
        });
        const asignaturas = db.asignaturas.map(a => {
          const mat = db.matriculas.filter(m => m.asignaturaId === a.id);
          const pcs = mat.map(m => progresoEst(a.id, m.usuario).pct);
          return { ...a, estudiantes: mat.length, progresoMedio: pcs.length ? Math.round(pcs.reduce((s, x) => s + x, 0) / pcs.length) : 0 };
        });
        return {
          grupos, asignaturas,
          totales: {
            estudiantes: db.estudiantes.length,
            activos: db.estudiantes.filter(e => e.estado === 'Activo').length,
            inactivos: db.estudiantes.filter(e => e.estado !== 'Activo').length,
            asignaturas: db.asignaturas.length,
            profesores: db.profesores.length
          }
        };
      }

      default: err('Acción desconocida: ' + action);
    }
  }

  return { handle, reset: () => { localStorage.removeItem(KEY); } };
})();
