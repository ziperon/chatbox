/* eslint global-require: off, no-console: off, promise/always-return: off */

/**
 * This module executes inside of electron's main process. You can start
 * electron renderer process from here and communicate with the other processes
 * through IPC.
 *
 * When running `npm run build` or `npm run build:main`, this file is compiled to
 * `./src/main.js` using webpack. This gives us some performance wins.
 */
import { app, BrowserWindow, dialog, globalShortcut, ipcMain, Menu, nativeTheme, session, shell, Tray } from 'electron'
import log from 'electron-log/main'
import { autoUpdater } from 'electron-updater'
import os from 'os'
import path from 'path'
import type { ShortcutSetting } from 'src/shared/types'
import * as analystic from './analystic-node'
import * as autoLauncher from './autoLauncher'
import { handleDeepLink } from './deeplinks'
import { parseFile } from './file-parser'
import Locale from './locales'
import * as mcpIpc from './mcp/ipc-stdio-transport'
import MenuBuilder from './menu'
import * as proxy from './proxy'
// Dynamically import ldapts to handle Electron's context isolation
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
import {
  delStoreBlob,
  getConfig,
  getSettings,
  getStoreBlob,
  listStoreBlobKeys,
  setStoreBlob,
  store,
} from './store-node'
import { resolveHtmlPath } from './util'
import * as windowState from './window_state'

// Only import knowledge-base module if not on win32 arm64 (libsql doesn't support win32 arm64)
if (!(process.platform === 'win32' && process.arch === 'arm64')) {
  import('./knowledge-base')
}

// --------- LDAP Auth ---------

async function ensureLdapAuth(): Promise<void> {
  if (isAuthenticated) return

  // Create a minimal auth window
  const preloadPath = app.isPackaged ? path.join(__dirname, 'preload.js') : path.join(__dirname, '../../.erb/dll/preload.js')
  authWindow = new BrowserWindow({
    width: 420,
    height: 360,
    resizable: false,
    minimizable: false,
    maximizable: false,
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 10, y: 16 },
    show: true,
    webPreferences: {
      preload: preloadPath,
      webSecurity: true,
    },
  })

  const html = `<!doctype html>
  <html>
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'self' 'unsafe-inline' data:; img-src 'self' data:;" />
    <title>Sign in</title>
    <style>
      body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif; margin: 0; background: #0f172a; color: #e2e8f0; }
      .wrap { padding: 24px; }
      h1 { font-size: 16px; margin: 30px 0px 15px; }
      label { display: block; font-size: 12px; color: #94a3b8; margin-top: 12px; }
      input { width: 94%; padding: 10px; border-radius: 8px; border: 1px solid #334155; background: #0b1220; color: #e2e8f0; }
      button { margin-top: 16px; width: 100%; padding: 10px 12px; border-radius: 8px; border: 0; background: #2563eb; color: #fff; font-weight: 600; cursor: pointer; }
      button:disabled { opacity: .6; cursor: default; }
      .err { color: #f87171; font-size: 12px; margin-top: 8px; min-height: 16px; }
      .hint { color: #94a3b8; font-size: 12px; margin-top: 8px; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <h1>Авторизация</h1>
      
      <label>Username</label>
      <input id="u" type="text" autofocus autocomplete="username" placeholder="CORP\\user" />
      <label>Password</label>
      <input id="p" type="password" autocomplete="current-password" />
      <button id="b">Sign in</button>
      <div class="err" id="e"></div>
    </div>
    <script>
      // Load the last username when the page loads
      window.electronAPI.invoke('get-last-username').then(username => {
        if (username) {
          const u = document.getElementById('u');
          if (u) u.value = username;
          // Focus password field if username is already filled
          const p = document.getElementById('p');
          if (p) p.focus();
        }
      });
      const $ = (id) => document.getElementById(id);
      const btn = $('b');
      const u = $('u');
      const p = $('p');
      const e = $('e');
      async function submit() {
        e.textContent = '';
        btn.disabled = true;
        try {
          const username = u.value.trim();
          // Save the username when attempting to log in
          if (username) {
            await window.electronAPI.invoke('set-last-username', username);
          }
          const ok = await window.electronAPI.invoke('ldap-authenticate', { username: username, password: p.value || '' });
          if (ok === true) {
            // success; main process will close this window
          } else {
            e.textContent = typeof ok === 'string' ? ok : 'Authentication failed';
          }
        } catch (err) {
          e.textContent = (err && err.message) ? err.message : 'Authentication failed';
        } finally {
          btn.disabled = false;
          p.value = '';
        }
      }
      btn.addEventListener('click', submit);
      p.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') submit(); });
    </script>
  </body>
  </html>`

  await authWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  
  // Add handler for setting the last username
  ipcMain.handle('set-last-username', async (event, username: string) => {
    if (username) {
      store.set('last_username', username);
      await setStoreBlob('last_username', username);
    }
    return true;
  });
}

