import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'

// Defensively unregister any service workers and clear caches that could be
// serving stale dev chunks (which causes two React copies / invalid hook calls).
if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations()
    .then((regs) => regs.forEach((r) => r.unregister()))
    .catch(() => {});
}
if (typeof caches !== 'undefined') {
  caches.keys()
    .then((keys) => keys.forEach((k) => caches.delete(k)))
    .catch(() => {});
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)