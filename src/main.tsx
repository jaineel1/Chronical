import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import './theme/tokens.css';
import { Capacitor } from '@capacitor/core';
import { App } from './app/App';
import { ErrorBoundary } from './app/ErrorBoundary';

// Service workers are refused in some embedded previews; that is fine, the app still runs.
// The native app and the desktop app (app://) ship their files inside the bundle, so they never need
// the offline service worker; only pages served over http(s) register it.
if (!Capacitor.isNativePlatform() && location.protocol.startsWith('http') && 'serviceWorker' in navigator && window.isSecureContext) {
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
