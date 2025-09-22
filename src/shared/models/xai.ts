import type { ModelDependencies } from '../types/adapters'
import OpenAICompatible, { type OpenAICompatibleSettings } from './openai-compatible'

interface Options extends OpenAICompatibleSettings {}

export default class XAI extends OpenAICompatible {
  public name = 'xAI'
  public options: Options
  constructor(options: Omit<Options, 'apiHost'>, dependencies: ModelDependencies) {
    const apiHost = 'https://api.x.ai/v1'
    super(
      {
        apiKey: options.apiKey,
        apiHost,
        model: options.model,
        temperature: options.temperature,
        topP: options.topP,
        maxTokens: options.maxTokens,
        stream: options.stream,
      },
      dependencies
    )
    this.options = {
      ...options,
      apiHost,
    }
  }
}