// Import and initialize LDAP auth
import { initLdapAuth } from './ldap-auth'
initLdapAuth()

// Handle getting the last username
ipcMain.handle('get-last-username', async () => {
  return store.get('last_username', '');
});

// Handle setting the last username
ipcMain.handle('set-last-username', async (event, username: string) => {
  if (username) {
    store.set('last_username', username);
  }
  return true;
});

// Listen for successful LDAP authentication
ipcMain.on('ldap-auth-success', async () => {
  try {
    console.log('LDAP auth success, preparing main window...');
    
    // Close the auth window if it exists
    if (authWindow) {
      authWindow.close();
      authWindow = null;
    }
    
    // Create the main window if it doesn't exist
      ensureTray();
      console.log('Creating main window from ldap-auth-success...');
      mainWindow = await createWindow();
      
      if (!mainWindow) {
        throw new Error('Failed to create main window');
      }
   
      // If main window exists but is minimized, restore it
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.show();
      mainWindow.focus();
    }
  catch (error) {
    console.error('Error handling ldap-auth-success:', error);
    dialog.showErrorBox(
      'Window Error',
      'Failed to open the main application window. Please try again.'
    );
  }
});

async function handleSuccessfulAuth(): Promise<boolean> {
  try {
    console.log('Authentication successful, setting up session...')
    
    // Set authentication state
    isAuthenticated = true;
    
    // Save the authentication state
    store.set('ldap_auth', {
      authenticated: true,
      timestamp: Date.now(),
      username: 'user',
      displayName: 'User'
    });
    
    // Close the auth window if it exists
    // if (authWindow) {
    //   authWindow.close();
    //   authWindow = null;
    // }
    
    showWindow();
    
    return true;
  } catch (error) {
    console.error('Error in handleSuccessfulAuth:', error);
    // Show error to user
    dialog.showErrorBox(
      'Authentication Error',
      'Failed to initialize the application after authentication. Please try again.'
    );
    return false;
  }
}

// 这行代码是解决 Windows 通知的标题和图标不正确的问题，标题会错误显示成 electron.app.Chatbox
// 参考：https://stackoverflow.com/questions/65859634/notification-from-electron-shows-electron-app-electron
if (process.platform === 'win32') {
  app.setAppUserModelId(app.name)
}

const RESOURCES_PATH = app.isPackaged
  ? path.join(process.resourcesPath, 'assets')
  : path.join(__dirname, '../../assets')

const getAssetPath = (...paths: string[]): string => {
  return path.join(RESOURCES_PATH, ...paths)
}

if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('chatbox', process.execPath, [path.resolve(process.argv[1])])
  }
} else {
  app.setAsDefaultProtocolClient('chatbox')
}

// --------- 全局变量 ---------

let mainWindow: BrowserWindow | null = null
let authWindow: BrowserWindow | null = null
let isAuthenticated = false
let tray: Tray | null = null

async function showWindow() {
   // Create the main window if it doesn't exist
    if (!mainWindow || mainWindow.isDestroyed()) {
      console.log('Creating main window...');
      mainWindow = await createWindow();
      
      if (!mainWindow) {
        throw new Error('Failed to create main window');
      }
    } else {
      if (mainWindow.isMinimized()) {
        mainWindow.restore()
      }
      mainWindow.show()
      mainWindow.focus()
    }
  
}

