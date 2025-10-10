import { ipcMain, BrowserWindow } from 'electron';
import { store } from './store-node';

// LDAP Client
let ldapts: any = null;
let ldaptsPromise: Promise<any> | null = null;

async function getLdapClient() {
  if (!ldapts) {
    if (!ldaptsPromise) {
      ldaptsPromise = import('ldapts').then(module => {
        ldapts = module;
        return module;
      });
    }
    await ldaptsPromise;
  }
  return ldapts;
}

// Handle successful authentication
async function handleSuccessfulAuth(): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      console.log('Authentication successful, setting up session...');
      
      // Save the authentication state
      store.set('ldap_auth', {
        authenticated: true,
        timestamp: Date.now(),
        username: 'user',
        displayName: 'User'
      });
      
      // Emit an event to notify that authentication was successful
      // The main process will handle window creation when it's ready
      if (require('electron').app.isReady()) {
        // If app is already ready, import and call the main window handler
        const { ipcMain } = require('electron');
        ipcMain.emit('ldap-auth-success');
      } else {
        // If app is not ready yet, wait for it
        require('electron').app.on('ready', () => {
          const { ipcMain } = require('electron');
          ipcMain.emit('ldap-auth-success');
        });
      }
      
      resolve(true);
    } catch (error) {
      console.error('Error in handleSuccessfulAuth:', error);
      resolve(false);
    }
  });
}

// Initialize LDAP authentication
export function initLdapAuth() {
  // Handle LDAP authentication
  ipcMain.handle('ldap-authenticate', async (event, payload: { username: string; password: string }) => {
    try {
      const usernameRaw = (payload?.username || '').trim();
      
      // Allow admin/admin in development mode
      if (process.env.NODE_ENV === 'development' && usernameRaw === 'admin' && payload?.password === 'admin') {
        return await handleSuccessfulAuth();
      }
      
      const password = payload?.password ?? '';
      if (!usernameRaw || !password) {
        return 'Username and password are required';
      }

      const url = 'ldaps://moscow-corp-ldaps.corp.vtbcapital.internal';

      // Try multiple username formats if needed
      const candidates: string[] = [usernameRaw];
      if (!usernameRaw.includes('@')) {
        candidates.push(`${usernameRaw}@corp.vtbcapital.internal`);
      }
      
      // Add domain prefix if needed
      const domainPrefix = 'CORP\\';
      if (!usernameRaw.includes('\\')) {
        candidates.push(domainPrefix + usernameRaw);
      }

      try {
        const ldapts = await getLdapClient();
        const { Client } = ldapts;
        
        let lastError: any = null;
        for (const bindDN of candidates) {
          const client = new Client({ 
            url, 
            tlsOptions: { 
              rejectUnauthorized: false 
            } 
          });
          
          try {
            await client.bind(bindDN, password);
            await client.unbind().catch((event) => { console.log(event); });
            return await handleSuccessfulAuth();
          } catch (e) {
            lastError = e;
          } finally {
            try { 
              await client.unbind().catch(() => {}); 
            } catch {}
          }
        }
        
        return (lastError && lastError.message) 
          ? String(lastError.message) 
          : 'Authentication failed';
      } catch (error) {
        console.error('LDAP client initialization error:', error);
        return 'Authentication service unavailable';
      }
    } catch (err: any) {
      return (err && err.message) ? String(err.message) : 'Authentication failed';
    }
  });
}
