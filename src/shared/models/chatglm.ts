import type { ModelDependencies } from '../types/adapters'
import OpenAICompatible, { type OpenAICompatibleSettings } from './openai-compatible'

interface Options extends OpenAICompatibleSettings {}

export default class ChatGLM extends OpenAICompatible {
  public name = 'ChatGLM'
  public options: Options

  constructor(options: Omit<Options, 'apiHost'>, dependencies: ModelDependencies) {
    const apiHost = 'https://open.bigmodel.cn/api/paas/v4/'
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

  public async listModels() {
    return []
  }
}
