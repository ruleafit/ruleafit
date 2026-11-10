self.addEventListener('push', function (event) {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'Ruleafit', body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'Ruleafit';
  const options = {
    body: data.body || '',
    icon: '/ruleafit-icon-192.png',
    badge: '/ruleafit-icon-192.png',
    data: { url: data.url || '/' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  // Solo se abren enlaces de la propia web: una notificación nunca puede llevar
  // a un sitio externo, aunque su enlace lo diga.
  let url = '/';
  try {
    const pedido = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin);
    if (pedido.origin === self.location.origin) url = pedido.pathname + pedido.search + pedido.hash;
  } catch (e) {
    url = '/';
  }
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (const client of clientList) {
        if (client.url.includes(url) && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
