import Store from 'electron-store'
import { Config, Settings } from '../shared/types'
import * as defaults from '../shared/defaults'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import * as fs from 'fs-extra'
import { app, powerMonitor } from 'electron'
import sanitizeFilename from 'sanitize-filename'
import { getLogger } from './util'
import { settings as defaultSettings } from '../shared/defaults'

const logger = getLogger('store-node')

const configPath = path.resolve(app.getPath('userData'), 'config.json')

// 1) 检查配置文件是否合法
// 如果配置文件不合法，则使用最新的备份文件
if (fs.existsSync(configPath) && !checkConfigValid(configPath)) {
  logger.error('config.json is invalid.')
  const backups = getBackups()
  if (backups.length > 0) {
    // 不断尝试使用最新的备份文件，直到成功
    for (let i = backups.length - 1; i >= 0; i--) {
      const backup = backups[i]
      if (checkConfigValid(backup.filepath)) {
        fs.copySync(backup.filepath, configPath)
        logger.info('use backup:', backup.filepath)
        break
      }
    }
  }
}

// 扩展 StoreType 接口以包含 appVersion
interface StoreType {
  settings: Settings
  configs: Config
  lastShownAboutDialogVersion: string // 上次启动时自动弹出关于对话框的应用版本
  appVersion?: string // 应用版本号
}

// 更新提供者配置的函数
function updateProviderConfigs(currentSettings: Settings): Settings {
  const defaultSettingsValue = defaultSettings()
  // 创建新的设置对象，确保我们不会修改原始对象
  const updatedSettings = JSON.parse(JSON.stringify(currentSettings))
  
  // 确保 providers 对象存在
  if (!updatedSettings.providers) {
    updatedSettings.providers = {}
  }

  // 获取默认提供者配置
  const defaultProviders = defaultSettingsValue.providers || {}
  
  // 强制更新所有提供者配置
  Object.entries(defaultProviders).forEach(([providerId, defaultProviderConfig]) => {
    // 记录当前配置状态
    const hasExistingConfig = !!updatedSettings.providers[providerId]
    const existingModels = hasExistingConfig ? updatedSettings.providers[providerId]?.models : []
    
    // 完全替换提供者配置
    updatedSettings.providers[providerId] = {
      ...defaultProviderConfig,
      // 保留现有的API密钥和敏感信息
      ...(hasExistingConfig ? {
        apiKey: updatedSettings.providers[providerId]?.apiKey,
        apiHost: updatedSettings.providers[providerId]?.apiHost,
        // 保留现有的模型配置
        models: defaultProviderConfig.models
      } : {})
    }
    
    logger.info(`Updated provider: ${providerId} (${hasExistingConfig ? 'updated' : 'added'})`)
    
    // 记录详细的配置变更
    if (hasExistingConfig) {
      logger.debug(`Provider ${providerId} config updated to:`, 
        JSON.stringify(updatedSettings.providers[providerId], null, 2))
    }
  })
  
  return updatedSettings
}

// 2) 检查并迁移配置
function migrateConfig() {
  try {
    const currentVersion = app.getVersion()
    const storeData = store.store as StoreType
    const lastVersion = storeData.appVersion || '0.0.0'
    
    // 总是执行迁移，即使版本号相同
    const forceUpdate = true  // 强制更新配置
    
    if (!forceUpdate && lastVersion === currentVersion) {
      logger.info(`No version change detected (${currentVersion}). Skipping migration.`)
      return
    }
    
    logger.info(`Starting config migration (${lastVersion} → ${currentVersion})...`)

    logger.info(`Starting config migration from version ${lastVersion} to ${currentVersion}`)
    
    // 获取当前配置
    const settings = storeData.settings
    const configs = storeData.configs
    
    // 总是更新设置，即使它们已经存在
    const settingsToUpdate = settings || {}
    logger.info('Updating provider configurations...')
    
    // 强制更新所有提供者配置
    const updatedSettings = updateProviderConfigs(settingsToUpdate)
    
    // 应用其他必要的默认值
    const finalSettings = {
      ...defaultSettings(),  // 应用所有默认值
      ...updatedSettings,    // 保留用户的自定义设置
      providers: updatedSettings.providers  // 确保提供者配置被应用
    }
    
    // 保存更新后的设置
    logger.info('Saving updated settings...')
    store.set('settings', finalSettings)
    
    // 记录更新完成
    logger.info('Settings update completed successfully')
    
    // 确保配置存在
    if (!configs || !('uuid' in configs)) {
      logger.info('Generating new config UUID...')
      store.set('configs', { uuid: uuidv4() })
    }
    
    // 更新版本号
    store.set('appVersion', currentVersion)
    
    logger.info(`Config migration to version ${currentVersion} completed successfully`)
  } catch (error) {
    logger.error('Error during config migration:', error)
  }
}

