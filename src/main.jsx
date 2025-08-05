import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';

// Remove react-router if not using routes
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);