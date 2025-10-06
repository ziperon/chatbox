// Disable no-unused-vars, broken for spread args
/* eslint no-unused-vars: off */
import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'
import type { ElectronIPC } from 'src/shared/electron-types'

// export type Channels = 'ipc-example';

const electronHandler: ElectronIPC = {
  // ipcRenderer: {
  //     sendMessage(channel: Channels, ...args: unknown[]) {
  //         ipcRenderer.send(channel, ...args);
  //     },
  //     on(channel: Channels, func: (...args: unknown[]) => void) {
  //         const subscription = (
  //             _event: IpcRendererEvent,
  //             ...args: unknown[]
  //         ) => func(...args);
  //         ipcRenderer.on(channel, subscription);

  //         return () => {
  //             ipcRenderer.removeListener(channel, subscription);
  //         };
  //     },
  //     once(channel: Channels, func: (...args: unknown[]) => void) {
  //         ipcRenderer.once(channel, (_event, ...args) => func(...args));
  //     },
  // },
  invoke: ipcRenderer.invoke,
  onSystemThemeChange: (callback: () => void) => {
    ipcRenderer.on('system-theme-updated', callback)
    return () => ipcRenderer.off('system-theme-updated', callback)
  },
  onWindowShow: (callback: () => void) => {
    ipcRenderer.on('window-show', callback)
    return () => ipcRenderer.off('window-show', callback)
  },
  onUpdateDownloaded: (callback: () => void) => {
    ipcRenderer.on('update-downloaded', callback)
    return () => ipcRenderer.off('update-downloaded', callback)
  },
  addMcpStdioTransportEventListener: (transportId: string, event: string, callback?: (...args: any[]) => void) => {
    ipcRenderer.on(`mcp:stdio-transport:${transportId}:${event}`, (_event, ...args) => {
      callback?.(...args)
    })
  },
  onNavigate: (callback: (path: string) => void) => {
    const listener = (_event: unknown, path: string) => {
      callback(path)
    }
    ipcRenderer.on('navigate-to', listener)
    return () => ipcRenderer.off('navigate-to', listener)
  },
}

console.log('[Preload] Preload script loaded');

// Expose a simplified API for the login window
const loginHandler = {
  // LDAP Authentication
  invoke: async (channel: string, ...args: any[]) => {
    try {
      // Whitelist channels
      const validChannels = ['ldap-authenticate'];
      if (validChannels.includes(channel)) {
        console.log(`[Preload] Invoking channel: ${channel}`, args);
        const result = await ipcRenderer.invoke(channel, ...args);
        console.log(`[Preload] Channel ${channel} result:`, result);
        return result;
      }
      console.error(`[Preload] Invalid channel: ${channel}`);
      return Promise.reject(new Error(`Invalid channel: ${channel}`));
    } catch (error) {
      console.error(`[Preload] Error in channel ${channel}:`, error);
      throw error;
    }
  },
  
  // Add any other methods needed for the login window
  on: (channel: string, callback: (...args: any[]) => void) => {
    try {
      const validChannels = ['ldap-auth-response', 'auth-success'];
      if (validChannels.includes(channel)) {
        console.log(`[Preload] Adding listener for channel: ${channel}`);
        const subscription = (_event: IpcRendererEvent, ...args: any[]) => {
          console.log(`[Preload] Received event on channel ${channel}:`, args);
          callback(...args);
        };
        
        ipcRenderer.on(channel, subscription);
        
        return () => {
          console.log(`[Preload] Removing listener for channel: ${channel}`);
          ipcRenderer.removeListener(channel, subscription);
        };
      }
      console.warn(`[Preload] Attempted to listen to invalid channel: ${channel}`);
      return () => {};
    } catch (error) {
      console.error(`[Preload] Error in on handler for channel ${channel}:`, error);
      return () => {};
    }
  },
  
  // Add a direct method for development auth
  authenticate: async (username: string, password: string) => {
    try {
      console.log('[Preload] Authenticating with:', { username });
      const result = await ipcRenderer.invoke('ldap-authenticate', { username, password });
      console.log('[Preload] Authentication result:', result);
      return result;
    } catch (error) {
      console.error('[Preload] Authentication error:', error);
      throw error;
    }
  }
};

// Add type declarations for the window object
declare global {
  interface Window {
    loginAPI: typeof loginHandler;
  }
}

// Expose the main electronAPI
try {
  contextBridge.exposeInMainWorld('electronAPI', electronHandler);
  console.log('[Preload] electronAPI exposed');
} catch (error) {
  console.error('[Preload] Failed to expose electronAPI:', error);
}

// Expose a dedicated login API
try {
  if (contextBridge && contextBridge.exposeInMainWorld) {
    contextBridge.exposeInMainWorld('loginAPI', loginHandler);
    console.log('[Preload] loginAPI exposed successfully');
    
    // Add a test method
    if (typeof window !== 'undefined') {
      (window as any).__PRELOAD_READY = true;
    }
  } else {
    console.error('[Preload] contextBridge is not available');
    // Fallback for when contextBridge is not available
    if (typeof window !== 'undefined') {
      (window as any).loginAPI = loginHandler;
      (window as any).__PRELOAD_READY = true;
    }
  }
} catch (error) {
  console.error('[Preload] Failed to expose loginAPI:', error);
  
  // Last resort fallback
  if (typeof window !== 'undefined') {
    (window as any).loginAPI = loginHandler;
    (window as any).__PRELOAD_READY = true;
  }
}

console.log('[Preload] Preload script initialization complete');