// --------- 快捷键 ---------

/**
 * 将渲染层的 shortcut 转化成 electron 支持的格式
 * react-hotkeys-hook 的快捷键格式参考： https://react-hotkeys-hook.vercel.app/docs/documentation/useHotkeys/basic-usage#modifiers--special-keys
 * Electron 的快捷键格式参考： https://www.electronjs.org/docs/latest/api/accelerator
 */
function normalizeShortcut(shortcut: string) {
  if (!shortcut) {
    return ''
  }
  let keys = shortcut.split('+')
  keys = keys.map((key) => {
    switch (key) {
      case 'mod':
        return 'CommandOrControl'
      case 'option':
        return 'Alt'
      case 'backquote':
        return '`'
      default:
        return key
    }
  })
  return keys.join('+')
}

/**
 * 检查快捷键是否有效
 * @param shortcut 快捷键字符串
 * @returns 是否为有效的快捷键
 */
function isValidShortcut(shortcut: string): boolean {
  if (!shortcut) {
    return false
  }
  const keys = shortcut.split('+')
  // 检查是否至少包含一个非修饰键
  const hasNonModifier = keys.some((key) => {
    const normalizedKey = key.trim().toLowerCase()
    return ![
      'mod',
      'command',
      'cmd',
      'control',
      'ctrl',
      'commandorcontrol',
      'option',
      'alt',
      'shift',
      'super',
    ].includes(normalizedKey)
  })
  return hasNonModifier
}

function registerShortcuts(shortcutSetting?: ShortcutSetting) {
  if (!shortcutSetting) {
    shortcutSetting = getSettings().shortcuts
  }
  if (!shortcutSetting) {
    return
  }
  try {
    const quickToggle = normalizeShortcut(shortcutSetting.quickToggle)
    if (isValidShortcut(quickToggle)) {
      globalShortcut.register(quickToggle, () => showOrHideWindow())
    }
  } catch (error) {
    log.error('Failed to register shortcut [windowQuickToggle]:', error)
  }
}

function unregisterShortcuts() {
  return globalShortcut.unregisterAll()
}

// --------- Tray 图标 ---------

function createTray() {
  const locale = new Locale()
  let iconPath = getAssetPath('icon.png')
  if (process.platform === 'darwin') {
    // 生成 iconTemplate.png 的命令
    // gm convert -background none ./iconTemplateRawPreview.png -resize 130% -gravity center -extent 512x512 iconTemplateRaw.png
    // gm convert ./iconTemplateRaw.png -colorspace gray -negate -threshold 50% -resize 16x16 -units PixelsPerInch -density 72 iconTemplate.png
    // gm convert ./iconTemplateRaw.png -colorspace gray -negate -threshold 50% -resize 64x64 -units PixelsPerInch -density 144 iconTemplate@2x.png
    iconPath = getAssetPath('iconTemplate.png')
  } else if (process.platform === 'win32') {
    iconPath = getAssetPath('icon.ico')
  }
  tray = new Tray(iconPath)
  const contextMenu = Menu.buildFromTemplate([
    {
      label: locale.t('Show/Hide'),
      click: showOrHideWindow,
      accelerator: getSettings().shortcuts.quickToggle,
    },
    {
      label: locale.t('Exit'),
      click: () => app.quit(),
      accelerator: 'Command+Q',
    },
  ])
  tray.setToolTip('Chatbox')
  tray.setContextMenu(contextMenu)
  tray.on('double-click', showOrHideWindow)
  return tray
}

function ensureTray() {
  if (tray) {
    log.info('tray: already exists')
    return tray
  }
  try {
    createTray()
    log.info('tray: created')
  } catch (e) {
    log.error('tray: failed to create', e)
  }
}

function destroyTray() {
  if (!tray) {
    log.info('tray: skip destroy because it does not exist')
    return
  }
  try {
    tray.destroy()
    tray = null
    log.info('tray: destroyed')
  } catch (e) {
    log.error('tray: failed to destroy', e)
  }
}

