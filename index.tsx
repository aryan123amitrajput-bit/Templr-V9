
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// Global error handling for "Failed to fetch" and other async errors
window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const msg = (reason?.message || (typeof reason === 'string' ? reason : '')).toLowerCase();
    if (msg.includes('fetch') || msg.includes('network') || msg.includes('timeout')) {
        console.warn('Caught unhandled network error:', reason);
        // Prevent the error from showing up in the console as an error
        event.preventDefault();
    }
});

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
