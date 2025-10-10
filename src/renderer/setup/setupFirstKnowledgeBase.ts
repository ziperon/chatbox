import platform from '@/platform'
import { t } from 'i18next'

export async function setupFirstKnowledgeBase() {
  try {
    // Add a small delay to ensure storage is ready
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    try {
      const knowledgeBaseController = platform.getKnowledgeBaseController()
      
      // Check if any knowledge bases exist
      const existingKBs = await knowledgeBaseController.list()
      if (existingKBs && existingKBs.length > 0) {
        console.log('Knowledge bases already exist, skipping creation')
        return
      }

      console.log('Creating default knowledge base...')
      
      // Get the first available embedding model
      const embeddingModel = 'ollama:Qwen3-Embedding-8B:latest' // Default model
      const rerankModel = '' // Default to no rerank model
      const visionModel = 'ollama:qwen2_5_3b_ocr_100s:latest' // Default to no vision model

      // Create the default knowledge base
      await knowledgeBaseController.create({
        name: t('База знаний'),
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