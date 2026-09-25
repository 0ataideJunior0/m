// Service worker mínimo: existe só para o navegador considerar o app
// instalável de verdade (um dos critérios do Chrome/Android pra oferecer
// "Instalar app" em vez de um atalho comum). Não faz cache de nada — toda
// requisição sempre vai pra rede, sem risco de servir dado desatualizado
// (sessão, API, assinatura etc.).
self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request))
})
