import platform from '@/platform'
import { t } from 'i18next'

export async function setupFirstKnowledgeBase() {
  try {
    // Add a small delay to ensure storage is ready
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    try {
      const knowledgeBaseController = platform.getKnowledgeBaseController()
      
      // Check if default knowledge base already exists
      const existingKBs = await knowledgeBaseController.list()
      const defaultName = t('База знаний общая')
      const hasDefault = Array.isArray(existingKBs) && existingKBs.some((kb: any) => kb?.name === defaultName)
      if (hasDefault) {
        console.log('Default knowledge base already exists, skipping creation')
        return
      }

      console.log('Creating default knowledge base...')
      
      // Use canonical provider:modelId format
      const embeddingModel = 'ollama:Qwen3-Embedding-8B:latest'
      const rerankModel = '' // Default to no rerank model
      const visionModel = 'ollama:qwen2_5_3b_ocr_100s:latest' // Default to no vision model

      console.log('Creating default knowledge base with models:', embeddingModel, rerankModel, visionModel)
      // Create the default knowledge base if missing
      await knowledgeBaseController.create({
        name: defaultName,
        embeddingModel,
        rerankModel,
        visionModel
      })

      console.log('Successfully created default knowledge base')
    } catch (kbError) {
      console.error('Knowledge base initialization error:', kbError)
      // Don't show toast here as it might be too early in the app lifecycle
    }
  } catch (error) {
    console.error('Unexpected error in setupFirstKnowledgeBase:', error)
    // Don't show toast here as it might be too early in the app lifecycle
  }
}