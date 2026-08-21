/* Service worker del Localizador.
   IMPORTANTE: sube el número de VERSION en cada parche que publiques.
   Es lo que hace que los móviles se enteren de que hay algo nuevo. */
const VERSION = "2026.08.20-14";
const CACHE   = "localizador-" + VERSION;
const BASICOS = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png"];
// zxing.js no se precarga: solo lo baja el iPhone la primera vez que bipa, y queda guardado.

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(BASICOS)).catch(()=>{}));
});

self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    const nombres = await caches.keys();
    await Promise.all(nombres.filter(n => n !== CACHE).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

// El aviso "Actualizar" de la app manda este mensaje
self.addEventListener("message", e => { if (e.data === "YA") self.skipWaiting(); });

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;

  // La página: primero red (así llega el parche), y si no hay cobertura, copia guardada
  if (req.mode === "navigate") {
    e.respondWith((async () => {
      try {
        const res = await fetch(req);
        const c = await caches.open(CACHE);
        c.put("./index.html", res.clone());
        return res;
      } catch (err) {
        return (await caches.match("./index.html")) || Response.error();
      }
    })());
    return;
  }

  // Todo lo demás (tipografías, iconos): primero lo guardado, para que vaya instantáneo
  e.respondWith((async () => {
    const guardado = await caches.match(req);
    if (guardado) return guardado;
    try {
      const res = await fetch(req);
      if (res.ok && (req.url.startsWith(self.location.origin) || req.url.includes("fonts.g"))) {
        const c = await caches.open(CACHE);
        c.put(req, res.clone());
      }
      return res;
    } catch (err) {
      return Response.error();
    }
  })());
});
