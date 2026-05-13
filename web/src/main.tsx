import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles/app.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);

// Handle PWA updates
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register(
        '/sw.js',
        { scope: '/' }
      );

      // Check for updates periodically
      setInterval(() => registration.update(), 60000);

      // Listen for updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          if (
            newWorker.state === 'installed' &&
            navigator.serviceWorker.controller
          ) {
            // New version available
            const updateMessage = document.createElement('div');
            updateMessage.style.cssText = `
              position: fixed;
              bottom: 0;
              left: 0;
              right: 0;
              background: #0b1320;
              color: white;
              padding: 1rem;
              z-index: 9999;
              display: flex;
              justify-content: space-between;
              align-items: center;
              gap: 1rem;
              font-size: 0.95rem;
            `;
            updateMessage.innerHTML = `
              <span>Update available</span>
              <button style="
                background: #fff;
                color: #0b1320;
                border: none;
                padding: 0.5rem 1rem;
                border-radius: 6px;
                font-weight: 600;
                cursor: pointer;
              ">Reload</button>
            `;

            const reloadBtn = updateMessage.querySelector('button');
            reloadBtn?.addEventListener('click', () => {
              newWorker.postMessage({ type: 'SKIP_WAITING' });
              window.location.reload();
            });

            document.body.appendChild(updateMessage);
          }
        });
      });
    } catch (error) {
      console.error('ServiceWorker registration failed:', error);
    }
  });
}
