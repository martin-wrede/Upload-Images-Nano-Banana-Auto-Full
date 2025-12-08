import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App'; // Manual upload page
import Automation from './pages/Automation'; // R2 automation page
import AdminAutomation from './pages/AdminAutomation'; // Admin automation control
import AutoRunner from './pages/AutoRunner'; // New automation runner

const root = document.getElementById('root');

// Simple routing based on URL path
const path = window.location.pathname;
let RootComponent = App;

if (path === '/automation') {
  RootComponent = Automation;
} else if (path === '/admin-automation') {
  RootComponent = AdminAutomation;
} else if (path === '/auto-runner') {
  RootComponent = AutoRunner;
}

createRoot(root).render(
  <React.StrictMode>
    <RootComponent />
  </React.StrictMode>
);
