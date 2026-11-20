/* ============================================================
   API.JS · Capa de datos de la plataforma
   · Con CONFIG.api vacío → MODO DEMO (localStorage, sin servidor)
   · Con CONFIG.api lleno  → Google Apps Script (code.gs) + Google Sheets
   Las dos modalidades implementan exactamente las mismas acciones.
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
  const estByU = u => db.estudiantes.find(e => e.usuario.toLowerCase() === String(u || '').toLowerCase());
  function staff(auth) {
    const c = String(auth?.codigo || '').trim();
    for (const [rol, clave] of Object.entries(C().claves)) if (clave === c) return { rol, nombre: { rector: 'Rectoría', decano: 'Decanato', secretaria: 'Secretaría' }[rol] };
    const p = C().profesores.find(x => x.codigo === c);
    if (p) return { rol: 'profesor', nombre: p.nombre, codigo: c };
    err('Código de acceso no válido.');
  }
  const esStaff = auth => { staff(auth); return true; };
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
      case 'loginStaff': return staff(p);

      /* ----- base de estudiantes ----- */
      case 'getEstudiantes': esStaff(p.auth); return db.estudiantes.map(e => ({ ...e }));
      case 'saveEstudiante': {
        esStaff(p.auth);
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
        esStaff(p.auth);
        const viejo = db.estudiantes.find(x => x.id === p.id);
        db.estudiantes = db.estudiantes.filter(x => x.id !== p.id);
        if (viejo) db.matriculas = db.matriculas.filter(x => x.usuario !== viejo.usuario);
        persist(); return { ok: true };
      }

      /* ----- asignaturas ----- */
      case 'getAsignaturas': {
        const s = p.sesion || {};
        if (s.rol === 'estudiante') {
          const mias = db.matriculas.filter(m => m.usuario === s.usuario).map(m => m.asignaturaId);
          return db.asignaturas.filter(a => mias.includes(a.id));
        }
        if (s.rol === 'profesor') return db.asignaturas.filter(a => a.profesor === s.codigo);
        return db.asignaturas; // rector / decano / secretaria → todas
      }
      case 'saveAsignatura': {
        const st = staff(p.auth);
        const a = p.asig;
        if (!a.nombre) err('La asignatura necesita un nombre.');
        if (a.id) {
          const i = db.asignaturas.findIndex(x => x.id === a.id);
          if (i < 0) err('Asignatura no encontrada.');
          db.asignaturas[i] = { ...db.asignaturas[i], ...a };
        } else {
          db.asignaturas.push({ id: uid('asig'), nombre: a.nombre, descripcion: a.descripcion || '', color: a.color || '#14385c', profesor: st.rol === 'profesor' ? st.codigo : 'direccion', profesorNombre: st.nombre, creada: now() });
        }
        persist(); return { ok: true };
      }
      case 'deleteAsignatura': {
        esStaff(p.auth);
        db.asignaturas = db.asignaturas.filter(x => x.id !== p.id);
        db.matriculas = db.matriculas.filter(x => x.asignaturaId !== p.id);
        const xs = db.examenes.filter(x => x.asignaturaId === p.id).map(x => x.id);
        db.examenes = db.examenes.filter(x => x.asignaturaId !== p.id);
        db.preguntas = db.preguntas.filter(x => !xs.includes(x.examenId));
        db.intentos = db.intentos.filter(x => !xs.includes(x.examenId));
        db.pestanas = db.pestanas.filter(x => x.asignaturaId !== p.id);
        db.progreso = db.progreso.filter(x => x.asignaturaId !== p.id);
        db.anuncios = db.anuncios.filter(x => x.asignaturaId !== p.id);
        persist(); return { ok: true };
      }

      /* ----- matrícula ----- */
      case 'getMatriculados': {
        const us = db.matriculas.filter(m => m.asignaturaId === p.asigId).map(m => m.usuario);
        return db.estudiantes.filter(e => us.includes(e.usuario));
      }
      case 'matricular': {
        esStaff(p.auth);
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
        esStaff(p.auth);
        let n = 0;
        db.estudiantes.filter(e => e.grupo === p.grupo).forEach(e => {
          if (!db.matriculas.some(m => m.asignaturaId === p.asigId && m.usuario === e.usuario)) {
            db.matriculas.push({ id: uid('m'), asignaturaId: p.asigId, usuario: e.usuario, grupo: e.grupo, fecha: now() }); n++;
          }
        });
        persist(); return { n };
      }
      case 'desmatricular': {
        esStaff(p.auth);
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
        esStaff(p.auth);
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
        esStaff(p.auth);
        db.pestanas = db.pestanas.filter(x => x.id !== p.id);
        db.progreso = db.progreso.filter(x => !(x.tipo === 'pestaña' && x.itemId === p.id));
        persist(); return { ok: true };
      }
      case 'moverPestana': {
        esStaff(p.auth);
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
        esStaff(p.auth);
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
        esStaff(p.auth);
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
        esStaff(p.auth);
        return db.intentos.filter(x => x.examenId === p.examenId).map(x => ({ ...x, respuestas: undefined }));
      }
      case 'getIntentosAsig': {
        esStaff(p.auth);
        const xs = db.examenes.filter(x => x.asignaturaId === p.asigId).map(x => x.id);
        return db.intentos.filter(x => xs.includes(x.examenId)).map(x => ({ ...x, respuestas: undefined }));
      }

      /* ----- progreso ----- */
      case 'getProgreso': {
        if (p.usuario) return db.progreso.filter(x => x.asignaturaId === p.asigId && x.usuario === p.usuario);
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
        const st = staff(p.auth);
        const a = p.anuncio;
        if (!a.titulo || !a.cuerpo) err('El anuncio necesita título y texto.');
        if (a.id) {
          const i = db.anuncios.findIndex(x => x.id === a.id);
          if (i < 0) err('Anuncio no encontrado.');
          db.anuncios[i] = { ...db.anuncios[i], ...a };
        } else {
          db.anuncios.push({ id: uid('a'), asignaturaId: a.asignaturaId, titulo: a.titulo, cuerpo: a.cuerpo, tag: a.tag || 'Aviso', autor: st.nombre, fecha: now(), pin: !!a.pin });
        }
        persist(); return { ok: true };
      }
      case 'deleteAnuncio': { esStaff(p.auth); db.anuncios = db.anuncios.filter(x => x.id !== p.id); persist(); return { ok: true }; }

      /* ----- resumen de dirección ----- */
      case 'getResumen': {
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
            asignaturas: db.asignaturas.length
          }
        };
      }

      default: err('Acción desconocida: ' + action);
    }
  }

  return { handle, reset: () => { localStorage.removeItem(KEY); } };
})();
