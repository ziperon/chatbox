/**
 * Compares two semantic version strings
 * @param current Current version string (e.g., '1.2.3')
 * @param previous Previous version string to compare against
 * @returns boolean True if current version is newer than previous version
 */
export function isNewerVersion(current: string, previous: string): boolean {
  if (!current || !previous) return true;
  
  const [cMajor, cMinor = '0', cPatch = '0'] = current.split('.').map(Number);
  const [pMajor, pMinor = '0', pPatch = '0'] = previous.split('.').map(Number);
  
  if (cMajor > pMajor) return true;
  if (cMajor < pMajor) return false;
  
  if (cMinor > pMinor) return true;
  if (cMinor < pMinor) return false;
  
  return cPatch > pPatch;
}

// This will be replaced by webpack's DefinePlugin during build
declare const __APP_VERSION__: string;

/**
 * Gets the current application version
 * Uses webpack's DefinePlugin to inject the version at build time
 */
export function getAppVersion(): string {
  try {
    // 1. First try to get from webpack's DefinePlugin
    if (typeof __APP_VERSION__ !== 'undefined') {
      return __APP_VERSION__;
    }
    
    // 2. Then try window.APP_VERSION (for cases where DefinePlugin wasn't used)
    if (typeof window !== 'undefined') {
      const win = window as any;
      if (win.APP_VERSION) {
        return win.APP_VERSION;
      }
    }
    
    // 3. Fallback to hardcoded version
    return '0.0.0';
  } catch (e) {
    console.error('Failed to get app version:', e);
    return '0.0.0';
  }
}
