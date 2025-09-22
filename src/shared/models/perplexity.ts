import { createPerplexity } from '@ai-sdk/perplexity'
import { extractReasoningMiddleware, wrapLanguageModel } from 'ai'
import type { ProviderModelInfo } from '../types'
import type { ModelDependencies } from '../types/adapters'
import AbstractAISDKModel from './abstract-ai-sdk'

interface Options {
  perplexityApiKey: string
  model: ProviderModelInfo
  temperature?: number
  topP?: number
  maxTokens?: number
  stream?: boolean
}

export default class Perplexity extends AbstractAISDKModel {
  public name = 'Perplexity API'

  constructor(public options: Options, dependencies: ModelDependencies) {
    super(options, dependencies)
  }
  
  protected getProvider() {
    return createPerplexity({
      apiKey: this.options.perplexityApiKey,
    })
  }

  protected getChatModel() {
    const provider = this.getProvider()
    return wrapLanguageModel({
      model: provider.languageModel(this.options.model.modelId),
      middleware: extractReasoningMiddleware({ tagName: 'think' }),
    })
  }
}

export const perplexityModels = ['sonar-deep-research', 'sonar-reasoning-pro', 'sonar-reasoning', 'sonar-pro', 'sonar']