// 2) 初始化store
export const store = new Store<StoreType>({
  clearInvalidConfig: true, // 当配置JSON不合法时，清空配置
})
logger.info('init store, config path:', store.path)

// 3) 迁移配置
migrateConfig()

// 4) 启动自动备份，每10分钟备份一次，并自动清理多余的备份文件
autoBackup()
let autoBackupTimer = setInterval(autoBackup, 10 * 60 * 1000)
powerMonitor.on('resume', () => {
  clearInterval(autoBackupTimer)
  autoBackupTimer = setInterval(autoBackup, 10 * 60 * 1000)
})
powerMonitor.on('suspend', () => {
  clearInterval(autoBackupTimer)
})
async function autoBackup() {
  try {
    if (needBackup()) {
      const filename = await backup()
      if (filename) {
        logger.info('auto backup:', filename)
      }
    }
    await clearBackups()
  } catch (err) {
    logger.error('auto backup error:', err)
  }
}

export function getSettings(): Settings {
  const defaultSettings = defaults.settings();
  var settings = store.get<'settings'>('settings', defaults.settings())
  settings.enableAuth = defaultSettings.enableAuth ?? true
  settings.defaultChatModel = defaultSettings.defaultChatModel
  return settings
}

export function getConfig(): Config {
  let configs = store.get<'configs'>('configs')
  if (!configs) {
    configs = defaults.newConfigs()
    store.set<'configs'>('configs', configs)
  }
  return configs
}

/**
 * 备份配置文件
 */
export async function backup() {
  if (!fs.existsSync(configPath)) {
    logger.error('skip backup because config.json does not exist.')
    return
  }
  if (!checkConfigValid(configPath)) {
    logger.error('skip backup because config.json is invalid.')
    return
  }
  let now = new Date().toISOString().replace(/:/g, '_')
  const backupPath = path.resolve(app.getPath('userData'), `config-backup-${now}.json`)
  try {
    await fs.copy(configPath, backupPath)
  } catch (err) {
    logger.error('Failed to backup config:', err)
    return
  }
  logger.info('backup config to:', backupPath)
  return backupPath
}

/**
 * 获取所有备份文件，并按照时间排序
 * @returns 备份文件信息
 */
export function getBackups() {
  const filenames = fs.readdirSync(app.getPath('userData'))
  const backupFilenames = filenames.filter((filename) => filename.startsWith('config-backup-'))
  if (backupFilenames.length === 0) {
    return []
  }
  let backupFileInfos = backupFilenames.map((filename) => {
    let dateStr = filename.replace('config-backup-', '').replace('.json', '')
    dateStr = dateStr.replace(/_/g, ':')
    const date = new Date(dateStr)
    return {
      filename,
      filepath: path.resolve(app.getPath('userData'), filename),
      dateMs: date.getTime() || 0,
    }
  })
  backupFileInfos = backupFileInfos.sort((a, b) => a.dateMs - b.dateMs)
  return backupFileInfos
}

/**
 * 检查是否需要备份
 * @returns 是否需要备份
 */
export function needBackup() {
  const backups = getBackups()
  if (backups.length === 0) {
    return true
  }
  const lastBackup = backups[backups.length - 1]
  return lastBackup.dateMs < Date.now() - 10 * 60 * 1000 // 10分钟备份一次
}