// --------- 开发模式 ---------

if (process.env.NODE_ENV === 'production') {
  const sourceMapSupport = require('source-map-support')
  sourceMapSupport.install()
}

const isDebug = process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true'

if (isDebug) {
  require('electron-debug')()
}

// const installExtensions = async () => {
//     const installer = require('electron-devtools-installer')
//     const forceDownload = !!process.env.UPGRADE_EXTENSIONS
//     const extensions = ['REACT_DEVELOPER_TOOLS']

//     return installer
//         .default(
//             extensions.map((name) => installer[name]),
//             forceDownload
//         )
//         .catch(console.log)
// }

// --------- 窗口管理 ---------

async function createWindow() {
  try {
    if (isDebug) {
      // 不在安装 DEBUG 浏览器插件。可能不兼容，所以不如直接在网页里debug
      // await installExtensions()
      console.log('Running in development mode with debug features');
    }

    const [state] = windowState.getState()
    
    console.log('Creating main browser window with state:', state);

    // Create the browser window with the saved state
    mainWindow = new BrowserWindow({
      show: false, // Don't show until we're ready
      titleBarStyle: 'hidden',
      // Expose window controls in Windows/Linux
      ...(process.platform !== 'darwin' ? {
        titleBarOverlay: {
          color: nativeTheme.shouldUseDarkColors ? '#282828' : 'white',
          symbolColor: nativeTheme.shouldUseDarkColors ? 'white' : 'black',
          height: 47,
        },
      } : {}),
      trafficLightPosition: { x: 10, y: 16 },
      width: state.width || 1200,
      height: state.height || 800,
      x: state.x,
      y: state.y,
      minWidth: windowState.minWidth,
      minHeight: windowState.minHeight,
      icon: getAssetPath('icon.png'),
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        spellcheck: true,
        webSecurity: false, // Required for some features
        allowRunningInsecureContent: false,
        preload: app.isPackaged 
          ? path.join(__dirname, 'preload.js') 
          : path.join(__dirname, '../../.erb/dll/preload.js'),
      },
    });

    // Load the index.html file
    console.log('Loading main window URL...');
    await mainWindow.loadURL(resolveHtmlPath('index.html'));
    console.log('Main window URL loaded');

    // Set up window state handlers
    mainWindow.once('ready-to-show', () => {
      console.log('Main window ready to show');
      
      if (!mainWindow) {
        console.error('Main window was destroyed before ready-to-show');
        return;
      }

      // Apply window state
      if (state.mode === windowState.WindowMode.Maximized) {
        console.log('Maximizing window');
        mainWindow.maximize();
      } else if (state.mode === windowState.WindowMode.Fullscreen) {
        console.log('Setting fullscreen');
        mainWindow.setFullScreen(true);
      }
      
      // Show the window
      console.log('Showing main window');
      mainWindow.show();
      mainWindow.focus();
      
      // For development: Open the DevTools in development mode
      if (isDebug) {
        mainWindow.webContents.openDevTools({ mode: 'detach' });
      }
    });

    // 窗口关闭时保存窗口大小与位置
    mainWindow.on('close', () => {
      if (mainWindow) {
        windowState.saveState(mainWindow);
      }
    });

    mainWindow.on('closed', () => {
      mainWindow = null;
    });

    const menuBuilder = new MenuBuilder(mainWindow);
    menuBuilder.buildMenu();

    // Open URLs in the user's browser
    mainWindow.webContents.setWindowOpenHandler((edata) => {
      shell.openExternal(edata.url);
      return { action: 'deny' };
    });

    // Hide menu bar on Windows/Linux
    mainWindow.setMenuBarVisibility(false);

    // Handle network requests
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': ["default-src 'self'"],
        },
      });
    });

    // Listen for system theme changes
    nativeTheme.on('updated', () => {
      mainWindow?.webContents.send('system-theme-updated');
    });

    return mainWindow;
  } catch (error) {
    console.error('Failed to create window:', error);
    throw error;
  }
}

