import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import './theme/tokens.css';
import { App } from './app/App';
import { ErrorBoundary } from './app/ErrorBoundary';

// Service workers are refused in some embedded previews; that is fine, the app still runs.
if ('serviceWorker' in navigator && window.isSecureContext) {
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
