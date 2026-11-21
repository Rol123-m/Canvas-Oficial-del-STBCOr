/* ============================================================
   API.JS · Cliente de datos de la Plataforma del Seminario
   Conectado a Supabase Edge Functions. Las credenciales no se
   guardan en el navegador; se utiliza un token de sesión.
   ============================================================ */
window.API = {
  get demo() { return false; },
  get hasSession() { return !!localStorage.getItem('canvas.supabase.session.v1'); },
  logout() { try { localStorage.removeItem('canvas.supabase.session.v1'); } catch {} },
  async call(action, payload = {}) {
    const cleanPayload = JSON.parse(JSON.stringify(payload || {}));
    delete cleanPayload.auth;
    delete cleanPayload.sesion;
    delete cleanPayload.clave;
    const token = localStorage.getItem('canvas.supabase.session.v1') || '';
    const headers = {
      'Content-Type': 'application/json',
      'apikey': window.CONFIG.supabaseKey
    };
    if (token) headers.Authorization = 'Bearer ' + token;
    const res = await fetch(window.CONFIG.api, {
      method: 'POST',
      headers,
      body: JSON.stringify({ action, payload: cleanPayload })
    });
    let j;
    try { j = await res.json(); } catch { throw new Error('El servidor devolvió una respuesta inválida.'); }
    if (!res.ok || !j.ok) {
      const message = j.error || 'No se pudo conectar con Supabase.';
      if (/sesión ha caducado|inicia sesión/i.test(message)) this.logout();
      throw new Error(message);
    }
    if (j.data && j.data.token) {
      localStorage.setItem('canvas.supabase.session.v1', j.data.token);
    }
    return j.data;
  }
};

