import { ModelProvider, ModelProviderEnum, ProviderSettings, SessionType } from 'src/shared/types'
import { ModelSettingUtil } from './interface'
import Ollama from 'src/shared/models/ollama'
import BaseConfig from './base-config'
import { createModelDependencies } from '@/adapters'

export default class OllamaSettingUtil extends BaseConfig implements ModelSettingUtil {
  public provider: ModelProvider = ModelProviderEnum.Ollama
  async getCurrentModelDisplayName(
    model: string,
    sessionType: SessionType,
    providerSettings?: ProviderSettings
  ): Promise<string> {
    return `Ollama (${providerSettings?.models?.find((m) => m.modelId === model)?.nickname || model})`
  }

  protected async listProviderModels(settings: ProviderSettings) {
    const dependencies = await createModelDependencies()
    const ollama = new Ollama(
      {
        ollamaHost: settings.apiHost!,
        model: {
          modelId: '',
          capabilities: [],
        },
        temperature: 0,
      },
      dependencies
    )
    return ollama.listModels()
  }
}
