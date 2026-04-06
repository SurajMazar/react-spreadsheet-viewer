import React from 'react';
import { createRoot } from 'react-dom/client';
import DemoApp from './demo/DemoApp';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <DemoApp />
  </React.StrictMode>
);
