(() => {
  'use strict';
  const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  let installPrompt = null;
  let registration = null;
  let reloading = false;

  const ui = document.createElement('div');
  ui.id = 'pwa-tools';
  ui.innerHTML = '<button type="button" id="pwa-install" class="pwa-fab" aria-label="Instalar STBCOr Gestión de Aulas"><i class="fas fa-download"></i><span>Instalar aplicación</span></button><div id="pwa-update" class="pwa-update" role="status" aria-live="polite" hidden><span><b>Nueva versión disponible</b><small>Actualiza para utilizar la versión más reciente.</small></span><button type="button" id="pwa-update-now">Actualizar</button><button type="button" id="pwa-update-later" aria-label="Más tarde">×</button></div><div id="pwa-offline" class="pwa-offline" hidden>Estás sin conexión. Los datos y las funciones de cuenta requieren internet.</div>';
  document.body.append(ui);

  const installButton = document.getElementById('pwa-install');
  const updatePanel = document.getElementById('pwa-update');
  const updateNow = document.getElementById('pwa-update-now');
  const offlineNotice = document.getElementById('pwa-offline');

  function showInstall() {
    if (isStandalone()) { installButton.hidden = true; return; }
    installButton.hidden = false;
  }
  function showUpdate() { updatePanel.hidden = false; }
  function instructions() {
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const message = ios
      ? 'Para instalar: pulsa Compartir en Safari y elige “Añadir a pantalla de inicio”.'
      : 'Para instalar: abre el menú del navegador (⋮ o …) y selecciona “Instalar aplicación” o “Instalar STBCOr Gestión de Aulas”.';
    window.alert(message);
  }

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    installPrompt = event;
    showInstall();
  });
  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    installButton.hidden = true;
  });
  installButton.addEventListener('click', async () => {
    if (!installPrompt) { instructions(); return; }
    installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice && choice.outcome === 'accepted') installButton.hidden = true;
    installPrompt = null;
  });

  updateNow.addEventListener('click', () => {
    if (registration && registration.waiting) registration.waiting.postMessage({ type: 'SKIP_WAITING' });
  });
  document.getElementById('pwa-update-later').addEventListener('click', () => { updatePanel.hidden = true; });

  window.addEventListener('online', () => { offlineNotice.hidden = true; });
  window.addEventListener('offline', () => { offlineNotice.hidden = false; });
  offlineNotice.hidden = navigator.onLine;

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
      try {
        registration = await navigator.serviceWorker.register('./sw.js', { scope: './', updateViaCache: 'none' });
        if (registration.waiting && navigator.serviceWorker.controller) showUpdate();
        registration.addEventListener('updatefound', () => {
          const worker = registration.installing;
          if (!worker) return;
          worker.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) showUpdate();
          });
        });
        try { await registration.update(); } catch (_) {}
        window.setInterval(() => registration && registration.update().catch(() => {}), 30 * 60 * 1000);
      } catch (error) {
        console.warn('No se pudo registrar el modo PWA:', error);
      }
    });
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    });
  }
  showInstall();
})();
