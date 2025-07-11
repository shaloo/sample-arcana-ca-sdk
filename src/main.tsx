import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './style.css';
import './App.css';

import App from './App.tsx'
import React from 'react';
import ReactDOM from 'react-dom/client';

import { supportedChains } from './utils/chains';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
