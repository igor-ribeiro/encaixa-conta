import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource/fredoka/400.css';
import '@fontsource/fredoka/500.css';
import '@fontsource/fredoka/600.css';
import App from './App.tsx';
import { AUDIO_FILES } from './audio';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// PWA: o SW faz cache em tempo de execução; aqui guardamos o que a 1ª abertura já baixou + os áudios.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  addEventListener('load', () => {
    const base = import.meta.env.BASE_URL;
    void navigator.serviceWorker.register(`${base}sw.js`);
    const loaded = performance
      .getEntriesByType('resource')
      .map((e) => e.name)
      .filter((u) => u.startsWith(location.origin));
    const urls = [location.href, ...loaded, ...AUDIO_FILES.map((n) => `${base}audio/${n}.m4a`)];
    void caches.open('encaixa-conta-v1').then((c) => Promise.all(urls.map((u) => c.add(u).catch(() => undefined))));
  });
}
