import { CohereClient } from 'cohere-ai'
import { getModel, getProviderSettings } from '../../shared/models'
import { getChatboxAPIOrigin } from '../../shared/request/chatboxai_pool'
import { createModelDependencies } from '../adapters'
import { cache } from '../cache'
import { getConfig, getSettings, store } from '../store-node'
import { getLogger } from '../util'
import { getDatabase } from './db'

const log = getLogger('knowledge-base:model-providers')

function getMergedSettings(providerId: string, modelId: string) {
  try {
    const globalSettings = getSettings()
    const providerEntry = Object.entries(globalSettings.providers ?? {}).find(([key, value]) => key === providerId)
    if (!providerEntry) {
      const error = new Error(`provider ${providerId} not set`)
      log.error(`[MODEL] Provider not configured: ${providerId}`)
      throw error
    }

    // Build complete settings object for getModel
    return {
      ...globalSettings,
      provider: providerId,
      modelId,
    }
  } catch (error: any) {
    log.error(`[MODEL] Failed to get merged settings for ${providerId}:${modelId}`, error)
    throw error
  }
}

export async function getEmbeddingProvider(kbId: number) {
  return cache(
    `kb:embedding:${kbId}`,
    async () => {
      try {
        const db = getDatabase()
        const rs = await db.execute('SELECT * FROM knowledge_base WHERE id = ?', [kbId])

        if (!rs.rows[0]) {
          const error = new Error(`Knowledge base ${kbId} not found`)
          log.error(`[MODEL] Knowledge base not found: ${kbId}`)
          throw error
        }

        let embeddingModel = (rs.rows[0].embedding_model as string) || ''

        // Provide sensible defaults: prefer Ollama nomic-embed-text
        if (!embeddingModel || typeof embeddingModel !== 'string') {
          embeddingModel = 'ollama:nomic-embed-text:latest'
          log.warn(
            `[MODEL] embedding_model not set for kb=${kbId}; using default embedding model: ${embeddingModel}`
          )
        }

        // Normalize friendly label format like "Ollama | model:tag" to canonical "provider:model:tag"
        const pipeIdx = embeddingModel.indexOf('|')
        if (pipeIdx !== -1) {
          const left = embeddingModel.slice(0, pipeIdx).trim()
          const right = embeddingModel.slice(pipeIdx + 1).trim()
          const providerId = left.toLowerCase().replace(/\s+/g, '') // e.g., 'Ollama' -> 'ollama'
          embeddingModel = `${providerId}:${right}`
          log.info(`[MODEL] Converted labeled embedding model to canonical: ${embeddingModel}`)
        }

        // If provider is missing, assume ollama
        if (!embeddingModel.includes(':')) {
          embeddingModel = `ollama:${embeddingModel}`
          log.info(`[MODEL] Normalized embedding_model for kb=${kbId} -> ${embeddingModel}`)
        }

        const sepIdx = embeddingModel.indexOf(':')
        if (sepIdx === -1) {
          const error = new Error(`Invalid embedding model format: ${embeddingModel}`)
          log.error(`[MODEL] Invalid embedding model format: ${embeddingModel}`)
          throw error
        }
        const providerId = embeddingModel.slice(0, sepIdx)
        const modelId = embeddingModel.slice(sepIdx + 1)

        const modelSettings = getMergedSettings(providerId, modelId)
        const model = getModel(modelSettings, getConfig(), await createModelDependencies())
        // Access text embedding model and attach modelId so downstream can retrieve it (used by file-loaders getOllamaEmbedding)
        const embModel = (model as any).getTextEmbeddingModel({})
        ;(embModel as any).modelId = modelId
        
        // Get API host from provider settings if available
        const providerSettings = modelSettings?.providers?.[providerId]
        const apiHost = typeof providerSettings === 'object' && providerSettings !== null && 'apiHost' in providerSettings
          ? providerSettings.apiHost
          : 'http://llm:11435'
          
        return {
          ...embModel,
          modelId,
          apiHost
        }
      } catch (error: any) {
        log.error(`[MODEL] Failed to get embedding provider for kb ${kbId}:`, error)
        throw error
      }
    },
    {
      ttl: 1000 * 60, // 1 minute
    }
  )
}

// Return vision model and its dependencies, constructed with getModel
export async function getVisionProvider(kbId: number) {
  return cache(
    `kb:vision:${kbId}`,
    async () => {
      try {
        const db = getDatabase()
        const rs = await db.execute('SELECT * FROM knowledge_base WHERE id = ?', [kbId])

        if (!rs.rows[0]) {
          const error = new Error(`Knowledge base ${kbId} not found`)
          log.error(`[MODEL] Knowledge base not found: ${kbId}`)
          throw error
        }

        const visionModel = rs.rows[0].vision_model as string
        if (!visionModel) {
          return null
        }

        const vSepIdx = visionModel.indexOf(':')
        if (vSepIdx === -1) {
          const error = new Error(`Invalid vision model format: ${visionModel}`)
          log.error(`[MODEL] Invalid vision model format: ${visionModel}`)
          throw error
        }
        const providerId = visionModel.slice(0, vSepIdx)
        const modelId = visionModel.slice(vSepIdx + 1)

        const settingsForModel = getMergedSettings(providerId, modelId)
        const dependencies = await createModelDependencies()
        const model = getModel(settingsForModel, getConfig(), dependencies)

        return { model, dependencies }
      } catch (error: any) {
        log.error(`[MODEL] Failed to get vision provider for kb ${kbId}:`, error)
        throw error
      }
    },
    { ttl: 1000 * 60 }
  )
}

export async function getRerankProvider(kbId: number) {
  return cache(
    `kb:rerank:${kbId}`,
    async () => {
      try {
        const db = getDatabase()
        const rs = await db.execute('SELECT * FROM knowledge_base WHERE id = ?', [kbId])

        if (!rs.rows[0]) {
          const error = new Error(`Knowledge base ${kbId} not found`)
          log.error(`[MODEL] Knowledge base not found: ${kbId}`)
          throw error
        }

        const rerankModel = rs.rows[0].rerank_model as string
        if (!rerankModel) {
          return null
        }

        const rSepIdx = rerankModel.indexOf(':')
        if (rSepIdx === -1) {
          const error = new Error(`Invalid rerank model format: ${rerankModel}`)
          log.error(`[MODEL] Invalid rerank model format: ${rerankModel}`)
          throw error
        }
        const providerId = rerankModel.slice(0, rSepIdx)
        const modelId = rerankModel.slice(rSepIdx + 1)

        const settings = getMergedSettings(providerId, modelId)
        const { providerSetting, formattedApiHost } = getProviderSettings(settings)

        let apiHost = formattedApiHost
        let token = providerSetting.apiKey
        if (providerId === 'chatbox-ai') {
          apiHost = getChatboxAPIOrigin()
          token = store.get('settings.licenseKey')
        }

        const client = new CohereClient({
          environment: apiHost,
          token,
        })
        return { client, modelId }
      } catch (error: any) {
        log.error(`[MODEL] Failed to get rerank provider for kb ${kbId}:`, error)
        throw error
      }
    },
    {
      ttl: 1000 * 60, // 1 minute
    }
  )
}