async function showOrHideWindow() {
  if (!mainWindow) {
    await createWindow()
    return
  }
  if (mainWindow.isMinimized()) {
    mainWindow.restore()
    mainWindow.focus()
    mainWindow.webContents.send('window-show')
  } else if (mainWindow?.isFocused()) {
    // 解决MacOS全屏下隐藏将黑屏的问题
    if (mainWindow.isFullScreen()) {
      mainWindow.setFullScreen(false)
    }
    mainWindow.hide()
    // mainWindow.minimize()
  } else {
    // 解决MacOS下无法聚焦的问题
    mainWindow.hide()
    mainWindow.show()
    mainWindow.focus()
    // 解决MacOS全屏下无法聚焦的问题
    mainWindow.webContents.send('window-show')
  }
}

// --------- 应用管理 ---------

const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', async (event, commandLine, workingDirectory) => {
    await showOrHideWindow()
    // on windows and linux, the deep link is passed in the command line
    const url = commandLine.find((arg) => arg.startsWith('chatbox://'))
    if (url && mainWindow) {
      handleDeepLink(mainWindow, url)
    }
  })

  app.on('window-all-closed', () => {
    // Respect the OSX convention of having the application in memory even
    // after all windows have been closed
    // if (process.platform !== 'darwin') {
    //     app.quit()
    // }
  })

  app
    .whenReady()
    .then(async () => {
      // Check settings to determine whether to enforce authentication
      const settings = getSettings()
      const enableAuth = settings?.enableAuth
      console.log(enableAuth)
      if (enableAuth) {
        // Show auth window first; main window is created after successful auth
        await ensureLdapAuth()
      } else {
        // Skip auth and open main window directly
        isAuthenticated = true
        await showOrHideWindow()
      }
      ensureTray()
      // Remove this if your app does not use auto updates
      // eslint-disable-next-line
      app.on('activate', () => {
        // On macOS it's common to re-create a window in the app when the
        // dock icon is clicked and there are no other windows open.
        if (mainWindow === null) {
          if (isAuthenticated) {
            createWindow()
          } else if (!authWindow) {
            ensureLdapAuth()
          }
        }
        if (mainWindow && !mainWindow.isVisible()) {
          mainWindow.show()
          mainWindow.focus()
        }
      })
      // 监听窗口大小位置变化的代码，很大程度参考了 VSCODE 的实现 /Users/benn/Documents/w/vscode/src/vs/platform/windows/electron-main/windowsStateHandler.ts
      // When a window looses focus, save all windows state. This allows to
      // prevent loss of window-state data when OS is restarted without properly
      // shutting down the application (https://github.com/microsoft/vscode/issues/87171)
      app.on('browser-window-blur', () => {
        if (mainWindow) {
          windowState.saveState(mainWindow)
        }
      })
      registerShortcuts()
      proxy.init()
      app.on('will-quit', () => {
        try {
          unregisterShortcuts()
        } catch (e) {
          log.error('shortcut: failed to unregister', e)
        }
        mcpIpc.closeAllTransports()
        destroyTray()
      })
      app.on('before-quit', () => {
        destroyTray()
      })
    })
    .catch(console.log)
}

// macos uses this event to handle deep links
app.on('open-url', (_event, url) => {
  if (mainWindow) {
    handleDeepLink(mainWindow, url)
  }
})

// --------- IPC 监听 ---------

ipcMain.handle('getStoreValue', (event, key) => {
  return store.get(key)
})
ipcMain.handle('setStoreValue', (event, key, dataJson) => {
  // 仅在传输层用 JSON 序列化，存储层用原生数据，避免存储层 JSON 损坏后无法自动处理的情况
  const data = JSON.parse(dataJson)
  return store.set(key, data)
})
ipcMain.handle('delStoreValue', (event, key) => {
  return store.delete(key)
})
ipcMain.handle('getAllStoreValues', (event) => {
  return JSON.stringify(store.store)
})
ipcMain.handle('setAllStoreValues', (event, dataJson) => {
  const data = JSON.parse(dataJson)
  store.store = { ...store.store, ...data }
})

