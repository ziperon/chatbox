import { initSessionsIfNeeded } from '../stores/sessionStorageMutations'
import { SystemProviders } from 'src/shared/defaults'
import { getModelSettingUtil } from '@/packages/model-setting-utils'
import type { ProviderModelInfo, Settings, ProviderSettings } from 'src/shared/types'
import storage from '@/storage'
import { StorageKey } from '@/storage/StoreStorage'
import * as defaults from 'src/shared/defaults'
// In your app initialization code
import { setupFirstKnowledgeBase } from './setupFirstKnowledgeBase'



async function updateAllProviderModels() {
  try {
    const settings: Settings = await storage.getItem<Settings>(StorageKey.Settings, defaults.settings())
    if (!settings.providers) settings.providers = {}

    let hasChanges = false
    console.log('Updating provider models...')

    for (const provider of SystemProviders) {
      try {
        const modelConfig = getModelSettingUtil(provider.id)
        const modelList = await modelConfig.getMergeOptionGroups({
          ...provider.defaultSettings,
          ...(settings.providers?.[provider.id] || {}),
        } as ProviderSettings)

        if (modelList.length) {
          console.log(`Processing ${modelList.length} model groups for provider ${provider.id}`)
          
          const newModels: ProviderModelInfo[] = modelList
            .reduce(
              (pre, cur) => [...pre, ...cur.options],
              [] as { label: string; value: string; recommended?: boolean }[]
            )
            .map((option) => {
              const capabilities: ('vision' | 'reasoning' | 'tool_use' | 'web_search')[] = []
              if (/ocr/i.test(option.value) || /vision/i.test(option.value)) capabilities.push('vision')
              if (/tool/i.test(option.value) || /Instruct/i.test(option.value)) capabilities.push('tool_use')
              if (/tool/i.test(option.value) || /Instruct/i.test(option.value)) capabilities.push('reasoning')
              
              // Логируем модели с capabilities для отладки
              if (capabilities.length > 0) {
                console.log(`Model ${option.value} has capabilities: ${capabilities.join(', ')}`)
              }
              
              return {
                modelId: option.value,
                type: (/embed/i.test(option.value) ||/embedding/i.test(option.value)) ? 'embedding' : undefined,
                capabilities: capabilities.length > 0 ? capabilities : undefined,
              }
            })

          const currentProviderSettings: ProviderSettings = (settings.providers?.[provider.id] || {}) as ProviderSettings
          const existingModels: ProviderModelInfo[] = currentProviderSettings.models || []

          const updatedModels = [
            ...existingModels,
            ...newModels.filter((model) => !existingModels.find((existing) => existing.modelId === model.modelId)),
          ]

          if (updatedModels.length > existingModels.length) {
            settings.providers = {
              ...settings.providers,
              [provider.id]: {
                ...currentProviderSettings,
                models: updatedModels,
              } as ProviderSettings,
            }
            hasChanges = true
            console.log(`Updated models for provider ${provider.id}: ${updatedModels.length} models`)
          }
        }
      } catch (error) {
        console.warn(`Failed to update models for provider ${provider.id}:`, error)
      }
    }

    if (hasChanges) {
      await storage.setItemNow(StorageKey.Settings, settings)
      console.log('Provider models updated and saved to storage')
    } else {
      console.log('No changes detected in provider models')
    }
  } catch (error) {
    console.warn('Failed to update provider models:', error)
  }
}

export async function initData() {
  await initSessionsIfNeeded()
  try {   
    await updateAllProviderModels()
  } catch (error) {
    console.error('Failed to update provider models:', error)
  }
  try {
    await setupFirstKnowledgeBase()
  } catch (error) {
    console.error('Failed to setup first knowledge base:', error)
  }
}

// Функция для принудительного обновления моделей при запуске
export async function forceUpdateModels() {
  console.log('Force updating provider models...')
  await updateAllProviderModels()
}
