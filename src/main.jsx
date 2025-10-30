import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './lib/firebase'; // side effect import for Firebase init
import App from './App.tsx';

// Remove react-router if not using routes
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);