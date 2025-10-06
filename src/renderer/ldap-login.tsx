import React from 'react';
import { createRoot } from 'react-dom/client';
import { LdapLogin } from './components/LdapLogin';

// Handle authentication with the main process
const handleAuthenticate = async (username: string, password: string) => {
  try {
    const result = await window.electronAPI.invoke('ldap-authenticate', { 
      username: username.trim(), 
      password 
    });
    return result;
  } catch (error: unknown) {
    console.error('Authentication error:', error);
    const err = error as Error;
    return err?.message || 'Authentication failed';
  }
};

// Render the app
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <LdapLogin onAuthenticate={handleAuthenticate} />
    </React.StrictMode>
  );
}

export {};