ipcMain.handle('getStoreBlob', async (event, key) => {
  return getStoreBlob(key)
})
ipcMain.handle('setStoreBlob', async (event, key, value: string) => {
  return setStoreBlob(key, value)
})
ipcMain.handle('delStoreBlob', async (event, key) => {
  return delStoreBlob(key)
})
ipcMain.handle('listStoreBlobKeys', async (event) => {
  return listStoreBlobKeys()
})

ipcMain.handle('getVersion', () => {
  return app.getVersion()
})
ipcMain.handle('getPlatform', () => {
  return process.platform
})
ipcMain.handle('getArch', () => {
  return process.arch
})
ipcMain.handle('getHostname', () => {
  return os.hostname()
})
ipcMain.handle('getLocale', () => {
  try {
    return app.getLocale()
  } catch (e: any) {
    return ''
  }
})
ipcMain.handle('openLink', (event, link) => {
  return shell.openExternal(link)
})
ipcMain.handle('ensureShortcutConfig', (event, json) => {
  const config: ShortcutSetting = JSON.parse(json)
  unregisterShortcuts()
  registerShortcuts(config)
})

ipcMain.handle('shouldUseDarkColors', () => nativeTheme.shouldUseDarkColors)

ipcMain.handle('ensureProxy', (event, json) => {
  const config: { proxy?: string } = JSON.parse(json)
  proxy.ensure(config.proxy)
})

ipcMain.handle('relaunch', () => {
  //app.relaunch()
  //app.quit()
})

ipcMain.handle('getConfig', (event) => {
  return getConfig()
})

ipcMain.handle('getSettings', (event) => {
  return getSettings()
})

ipcMain.handle('shouldShowAboutDialogWhenStartUp', (event) => {
  const currentVersion = app.getVersion()
  if (store.get('lastShownAboutDialogVersion', '') === currentVersion) {
    return false
  }
  store.set('lastShownAboutDialogVersion', currentVersion)
  return true
})

ipcMain.handle('appLog', (event, dataJson) => {
  const data: { level: string; message: string } = JSON.parse(dataJson)
  data.message = 'APP_LOG: ' + data.message
  switch (data.level) {
    case 'info':
      log.info(data.message)
      break
    case 'error':
      log.error(data.message)
      break
    default:
      log.info(data.message)
  }
})

ipcMain.handle('ensureAutoLaunch', (event, enable: boolean) => {
  if (isDebug) {
    log.info('ensureAutoLaunch: skip by debug mode')
    return
  }
  return autoLauncher.ensure(enable)
})

ipcMain.handle('parseFileLocally', async (event, dataJSON: string) => {
  const params: { filePath: string } = JSON.parse(dataJSON)
  try {
    const data = await parseFile(params.filePath)
    return JSON.stringify({ text: data, isSupported: true })
  } catch (e) {
    return JSON.stringify({ isSupported: false })
  }
})

ipcMain.handle('parseUrl', async (event, url: string) => {
  // const result = await readability(url, { maxLength: 1000 })
  // const key = 'parseUrl-' + uuidv4()
  // await setStoreBlob(key, result.text)
  // return JSON.stringify({ key, title: result.title })
  return JSON.stringify({ key: '', title: '' })
})

ipcMain.handle('isFullscreen', () => {
  return mainWindow?.isFullScreen() || false
})

ipcMain.handle('setFullscreen', (event, enable: boolean) => {
  if (!mainWindow) {
    return
  }
  if (enable) {
    mainWindow.setFullScreen(true)
  } else {
    // 解决MacOS全屏下隐藏将黑屏的问题
    if (mainWindow.isFullScreen()) {
      mainWindow.setFullScreen(false)
    }
    mainWindow.hide()
  }
})

ipcMain.handle('install-update', () => {
  autoUpdater.quitAndInstall()
})

ipcMain.handle('switch-theme', (event, theme: 'dark' | 'light') => {
  if (!mainWindow || typeof mainWindow.setTitleBarOverlay !== 'function') {
    return
  }
  mainWindow.setTitleBarOverlay({
    color: theme === 'dark' ? '#282828' : 'white',
    symbolColor: theme === 'dark' ? 'white' : 'black',
  })
})
