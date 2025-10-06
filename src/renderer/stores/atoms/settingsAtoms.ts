import { atom, type SetStateAction } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import { focusAtom } from 'jotai-optics'
import { omit, isEqual } from 'lodash'
import * as defaults from '../../../shared/defaults'
import { type SessionSettings, type Settings, type SettingWindowTab, Theme } from '../../../shared/types'
import { isNewerVersion, getAppVersion } from '../../../shared/utils/version'
import platform from '../../platform'
import storage, { StorageKey } from '../../storage'

// Helper function to get settings from storage
const getStoredSettings = async (): Promise<Settings> => {
  try {
    // Get settings with default value from defaults
    return await storage.getItem(StorageKey.Settings, defaults.settings());
  } catch (error) {
    console.error('Failed to get settings:', error);
    return defaults.settings();
  }
};

// Helper function to update settings in storage
const updateSettings = async (updateFn: (settings: Settings) => Settings) => {
  try {
    const currentSettings = await getStoredSettings();
    const newSettings = updateFn(currentSettings);
    await storage.setItem(StorageKey.Settings, newSettings);
  } catch (error) {
    console.error('Failed to update settings:', error);
  }
};

// Initialize settings with default values
const initialSettings: Settings = {
  ...defaults.settings(),
  theme: (() => {
    const initialTheme = localStorage.getItem('initial-theme')
    if (initialTheme === 'light') {
      return Theme.Light
    } else if (initialTheme === 'dark') {
      return Theme.Dark
    }
    return Theme.System
  })(),
};

// settings
const _settingsAtom = atomWithStorage<Settings>(
  StorageKey.Settings,
  initialSettings,
  {
    getItem: async (key) => {
      try {
        return await storage.getItem(key, initialSettings);
      } catch (error) {
        console.error('Error reading settings:', error);
        return initialSettings;
      }
    },
    setItem: async (key, value) => {
      try {
        await storage.setItem(key, value);
      } catch (error) {
        console.error('Error saving settings:', error);
      }
    },
    removeItem: async (key) => {
      try {
        await storage.removeItem(key);
      } catch (error) {
        console.error('Error removing settings:', error);
      }
    },
    subscribe: () => () => {},
  }
)
/**
 * Migrate settings when the app version changes
 */
function migrateSettings(settings: Settings): Settings {
  const defaultSettings = defaults.settings();
  const currentVersion = getAppVersion();
  
  // If no version or older version, apply migrations
  if (!settings.appVersion || isNewerVersion(currentVersion, settings.appVersion)) {
    // Merge with default settings to ensure all new fields are present
    const mergedSettings = { ...defaultSettings, ...settings };
    
    // Apply version-specific migrations here
    // Example:
    // if (isNewerVersion('1.2.0', settings.appVersion || '0.0.0')) {
    //   // Migration for version 1.2.0
    //   mergedSettings.someNewSetting = defaultSettings.someNewSetting;
    // }

    // Update the version
    mergedSettings.appVersion = currentVersion;
    
    return mergedSettings;
  }
  
  return settings;
}

export const settingsAtom = atom(
  (get) => {
    const _settings = get(_settingsAtom);
    
    // Migrate settings if needed
    const migratedSettings = migrateSettings(_settings);
    
    // If settings were migrated, update them in the background
    if (!isEqual(_settings, migratedSettings)) {
      // Don't await this to avoid blocking the render
      updateSettings(() => migratedSettings).catch(console.error);
    }
    
    // Merge with defaults and clean up
    const settings = Object.assign({}, defaults.settings(), migratedSettings);
    settings.shortcuts = Object.assign({}, defaults.settings().shortcuts, migratedSettings.shortcuts);
    settings.mcp = Object.assign({}, defaults.settings().mcp, migratedSettings.mcp);
    
    // Remove deprecated properties
    return omit(settings, ['maxTokens', 'maxContextSize']) as Settings;
  },
  (get, set, update: SetStateAction<Settings>) => {
    const settings = get(_settingsAtom)
    const newSettings = typeof update === 'function' ? update(settings) : update
    // 考虑关键配置的缺省情况
    // if (!newSettings.apiHost) {
    //   newSettings.apiHost = defaults.settings().apiHost
    // }
    // 如果快捷键配置发生变化，需要重新注册快捷键
    if (newSettings.shortcuts !== settings.shortcuts) {
      platform.ensureShortcutConfig(newSettings.shortcuts)
    }
    // 如果代理配置发生变化，需要重新注册代理
    if (newSettings.proxy !== settings.proxy) {
      platform.ensureProxyConfig({ proxy: newSettings.proxy })
    }
    // 如果开机自启动配置发生变化，需要重新设置开机自启动
    if (Boolean(newSettings.autoLaunch) !== Boolean(settings.autoLaunch)) {
      platform.ensureAutoLaunch(newSettings.autoLaunch)
    }
    set(_settingsAtom, newSettings)
  }
)