/**
 * 清理备份文件，仅保留最近50个备份
 */
export async function clearBackups() {
  const limit = 50
  const backups = getBackups()
  if (backups.length < limit) {
    return
  }

  const now = new Date()
  const todayStartMs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const yesterdayStartMs = todayStartMs - 24 * 60 * 60 * 1000
  const thirtyDaysAgoStartMs = todayStartMs - 30 * 24 * 60 * 60 * 1000

  const backupsToDelete: { filename: string; filepath: string }[] = []
  const keptHourlyBackups: { [hourKey: string]: { filename: string; filepath: string } } = {} // Key: YYYY-MM-DD-HH
  const keptDailyBackups: { [dateKey: string]: { filename: string; filepath: string } } = {} // Key: YYYY-MM-DD

  for (const backup of backups) {
    const backupDate = new Date(backup.dateMs)
    const dateKey = backupDate.toISOString().slice(0, 10) // YYYY-MM-DD
    const hourKey = `${dateKey}-${backupDate.toISOString().slice(11, 13)}` // YYYY-MM-DD-HH

    if (backup.dateMs < thirtyDaysAgoStartMs) {
      // Older than 30 days: mark for deletion
      backupsToDelete.push({ filename: backup.filename, filepath: backup.filepath })
    } else if (backup.dateMs < yesterdayStartMs) {
      // Between 30 days ago and yesterday (exclusive): keep latest per day
      const existingKept = keptDailyBackups[dateKey]
      if (existingKept) {
        // A backup for this day was already kept; mark the older one for deletion
        backupsToDelete.push(existingKept)
      }
      // Keep the current one (it's the latest encountered for this day so far)
      keptDailyBackups[dateKey] = { filename: backup.filename, filepath: backup.filepath }
    } else {
      // Today or yesterday: keep latest per hour
      const existingKept = keptHourlyBackups[hourKey]
      if (existingKept) {
        // A backup for this hour was already kept; mark the older one for deletion
        backupsToDelete.push(existingKept)
      }
      // Keep the current one (it's the latest encountered for this hour so far)
      keptHourlyBackups[hourKey] = { filename: backup.filename, filepath: backup.filepath }
    }
  }

  // Perform the actual deletions
  if (backupsToDelete.length > 0) {
    logger.info(`Clearing ${backupsToDelete.length} old backup(s)...`)
    try {
      await Promise.all(
        backupsToDelete.map(async (backup) => {
          await fs.remove(backup.filepath)
          // logger.info('clear backup:', backup.filename) // Log per file might be too verbose
        })
      )
      logger.info('Finished clearing old backups.')
    } catch (err) {
      logger.error('Failed to clear some backups:', err)
    }
  }
}

/**
 * 检查配置文件是否是合法的JSON文件
 * @returns 配置文件是否合法
 */
function checkConfigValid(filepath: string) {
  try {
    JSON.parse(fs.readFileSync(filepath, 'utf8'))
  } catch (err) {
    return false
  }
  return true
}

export async function getStoreBlob(key: string) {
  const filename = path.resolve(app.getPath('userData'), 'chatbox-blobs', sanitizeFilename(key))
  const exists = await fs.pathExists(filename)
  if (!exists) {
    return null
  }
  return fs.readFile(filename, { encoding: 'utf-8' })
}

export async function setStoreBlob(key: string, value: string) {
  const filename = path.resolve(app.getPath('userData'), 'chatbox-blobs', sanitizeFilename(key))
  await fs.ensureDir(path.dirname(filename))
  return fs.writeFile(filename, value, { encoding: 'utf-8' })
}

export async function delStoreBlob(key: string) {
  const filename = path.resolve(app.getPath('userData'), 'chatbox-blobs', sanitizeFilename(key))
  const exists = await fs.pathExists(filename)
  if (!exists) {
    return
  }
  await fs.remove(filename)
}

export async function listStoreBlobKeys() {
  const dir = path.resolve(app.getPath('userData'), 'chatbox-blobs')
  const exists = await fs.pathExists(dir)
  if (!exists) {
    return []
  }
  return fs.readdir(dir)
}
