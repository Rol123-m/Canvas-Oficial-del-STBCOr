import { createClient } from "npm:@supabase/supabase-js@2";

const URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};
const fail = (m: string): never => { throw new Error(m); };
const now = () => new Date().toISOString();
const uid = (p: string) => p + "-" + crypto.randomUUID().slice(0, 8);
const clean = (v: any) => String(v ?? "").trim();
async function rows(table: string, query: any = (q: any) => q) {
  const { data, error } = await query(db.from(table).select("*"));
  if (error) throw error;
  return data || [];
}
async function one(table: string, query: any) {
  const { data, error } = await query(db.from(table).select("*")).maybeSingle();
  if (error) throw error;
  return data;
}
async function insert(table: string, value: any) {
  const { data, error } = await db.from(table).insert(value).select("*").single();
  if (error) throw error;
  return data;
}
async function patch(table: string, id: string, value: any, key = "id") {
  const { data, error } = await db.from(table).update(value).eq(key, id).select("*").maybeSingle();
  if (error) throw error;
  return data;
}
async function remove(table: string, id: string, key = "id") {
  const { error } = await db.from(table).delete().eq(key, id);
  if (error) throw error;
}
function b64(bytes: Uint8Array) {
  let s = ""; bytes.forEach(x => s += String.fromCharCode(x)); return btoa(s);
}
function unb64(s: string) {
  return Uint8Array.from(atob(s), c => c.charCodeAt(0));
}
async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 310000, hash: "SHA-256" }, key, 256);
  return "pbkdf2$310000$" + b64(salt) + "$" + b64(new Uint8Array(bits));
}
async function verifyPassword(password: string, encoded: string) {
  try {
    const [kind, iter, saltText, hashText] = encoded.split("$");
    if (kind !== "pbkdf2") return false;
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: unb64(saltText), iterations: Number(iter), hash: "SHA-256" }, key, 256);
    const a = new Uint8Array(bits), b = unb64(hashText);
    if (a.length !== b.length) return false;
    let diff = 0; for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
    return diff === 0;
  } catch { return false; }
}
async function tokenHash(token: string) {
  return b64(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token))));
}
async function makeSession(user: any) {
  const token = b64(crypto.getRandomValues(new Uint8Array(32))) + "." + crypto.randomUUID();
  await insert("canvas_sessions", { token_hash: await tokenHash(token), user_id: user.id, expires_at: new Date(Date.now() + 7 * 86400000).toISOString() });
  return { token, nombre: user.full_name, usuario: user.username, grupo: user.group_name, rol: user.role, email: user.email || "" };
}
async function authenticate(req: Request) {
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) fail("Tu sesión ha caducado. Inicia sesión nuevamente.");
  const h = await tokenHash(token);
  const sess = await one("canvas_sessions", q => q.eq("token_hash", h).gt("expires_at", now()));
  if (!sess) fail("Tu sesión ha caducado. Inicia sesión nuevamente.");
  const user = await one("app_users", q => q.eq("id", sess.user_id));
  if (!user || user.status !== "Activo") fail("La cuenta no está activa.");
  return user;
}
const isDir = (u: any) => ["rector", "decano", "secretaria"].includes(u.role);
const isStaff = (u: any) => isDir(u) || u.role === "profesor";
function requireDir(u: any) { if (!isDir(u)) fail("Esta acción requiere permisos de dirección."); }
function requireStaff(u: any) { if (!isStaff(u)) fail("No tienes permisos para esta acción."); }
async function subject(id: string) {
  const a = await one("subjects", q => q.eq("id", id));
  if (!a) fail("Asignatura no encontrada.");
  return a;
}
async function subjectAccess(u: any, id: string) {
  requireStaff(u);
  const a = await subject(id);
  if (u.role === "profesor" && a.professor_username !== u.username && a.professor2_username !== u.username) fail("Solo puedes gestionar las asignaturas que tienes asignadas.");
  return a;
}
async function enrolled(u: any, sid: string) {
  if (u.role === "estudiante") {
    const m = await one("enrollments", q => q.eq("subject_id", sid).eq("student_username", u.username));
    if (!m) fail("No estás matriculado en esta asignatura.");
  } else await subjectAccess(u, sid);
}
const mapUser = (u: any) => ({ id: u.id, nombre: u.full_name, usuario: u.username, grupo: u.group_name || "", estado: u.status, email: u.email || "", rol: u.role });
const mapSubject = (a: any) => ({ id: a.id, nombre: a.name, descripcion: a.description, color: a.color, profesor: a.professor_username || "", profesorNombre: [a.professor_name, a.professor2_name].filter(Boolean).join(" · "), segundoProfesor: a.professor2_username || "", segundoProfesorNombre: a.professor2_name || "", profesoresNombres: [a.professor_name, a.professor2_name].filter(Boolean).join(" · "), chatAbierto: a.chat_open ? "Si" : "No", creada: a.created_at });
const mapModule = (m: any) => ({ id: m.id, asignaturaId: m.subject_id, titulo: m.title, icono: m.icon, tipo: m.kind, contenido: m.content, orden: m.sort_order, visible: m.visible });
const mapExam = (e: any) => ({ id: e.id, asignaturaId: e.subject_id, titulo: e.title, descripcion: e.description, visible: e.visible, creado: e.created_at });
const mapQuestion = (q: any, reveal = false) => {
  const metadata: any = { ...(q.metadata || {}) };
  if (!reveal) { delete metadata.accepted; delete metadata.correct_text; delete metadata.pairs; delete metadata.model_answer; }
  const x: any = { id: q.id, examenId: q.exam_id, tipo: q.kind, texto: q.prompt, opciones: q.options, metadata, puntos: Number(q.points), orden: q.sort_order };
  if (reveal) { x.correcta = q.correct_answer; x.metadata = q.metadata || {}; }
  return x;
};
const mapAnnouncement = (a: any) => ({ id: a.id, asignaturaId: a.subject_id, titulo: a.title, cuerpo: a.body, tag: a.tag, autor: a.author, fecha: a.published_at, pin: a.pinned });
const mapProgress = (p: any) => ({ id: p.id, asignaturaId: p.subject_id, usuario: p.student_username, nombre: p.student_name, tipo: p.item_type, itemId: p.item_id, completado: p.completed, fecha: p.updated_at });
async function professorCredential(name: string, email = "") {
  const base = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "").split(".").slice(0, 2).join(".") || "prof";
  let username = base, n = 2;
  while (await one("app_users", q => q.eq("username", username))) username = base + n++;
  const password = Array.from(crypto.getRandomValues(new Uint8Array(10))).map(x => "abcdefghjkmnpqrstuvwxyz23456789"[x % 32]).join("");
  const u = await insert("app_users", { username, full_name: name, email, role: "profesor", status: "Activo", password_hash: await hashPassword(password) });
  return { user: u, credentials: { nombre: name, usuario: username, clave: password, email } };
}
async function progressSummary(sid: string, username: string) {
  const [mods, exams, progress] = await Promise.all([
    rows("modules", q => q.eq("subject_id", sid).eq("visible", true)),
    rows("exams", q => q.eq("subject_id", sid).eq("visible", true)),
    rows("progress", q => q.eq("subject_id", sid).eq("student_username", username))
  ]);
  const doneM = new Set(progress.filter(x => x.item_type === "pestaña" && x.completed).map(x => x.item_id));
  const doneE = new Set(progress.filter(x => x.item_type === "examen" && x.completed).map(x => x.item_id));
  const total = mods.length + exams.length;
  const done = mods.filter(x => doneM.has(x.id)).length + exams.filter(x => doneE.has(x.id)).length;
  return { done, tot: total, pct: total ? Math.round(done / total * 100) : 0 };
}
async function uploadResourceToRepository(subjectId: string, filename: string, mime: string, base64: string) {
  const token = Deno.env.get("GITHUB_TOKEN");
  if (!token) fail("La carga al repositorio todavía no está configurada. La dirección debe añadir el secreto GITHUB_TOKEN en Supabase Functions.");
  const raw = clean(filename).split(/[\\/]/).pop() || "recurso";
  const extMatch = raw.match(/\.(html?|png|jpe?g|webp|gif)$/i);
  if (!extMatch) fail("Solo se permiten archivos HTML, PNG, JPG, WEBP o GIF.");
  const ext = extMatch[0].toLowerCase();
  const isHtml = ext === ".html" || ext === ".htm";
  const expectedMime: Record<string, string> = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif" };
  if (isHtml && mime && !["text/html", "application/xhtml+xml", "application/octet-stream"].includes(mime)) fail("El tipo de archivo HTML no es válido.");
  if (!isHtml && mime && mime !== expectedMime[ext] && mime !== "application/octet-stream") fail("El tipo de imagen no coincide con su extensión.");
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64) || base64.length % 4 !== 0) fail("El archivo recibido no tiene un formato válido.");
  let bytes: Uint8Array;
  try { bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0)); } catch { fail("No se pudo decodificar el archivo."); }
  const max = isHtml ? 1024 * 1024 : 5 * 1024 * 1024;
  if (bytes.length < 1 || bytes.length > max) fail(isHtml ? "Los archivos HTML no pueden superar 1 MB." : "Las imágenes no pueden superar 5 MB.");
  const stem = raw.slice(0, -ext.length).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 55) || "recurso";
  // Las páginas HTML se publican como .html.txt (text/plain) y la app las muestra
  // mediante iframe srcdoc con sandbox, evitando ejecución en el origen principal.
  const safeName = stem + "-" + crypto.randomUUID().slice(0, 8) + ext + (isHtml ? ".txt" : "");
  const path = "recursos/" + encodeURIComponent(subjectId) + "/" + encodeURIComponent(safeName);
  const response = await fetch("https://api.github.com/repos/Rol123-m/Canvas-Oficial-del-STBCOr/contents/" + path, {
    method: "PUT",
    headers: { "Authorization": "Bearer " + token, "Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "Content-Type": "application/json" },
    body: JSON.stringify({ message: "Añadir recurso educativo de asignatura", content: base64, branch: "main" })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) fail("GitHub no pudo publicar el archivo (" + response.status + "): " + clean(result.message || "error de repositorio"));
  const url = "https://rol123-m.github.io/Canvas-Oficial-del-STBCOr/recursos/" + encodeURIComponent(subjectId) + "/" + encodeURIComponent(safeName);
  return { url, filename: safeName, kind: isHtml ? "html" : "image" };
}
async function handle(action: string, p: any, u: any) {
  const asigId = clean(p.asigId || p.asig?.id || p.pesta?.asignaturaId || p.examen?.asignaturaId || p.anuncio?.asignaturaId);
  switch (action) {
    case "ping": return { ok: true, modo: "supabase" };
    case "login":
    case "loginProfesor":
    case "loginStaff": {
      const code = clean(p.codigo);
      const prefix = code.split("-")[0];
      const username = action === "loginStaff" ? prefix : clean(p.u).toLowerCase();
      const roleFilter = action === "login" ? ["estudiante"] : action === "loginProfesor" ? ["profesor"] : ["rector", "decano", "secretaria"];
      let candidates;
      if (action === "loginStaff") {
        if (!["rector", "decano", "secretaria"].includes(prefix)) fail("Clave de acceso no válida.");
        candidates = await rows("app_users", q => q.eq("role", prefix).eq("status", "Activo"));
      } else candidates = await rows("app_users", q => q.eq("username", username).in("role", roleFilter));
      const found = await (async () => { for (const x of candidates) if (await verifyPassword(clean(action === "loginStaff" ? p.codigo : p.p), x.password_hash)) return x; return null; })();
      if (!found || found.status !== "Activo") fail(action === "loginStaff" ? "Clave de acceso no válida." : "Usuario o contraseña incorrectos.");
      return await makeSession(found);
    }
    default: break;
  }
  if (!u) fail("Inicia sesión para continuar.");
  switch (action) {
    case "getEstudiantes": {
      requireDir(u);
      return (await rows("app_users", q => q.eq("role", "estudiante").order("full_name"))).map(mapUser);
    }
    case "getCandidatosMatricula": {
      await subjectAccess(u, p.asigId);
      return (await rows("app_users", q => q.eq("role", "estudiante").order("full_name"))).map(mapUser);
    }
    case "saveEstudiante": {
      requireDir(u);
      const e = p.est || {};
      if (!clean(e.nombre) || !clean(e.usuario)) fail("Nombre y usuario son obligatorios.");
      const existing = await one("app_users", q => q.eq("username", clean(e.usuario).toLowerCase()));
      const data: any = { full_name: e.nombre, username: clean(e.usuario).toLowerCase(), group_name: e.grupo || "1.er año", status: e.estado || "Activo", role: "estudiante" };
      if (clean(e.clave)) data.password_hash = await hashPassword(e.clave);
      if (e.id) {
        const { data: updated, error } = await db.from("app_users").update(data).eq("id", e.id).eq("role", "estudiante").select("id").maybeSingle();
        if (error) throw error; if (!updated) fail("Estudiante no encontrado.");
      } else {
        if (!clean(e.clave)) fail("El estudiante nuevo necesita contraseña.");
        if (existing) fail("Ya existe un estudiante con ese usuario.");
        data.password_hash = await hashPassword(e.clave); await insert("app_users", data);
      }
      return { ok: true };
    }
    case "deleteEstudiante": {
      requireDir(u);
      const old = await one("app_users", q => q.eq("id", p.id).eq("role", "estudiante"));
      if (old) await remove("app_users", old.id);
      return { ok: true };
    }
    case "importarEstudiantes": {
      requireDir(u);
      let nuevos = 0, actualizados = 0;
      for (const line of String(p.texto || "").split(/\r?\n/)) {
        const v = line.trim().split(/[;,\t]/).map((x: string) => x.trim());
        if (!v[0] || /nombre/i.test(v[0]) || !v[2] || !v[3]) continue;
        const [nombre, grupo, usuario, clave, estado] = v;
        const old = await one("app_users", q => q.eq("username", usuario.toLowerCase()));
        const d: any = { full_name: nombre, group_name: grupo || "Sin grupo", status: estado || "Activo", role: "estudiante" };
        if (clave) d.password_hash = await hashPassword(clave);
        if (old) { await patch("app_users", old.id, d); actualizados++; }
        else { d.username = usuario.toLowerCase(); if (!clave) continue; await insert("app_users", d); nuevos++; }
      }
      return { nuevos, actualizados };
    }
    case "getProfesores": {
      requireDir(u);
      return (await rows("app_users", q => q.eq("role", "profesor").order("full_name"))).map(mapUser);
    }
    case "saveProfesor": {
      requireDir(u);
      const q = p.prof || {};
      if (!clean(q.nombre)) fail("El profesor necesita un nombre.");
      if (q.id) {
        const d: any = { full_name: q.nombre, email: q.email || "", status: q.estado || "Activo" };
        if (q.clave) d.password_hash = await hashPassword(q.clave);
        const updated = await patch("app_users", q.id, d);
        if (!updated) fail("Profesor no encontrado.");
        return { ok: true, credenciales: q.clave ? { nombre: q.nombre, usuario: updated.username, clave: q.clave, email: q.email || "" } : null };
      }
      const made = await professorCredential(q.nombre, q.email || "");
      return { ok: true, credenciales: made.credentials };
    }
    case "resetClaveProfesor": {
      requireDir(u);
      const pr = await one("app_users", q => q.eq("username", clean(p.usuario)).eq("role", "profesor"));
      if (!pr) fail("Profesor no encontrado.");
      const password = Array.from(crypto.getRandomValues(new Uint8Array(10))).map(x => "abcdefghjkmnpqrstuvwxyz23456789"[x % 32]).join("");
      await patch("app_users", pr.id, { password_hash: await hashPassword(password) });
      return { credenciales: { nombre: pr.full_name, usuario: pr.username, clave: password, email: pr.email || "" } };
    }
    case "deleteProfesor": {
      requireDir(u);
      const { error: subjectError } = await db.from("subjects").update({ professor_username: null, professor_name: "" }).eq("professor_username", clean(p.usuario));
      if (subjectError) throw subjectError;
      const pr = await one("app_users", q => q.eq("username", clean(p.usuario)).eq("role", "profesor"));
      if (pr) await remove("app_users", pr.id);
      return { ok: true };
    }
    case "getAsignaturas": {
      if (u.role === "estudiante") {
        const es = await rows("enrollments", q => q.eq("student_username", u.username));
        if (!es.length) return [];
        return (await rows("subjects", q => q.in("id", es.map(x => x.subject_id)))).map(mapSubject);
      }
      if (u.role === "profesor") return (await rows("subjects", q => q.or("professor_username.eq." + u.username + ",professor2_username.eq." + u.username))).map(mapSubject);
      requireDir(u);
      return (await rows("subjects")).map(mapSubject);
    }
    case "saveAsignatura": {
      const a = p.asig || {};
      if (!clean(a.nombre)) fail("La asignatura necesita un nombre.");
      if (a.id) {
        const old = await subject(a.id);
        if (u.role === "profesor") {
          await subjectAccess(u, a.id);
          await patch("subjects", a.id, { name: a.nombre, description: a.descripcion || "", color: a.color || old.color });
        } else {
          requireDir(u);
          await patch("subjects", a.id, { name: a.nombre, description: a.descripcion || "", color: a.color || old.color });
        }
        return { ok: true };
      }
      requireDir(u);
      let profUser = "", profName = "", credentials = null;
      if (a.profesorUsuario === "__nuevo__") {
        const made = await professorCredential(a.profesorNuevo?.nombre || "", a.profesorNuevo?.email || "");
        profUser = made.user.username; profName = made.user.full_name; credentials = made.credentials;
      } else if (a.profesorUsuario) {
        const pr = await one("app_users", q => q.eq("username", a.profesorUsuario).eq("role", "profesor"));
        if (!pr) fail("Profesor no encontrado."); profUser = pr.username; profName = pr.full_name;
      }
      const id = uid("asig");
      await insert("subjects", { id, name: a.nombre, description: a.descripcion || "", color: a.color || "#14385c", professor_username: profUser || null, professor_name: profName, chat_open: false });
      for (const group of (a.grupos || [])) {
        const es = await rows("app_users", q => q.eq("role", "estudiante").eq("group_name", group).eq("status", "Activo"));
        for (const e of es) {
          const exists = await one("enrollments", q => q.eq("subject_id", id).eq("student_username", e.username));
          if (!exists) await insert("enrollments", { id: uid("m"), subject_id: id, student_username: e.username, group_name: e.group_name });
        }
      }
      return { ok: true, credenciales: credentials };
    }
    case "setProfesorAsignatura": {
      requireDir(u);
      const a = await subject(p.asigId);
      let prof, credentials = null;
      if (p.modo === "nuevo") {
        const made = await professorCredential(p.nombre || "", p.email || "");
        prof = made.user; credentials = made.credentials;
      } else {
        prof = await one("app_users", q => q.eq("username", p.usuario).eq("role", "profesor"));
        if (!prof) fail("Profesor no encontrado.");
      }
      await patch("subjects", a.id, { professor_username: prof.username, professor_name: prof.full_name });
      return { ok: true, credenciales: credentials };
    }
    case "deleteAsignatura": {
      requireDir(u); await remove("subjects", p.id); return { ok: true };
    }
    case "getMatriculados": {
      await subjectAccess(u, p.asigId);
      const ms = await rows("enrollments", q => q.eq("subject_id", p.asigId));
      if (!ms.length) return [];
      return (await rows("app_users", q => q.eq("role", "estudiante").in("username", ms.map(x => x.student_username)))).map(mapUser);
    }
    case "matricular": {
      await subjectAccess(u, p.asigId); let n = 0;
      for (const username of (p.usuarios || [])) {
        const e = await one("app_users", q => q.eq("username", username).eq("role", "estudiante"));
        if (!e) continue;
        const exists = await one("enrollments", q => q.eq("subject_id", p.asigId).eq("student_username", e.username));
        if (!exists) { await insert("enrollments", { id: uid("m"), subject_id: p.asigId, student_username: e.username, group_name: e.group_name || "" }); n++; }
      }
      return { n };
    }
    case "matricularGrupo": {
      await subjectAccess(u, p.asigId); let n = 0;
      const es = await rows("app_users", q => q.eq("role", "estudiante").eq("group_name", p.grupo).eq("status", "Activo"));
      for (const e of es) {
        const exists = await one("enrollments", q => q.eq("subject_id", p.asigId).eq("student_username", e.username));
        if (!exists) { await insert("enrollments", { id: uid("m"), subject_id: p.asigId, student_username: e.username, group_name: e.group_name || "" }); n++; }
      }
      return { n };
    }
    case "desmatricular": {
      requireDir(u);
      await subject(p.asigId);
      const { error } = await db.from("enrollments").delete().eq("subject_id", p.asigId).eq("student_username", p.usuario);
      if (error) throw error; return { ok: true };
    }
    case "getPestanas": {
      await enrolled(u, p.asigId);
      let q = db.from("modules").select("*").eq("subject_id", p.asigId).order("sort_order");
      if (!p.todas) q = q.eq("visible", true);
      const { data, error } = await q; if (error) throw error; return (data || []).map(mapModule);
    }
    case "uploadResource": {
      await subjectAccess(u, p.asigId);
      const uploaded = await uploadResourceToRepository(clean(p.asigId), clean(p.filename), clean(p.mime), clean(p.base64));
      return uploaded;
    }
    case "savePestana": {
      const t = p.pesta || {}; await subjectAccess(u, t.asignaturaId);
      const value = { title: t.titulo || "Nuevo módulo", icon: t.icono || "fa-book", kind: t.tipo || "contenido", content: t.contenido || "", visible: t.visible !== false };
      if (t.id) { const r = await patch("modules", t.id, value); if (!r) fail("Módulo no encontrado."); }
      else {
        const old = await rows("modules", q => q.eq("subject_id", t.asignaturaId));
        await insert("modules", { id: uid("p"), subject_id: t.asignaturaId, ...value, sort_order: old.reduce((m, x) => Math.max(m, x.sort_order || 0), 0) + 1 });
      }
      return { ok: true };
    }
    case "deletePestana": {
      const mod = await one("modules", q => q.eq("id", p.id)); if (!mod) fail("Módulo no encontrado.");
      await subjectAccess(u, mod.subject_id); await remove("modules", p.id);
      await db.from("progress").delete().eq("item_type", "pestaña").eq("item_id", p.id);
      return { ok: true };
    }
    case "moverPestana": {
      const mod = await one("modules", q => q.eq("id", p.id)); if (!mod) fail("Módulo no encontrado.");
      await subjectAccess(u, mod.subject_id);
      const all = await rows("modules", q => q.eq("subject_id", mod.subject_id).order("sort_order"));
      const i = all.findIndex(x => x.id === mod.id), j = i + (p.dir === "up" ? -1 : 1);
      if (j >= 0 && j < all.length) {
        await patch("modules", all[i].id, { sort_order: all[j].sort_order });
        await patch("modules", all[j].id, { sort_order: all[i].sort_order });
      }
      return { ok: true };
    }
    case "getExamenes": {
      await enrolled(u, p.asigId);
      let q = db.from("exams").select("*").eq("subject_id", p.asigId).order("created_at");
      if (!p.todas) q = q.eq("visible", true);
      const { data, error } = await q; if (error) throw error;
      const out = [];
      for (const e of (data || [])) {
        const qs = await rows("questions", x => x.eq("exam_id", e.id));
        out.push({ ...mapExam(e), nPreg: qs.length });
      }
      return out;
    }
    case "getExamen": {
      const ex = await one("exams", q => q.eq("id", p.id)); if (!ex) fail("Examen no encontrado.");
      await enrolled(u, ex.subject_id);
      const qs = await rows("questions", q => q.eq("exam_id", ex.id).order("sort_order"));
      return { ...mapExam(ex), preguntas: qs.map(q => mapQuestion(q, u.role !== "estudiante")) };
    }
    case "saveExamen": {
      const ex = p.examen || {}; await subjectAccess(u, ex.asignaturaId || (ex.id ? (await one("exams", q => q.eq("id", ex.id)))?.subject_id : ""));
      if (!clean(ex.titulo)) fail("El examen necesita un título.");
      let id = ex.id;
      if (id) {
        const old = await one("exams", q => q.eq("id", id)); if (!old) fail("Examen no encontrado.");
        await patch("exams", id, { title: ex.titulo, description: ex.descripcion || "", visible: ex.visible !== false });
        await db.from("questions").delete().eq("exam_id", id);
      } else {
        id = uid("x");
        await insert("exams", { id, subject_id: ex.asignaturaId, title: ex.titulo, description: ex.descripcion || "", visible: ex.visible !== false });
      }
      const qs = (ex.preguntas || []).map((q: any, i: number) => ({ id: uid("q"), exam_id: id, kind: q.tipo || "sm", prompt: q.texto || "", options: q.tipo === "vf" ? ["Verdadero", "Falso"] : (q.opciones || []), correct_answer: ["comprension", "red"].includes(q.tipo) ? 0 : (q.tipo === "emp" ? 0 : Number(q.correcta || 0)), metadata: q.metadata || {}, points: Number(q.puntos || 1), sort_order: i + 1 }));
      if (qs.length) { const { error } = await db.from("questions").insert(qs); if (error) throw error; }
      return { id };
    }
    case "deleteExamen": {
      const ex = await one("exams", q => q.eq("id", p.id)); if (!ex) fail("Examen no encontrado.");
      await subjectAccess(u, ex.subject_id); await remove("exams", p.id); return { ok: true };
    }
    case "enviarIntento": {
      if (u.role !== "estudiante") fail("Solo un estudiante puede entregar este examen.");
      const ex = await one("exams", q => q.eq("id", p.examenId).eq("visible", true)); if (!ex) fail("Examen no encontrado.");
      await enrolled(u, ex.subject_id);
      const priorAttempt = await one("exam_attempts", q => q.eq("exam_id", ex.id).eq("student_username", u.username));
      if (priorAttempt) fail("Este examen permite una sola oportunidad y ya fue entregado.");
      const qs = await rows("questions", q => q.eq("exam_id", ex.id).order("sort_order"));
      const answers = Array.isArray(p.respuestas) ? p.respuestas : [];
      let score = 0; const total = qs.reduce((s, q) => s + Number(q.points || 0), 0);
      const autoTotal = qs.filter(q => q.kind !== "comprension" && q.kind !== "red").reduce((s, q) => s + Number(q.points || 0), 0);
      let pending = false;
      const detail = qs.map((q, i) => {
        const raw = answers[i] ?? null, meta = q.metadata || {}, kind = q.kind;
        let ok: boolean | null = false, earned = 0;
        if (kind === "comprension" || kind === "red") { pending = true; ok = null; }
        else if (kind === "sm" || kind === "vf") { const selected = raw === null ? null : Number(raw); ok = selected !== null && selected === Number(q.correct_answer); if (ok) earned = Number(q.points || 0); }
        else if (kind === "emp") { const norm = (v: any) => String(v ?? "").normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").toLowerCase().trim().replace(/\\s+/g, " "); const accepted = (meta.accepted || [meta.correct_text || ""]).map((v: any) => norm(v)); ok = raw !== null && accepted.includes(norm(raw)); if (ok) earned = Number(q.points || 0); }
        else if (kind === "rel") { const pairs = meta.pairs || []; const submitted = raw && typeof raw === "object" ? raw : {}; const matched = pairs.filter((pair: any) => String(submitted[pair.left] ?? "") === String(pair.right)); earned = pairs.length ? Number(q.points || 0) * matched.length / pairs.length : 0; ok = pairs.length > 0 && matched.length === pairs.length; }
        score += earned;
        return { preguntaId: q.id, tipo: kind, texto: q.prompt, respuesta: raw, opciones: q.options, metadata: meta, correcta: (kind === "sm" || kind === "vf") ? Number(q.correct_answer) : null, ok, puntos: Number(q.points || 0), obtenido: earned };
      });
      const attempt = await insert("exam_attempts", { id: uid("i"), exam_id: ex.id, student_username: u.username, student_name: u.full_name, score, total, answers, review_status: pending ? "pending" : "graded" });
      const old = await one("progress", q => q.eq("subject_id", ex.subject_id).eq("student_username", u.username).eq("item_type", "examen").eq("item_id", ex.id));
      if (old) await patch("progress", old.id, { completed: true, updated_at: now() });
      else await insert("progress", { id: uid("g"), subject_id: ex.subject_id, student_username: u.username, student_name: u.full_name, item_type: "examen", item_id: ex.id, completed: true });
      return { intentoId: attempt.id, puntaje: score, total, totalAutomatico: autoTotal, pendienteRevision: pending, pct: autoTotal ? Math.round(score / autoTotal * 100) : 0, detalle: detail };
    }
    case "getIntentos": {
      const ex = await one("exams", q => q.eq("id", p.examenId)); if (!ex) fail("Examen no encontrado.");
      await subjectAccess(u, ex.subject_id);
      return (await rows("exam_attempts", q => q.eq("exam_id", p.examenId).order("attempted_at", { ascending: false }))).map(x => ({ id: x.id, examenId: x.exam_id, usuario: x.student_username, nombre: x.student_name, fecha: x.attempted_at, puntaje: x.review_status === "graded" && x.reviewed_score !== null ? x.reviewed_score : x.score, puntajeAutomatico: x.score, total: x.total, estadoRevision: x.review_status || "graded", notaFinal: x.reviewed_score, comentario: x.feedback }));
    }
    case "getIntentoDetalle": {
      const attempt = await one("exam_attempts", q => q.eq("id", p.intentoId)); if (!attempt) fail("Intento no encontrado.");
      const ex = await one("exams", q => q.eq("id", attempt.exam_id)); if (!ex) fail("Examen no encontrado.");
      await subjectAccess(u, ex.subject_id);
      const qs = await rows("questions", q => q.eq("exam_id", ex.id).order("sort_order"));
      return { intento: { id: attempt.id, examenId: ex.id, usuario: attempt.student_username, nombre: attempt.student_name, fecha: attempt.attempted_at, puntaje: Number(attempt.score), total: Number(attempt.total), estadoRevision: attempt.review_status || "graded", notaFinal: attempt.reviewed_score, comentario: attempt.feedback, respuestas: attempt.answers || [] }, preguntas: qs.map(q => mapQuestion(q, true)) };
    }
    case "revisarIntento": {
      const attempt = await one("exam_attempts", q => q.eq("id", p.intentoId)); if (!attempt) fail("Intento no encontrado.");
      const ex = await one("exams", q => q.eq("id", attempt.exam_id)); if (!ex) fail("Examen no encontrado.");
      await subjectAccess(u, ex.subject_id);
      if ((attempt.review_status || "graded") !== "pending") fail("Este intento ya fue revisado.");
      const qs = await rows("questions", q => q.eq("exam_id", ex.id).order("sort_order"));
      const answers = Array.isArray(attempt.answers) ? attempt.answers : [];
      const autoScore = Number(attempt.score || 0);
      let manualScore = 0, manualTotal = 0;
      for (let i = 0; i < qs.length; i++) {
        const q = qs[i]; if (q.kind !== "comprension" && q.kind !== "red") continue;
        const max = Number(q.points || 0); manualTotal += max;
        const item = (p.calificaciones || []).find((x: any) => x.preguntaId === q.id);
        const awarded = Number(item?.puntos ?? 0);
        if (!Number.isFinite(awarded) || awarded < 0 || awarded > max) fail("La puntuación de cada respuesta debe estar entre 0 y " + max + ".");
        manualScore += awarded;
      }
      const finalScore = autoScore + manualScore;
      await patch("exam_attempts", attempt.id, { reviewed_score: finalScore, review_status: "graded", reviewed_at: now(), reviewed_by: u.username, feedback: clean(p.comentario || "").slice(0, 4000) });
      return { ok: true, puntaje: finalScore, total: Number(attempt.total), pct: Number(attempt.total) ? Math.round(finalScore / Number(attempt.total) * 100) : 0 };
    }
    case "getIntentosAsig": {
      await subjectAccess(u, p.asigId);
      const exs = await rows("exams", q => q.eq("subject_id", p.asigId));
      if (!exs.length) return [];
      const ats = await rows("exam_attempts", q => q.in("exam_id", exs.map(x => x.id)).order("attempted_at", { ascending: false }));
      return ats.map(x => ({ id: x.id, examenId: x.exam_id, usuario: x.student_username, nombre: x.student_name, fecha: x.attempted_at, puntaje: x.review_status === "graded" && x.reviewed_score !== null ? x.reviewed_score : x.score, puntajeAutomatico: x.score, total: x.total, estadoRevision: x.review_status || "graded" }));
    }
    case "getProgreso": {
      if (u.role === "estudiante") {
        await enrolled(u, p.asigId);
        return (await rows("progress", q => q.eq("subject_id", p.asigId).eq("student_username", u.username))).map(mapProgress);
      }
      await subjectAccess(u, p.asigId);
      return (await rows("progress", q => q.eq("subject_id", p.asigId))).map(mapProgress);
    }
    case "setProgreso": {
      if (u.role !== "estudiante") fail("Solo los estudiantes pueden actualizar su progreso.");
      await enrolled(u, p.asigId);
      const old = await one("progress", q => q.eq("subject_id", p.asigId).eq("student_username", u.username).eq("item_type", "pestaña").eq("item_id", p.itemId));
      if (old) await patch("progress", old.id, { completed: !!p.completado, updated_at: now() });
      else await insert("progress", { id: uid("g"), subject_id: p.asigId, student_username: u.username, student_name: u.full_name, item_type: "pestaña", item_id: p.itemId, completed: !!p.completado });
      return { ok: true };
    }
    case "getMisNotas": {
      if (u.role !== "estudiante") fail("Acción solo disponible para estudiantes.");
      await enrolled(u, p.asigId);
      const exs = await rows("exams", q => q.eq("subject_id", p.asigId));
      if (!exs.length) return [];
      return (await rows("exam_attempts", q => q.eq("student_username", u.username).in("exam_id", exs.map(x => x.id)).order("attempted_at", { ascending: false }))).map(x => ({ examenId: x.exam_id, puntaje: x.review_status === "graded" && x.reviewed_score !== null ? x.reviewed_score : x.score, puntajeAutomatico: x.score, total: x.total, estadoRevision: x.review_status || "graded", comentario: x.feedback || "", fecha: x.attempted_at }));
    }
    case "getAnuncios": {
      await enrolled(u, p.asigId);
      return (await rows("announcements", q => q.eq("subject_id", p.asigId).order("pinned", { ascending: false }).order("published_at", { ascending: false }))).map(mapAnnouncement);
    }
    case "saveAnuncio": {
      const a = p.anuncio || {}; await subjectAccess(u, a.asignaturaId);
      if (!clean(a.titulo) || !clean(a.cuerpo)) fail("El anuncio necesita título y texto.");
      if (a.id) await patch("announcements", a.id, { title: a.titulo, body: a.cuerpo, tag: a.tag || "Aviso", pinned: !!a.pin });
      else await insert("announcements", { id: uid("a"), subject_id: a.asignaturaId, title: a.titulo, body: a.cuerpo, tag: a.tag || "Aviso", author: u.full_name, pinned: !!a.pin });
      return { ok: true };
    }
    case "deleteAnuncio": {
      const a = await one("announcements", q => q.eq("id", p.id)); if (!a) fail("Anuncio no encontrado.");
      await subjectAccess(u, a.subject_id); await remove("announcements", p.id); return { ok: true };
    }
    case "getForo": {
      await enrolled(u, p.asigId);
      const a = await subject(p.asigId);
      const { data: foundThreads, error: te } = await db.from("forum_threads").select("*").eq("subject_id", p.asigId).order("updated_at", { ascending: false }).limit(100);
      if (te) throw te;
      let threads = foundThreads || [];
      // Migra el chat antiguo a una conversación histórica, sin perder mensajes.
      if (!threads.length) {
        const legacy = await rows("chat_messages", q => q.eq("subject_id", p.asigId).order("created_at", { ascending: true }));
        if (legacy.length) {
          const first = legacy[0], id = uid("h");
          const h = await insert("forum_threads", { id, subject_id: p.asigId, title: "Historial del foro de dudas", author_username: first.username, author_name: first.display_name, status: "closed" });
          for (const old of legacy) await insert("forum_posts", { id: uid("fp"), thread_id: id, username: old.username, display_name: old.display_name, role: old.role, message: old.message, created_at: old.created_at });
          threads = [h];
        }
      }
      const summaries = [];
      for (const h of (threads || [])) {
        const posts = await rows("forum_posts", q => q.eq("thread_id", h.id).order("created_at", { ascending: false }).limit(1));
        const count = await rows("forum_posts", q => q.eq("thread_id", h.id));
        const last = posts[0];
        summaries.push({ id: h.id, titulo: h.title, estado: h.status, autorUsuario: h.author_username, autor: h.author_name, fecha: h.created_at, actualizado: h.updated_at, respuestas: Math.max(0, count.length - 1), ultimoTexto: last?.message || "", ultimoAutor: last?.display_name || "" });
      }
      let actual = null, mensajes = [];
      if (p.threadId) {
        const h = await one("forum_threads", q => q.eq("id", p.threadId).eq("subject_id", p.asigId));
        if (!h) fail("La conversación no existe o pertenece a otra asignatura.");
        actual = { id: h.id, titulo: h.title, estado: h.status, autorUsuario: h.author_username, autor: h.author_name, fecha: h.created_at };
        mensajes = (await rows("forum_posts", q => q.eq("thread_id", h.id).order("created_at", { ascending: true }))).map(m => ({ id: m.id, usuario: m.username, nombre: m.display_name, rol: m.role, texto: m.message, fecha: m.created_at }));
      }
      return { abierto: !!a.chat_open, conversaciones: summaries, actual, mensajes };
    }
    case "crearConversacion": {
      const a = await subject(p.asigId);
      if (u.role === "estudiante") { await enrolled(u, p.asigId); if (!a.chat_open) fail("El foro está cerrado para nuevas conversaciones."); }
      else await subjectAccess(u, p.asigId);
      const title = clean(p.titulo).slice(0, 120), message = clean(p.texto).slice(0, 4000);
      if (!title || !message) fail("Escribe un título y un mensaje inicial.");
      const id = uid("h");
      const h = await insert("forum_threads", { id, subject_id: p.asigId, title, author_username: u.username, author_name: u.full_name, status: "open" });
      const m = await insert("forum_posts", { id: uid("fp"), thread_id: id, username: u.username, display_name: isDir(u) ? "Dirección" : u.full_name, role: isDir(u) ? "direccion" : u.role, message });
      return { actual: { id: h.id, titulo: h.title, estado: h.status, autorUsuario: h.author_username, autor: h.author_name, fecha: h.created_at }, mensajes: [{ id: m.id, usuario: m.username, nombre: m.display_name, rol: m.role, texto: m.message, fecha: m.created_at }] };
    }
    case "responderConversacion": {
      const h = await one("forum_threads", q => q.eq("id", p.threadId).eq("subject_id", p.asigId));
      if (!h) fail("Conversación no encontrada.");
      const a = await subject(p.asigId);
      if (h.status !== "open") fail("Esta conversación ya fue finalizada.");
      if (u.role === "estudiante") { await enrolled(u, p.asigId); if (!a.chat_open) fail("El foro está cerrado para nuevas respuestas."); }
      else await subjectAccess(u, p.asigId);
      const message = clean(p.texto).slice(0, 4000); if (!message) fail("Escribe una respuesta.");
      const m = await insert("forum_posts", { id: uid("fp"), thread_id: h.id, username: u.username, display_name: isDir(u) ? "Dirección" : u.full_name, role: isDir(u) ? "direccion" : u.role, message });
      await patch("forum_threads", h.id, { updated_at: now() });
      return { mensaje: { id: m.id, usuario: m.username, nombre: m.display_name, rol: m.role, texto: m.message, fecha: m.created_at } };
    }
    case "cerrarConversacion": {
      const h = await one("forum_threads", q => q.eq("id", p.threadId).eq("subject_id", p.asigId));
      if (!h) fail("Conversación no encontrada.");
      await subjectAccess(u, p.asigId);
      await patch("forum_threads", h.id, { status: "closed", closed_at: now(), updated_at: now() });
      return { ok: true };
    }
    case "eliminarConversacion": {
      const h = await one("forum_threads", q => q.eq("id", p.threadId).eq("subject_id", p.asigId));
      if (!h) fail("Conversación no encontrada.");
      if (u.role === "estudiante") {
        await enrolled(u, p.asigId);
        if (h.author_username !== u.username) fail("Solo puedes eliminar conversaciones que hayas iniciado.");
        const replies = await rows("forum_posts", q => q.eq("thread_id", h.id).neq("username", u.username));
        if (replies.length) fail("Esta conversación ya tiene respuestas de otros participantes. Pide al profesor que la elimine.");
      } else await subjectAccess(u, p.asigId);
      await remove("forum_threads", h.id);
      return { ok: true };
    }
    case "eliminarRespuesta": {
      const m = await one("forum_posts", q => q.eq("id", p.postId));
      if (!m) fail("Respuesta no encontrada.");
      const h = await one("forum_threads", q => q.eq("id", m.thread_id).eq("subject_id", p.asigId));
      if (!h) fail("Conversación no encontrada.");
      if (u.role === "estudiante") {
        await enrolled(u, p.asigId);
        if (m.username !== u.username) fail("Solo puedes eliminar tus propias respuestas.");
      } else await subjectAccess(u, p.asigId);
      await remove("forum_posts", m.id);
      await patch("forum_threads", h.id, { updated_at: now() });
      return { ok: true };
    }
    case "getChat": {
      await enrolled(u, p.asigId);
      const a = await subject(p.asigId);
      const { data, error } = await db.from("chat_messages").select("*").eq("subject_id", p.asigId).order("created_at", { ascending: true }).limit(120);
      if (error) throw error;
      return { abierto: !!a.chat_open, mensajes: (data || []).map(m => ({ id: m.id, usuario: m.username, nombre: m.display_name, rol: m.role, texto: m.message, fecha: m.created_at })) };
    }
    case "enviarChat": fail("El foro ahora utiliza conversaciones independientes. Actualiza la página.");
    case "eliminarMensaje": {
      const m = await one("chat_messages", q => q.eq("id", p.id)); if (!m) fail("Mensaje no encontrado.");
      if (u.role === "estudiante") { if (m.username !== u.username) fail("Solo puedes eliminar tus propios mensajes."); }
      else await subjectAccess(u, m.subject_id);
      await remove("chat_messages", p.id); return { ok: true };
    }
    case "setChatAbierto": {
      const a = await subjectAccess(u, p.asigId);
      await patch("subjects", a.id, { chat_open: !!p.abierto });
      return { ok: true, abierto: !!p.abierto };
    }
    case "getResumen": {
      requireDir(u);
      const [students, subjects, enrolls] = await Promise.all([
        rows("app_users", q => q.eq("role", "estudiante")),
        rows("subjects"),
        rows("enrollments")
      ]);
      const groupMap = new Map();
      for (const e of students) {
        const g = e.group_name || "Sin grupo";
        if (!groupMap.has(g)) groupMap.set(g, { grupo: g, total: 0, activos: 0, inactivos: 0 });
        const v = groupMap.get(g); v.total++; if (e.status === "Activo") v.activos++; else v.inactivos++;
      }
      const subjectRows = [];
      for (const a of subjects) {
        const ms = enrolls.filter(m => m.subject_id === a.id);
        const pcs = await Promise.all(ms.map(m => progressSummary(a.id, m.student_username)));
        subjectRows.push({ ...mapSubject(a), estudiantes: ms.length, progresoMedio: pcs.length ? Math.round(pcs.reduce((s, x) => s + x.pct, 0) / pcs.length) : 0 });
      }
      return { grupos: Array.from(groupMap.values()), asignaturas: subjectRows, totales: { estudiantes: students.length, activos: students.filter(x => x.status === "Activo").length, inactivos: students.filter(x => x.status !== "Activo").length, asignaturas: subjects.length, profesores: (await rows("app_users", q => q.eq("role", "profesor"))).length } };
    }
    default: fail("Acción desconocida: " + action);
  }
}
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const body = await req.json();
    const action = clean(body.action);
    const payload = body.payload || {};
    let user = null;
    if (!["login", "loginProfesor", "loginStaff", "ping"].includes(action)) user = await authenticate(req);
    const data = await handle(action, payload, user);
    return new Response(JSON.stringify({ ok: true, data }), { status: 200, headers: cors });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e?.message || "Error interno." }), { status: 400, headers: cors });
  }
});