export const languageAtom = focusAtom(settingsAtom, (optic) => optic.prop('language'))
export const showWordCountAtom = focusAtom(settingsAtom, (optic) => optic.prop('showWordCount'))
export const showTokenCountAtom = focusAtom(settingsAtom, (optic) => optic.prop('showTokenCount'))
export const showTokenUsedAtom = focusAtom(settingsAtom, (optic) => optic.prop('showTokenUsed'))
export const showModelNameAtom = focusAtom(settingsAtom, (optic) => optic.prop('showModelName'))
export const showMessageTimestampAtom = focusAtom(settingsAtom, (optic) => optic.prop('showMessageTimestamp'))
export const showFirstTokenLatencyAtom = focusAtom(settingsAtom, (optic) => optic.prop('showFirstTokenLatency'))
export const userAvatarKeyAtom = focusAtom(settingsAtom, (optic) => optic.prop('userAvatarKey'))
export const defaultAssistantAvatarKeyAtom = focusAtom(settingsAtom, (optic) => optic.prop('defaultAssistantAvatarKey'))
export const themeAtom = focusAtom(settingsAtom, (optic) => optic.prop('theme'))
export const fontSizeAtom = focusAtom(settingsAtom, (optic) => optic.prop('fontSize'))
export const spellCheckAtom = focusAtom(settingsAtom, (optic) => optic.prop('spellCheck'))
export const allowReportingAndTrackingAtom = focusAtom(settingsAtom, (optic) => optic.prop('allowReportingAndTracking'))
export const enableMarkdownRenderingAtom = focusAtom(settingsAtom, (optic) => optic.prop('enableMarkdownRendering'))
export const enableLaTeXRenderingAtom = focusAtom(settingsAtom, (optic) => optic.prop('enableLaTeXRendering'))
export const enableMermaidRenderingAtom = focusAtom(settingsAtom, (optic) => optic.prop('enableMermaidRendering'))
// export const selectedCustomProviderIdAtom = focusAtom(settingsAtom, (optic) => optic.prop('selectedCustomProviderId'))
export const autoPreviewArtifactsAtom = focusAtom(settingsAtom, (optic) => optic.prop('autoPreviewArtifacts'))
export const autoGenerateTitleAtom = focusAtom(settingsAtom, (optic) => optic.prop('autoGenerateTitle'))
export const autoCollapseCodeBlockAtom = focusAtom(settingsAtom, (optic) => optic.prop('autoCollapseCodeBlock'))
export const shortcutsAtom = focusAtom(settingsAtom, (optic) => optic.prop('shortcuts'))
export const pasteLongTextAsAFileAtom = focusAtom(settingsAtom, (optic) => optic.prop('pasteLongTextAsAFile'))
// export const licenseDetailAtom = focusAtom(settingsAtom, (optic) => optic.prop('licenseDetail'))

// Related UI state, moved here for proximity to settings
export const openSettingDialogAtom = atom<SettingWindowTab | null>(null)

// 存储新创建SessionSettings的默认值 缓存在 localStorage
export const chatSessionSettingsAtom = atomWithStorage<SessionSettings>(StorageKey.ChatSessionSettings, {}, storage)
export const pictureSessionSettingsAtom = atomWithStorage<SessionSettings>(
  StorageKey.PictureSessionSettings,
  {},
  storage
)

export const knowledgeBaseSettingsAtom = focusAtom(settingsAtom, (optic) =>
  optic.prop('extension').prop('knowledgeBase')
)
