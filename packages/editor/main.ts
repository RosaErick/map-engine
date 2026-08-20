import { mount } from 'svelte';
import App from './App.svelte';
import './app.css';

const target = document.getElementById('app');
if (!target) throw new Error('#app não encontrado');
mount(App, { target });

// Installable and offline once served over http(s). Registering from file://
// throws, and the single-file build is meant to run from file:// — so the app
// works either way and the service worker is a bonus, never a requirement.
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register(new URL('./sw.js', location.href), { scope: './' })
      .catch(() => { /* offline install unavailable; the app still runs */ });
  });
}
