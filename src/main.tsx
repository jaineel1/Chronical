import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import './theme/tokens.css';
import { Capacitor } from '@capacitor/core';
import { App } from './app/App';
import { ErrorBoundary } from './app/ErrorBoundary';

// Service workers are refused in some embedded previews; that is fine, the app still runs.
// The native app ships its files inside the bundle, so it never needs the offline service worker.
if (!Capacitor.isNativePlatform() && 'serviceWorker' in navigator && window.isSecureContext) {
  try {
    registerSW({ immediate: true });
  } catch {
    /* no offline cache here */
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
