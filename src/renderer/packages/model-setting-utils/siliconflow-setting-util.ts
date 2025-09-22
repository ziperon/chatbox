import SiliconFlow from 'src/shared/models/siliconflow'
import { type ModelProvider, ModelProviderEnum, type ProviderSettings, type SessionType } from 'src/shared/types'
import { createModelDependencies } from '@/adapters'
import BaseConfig from './base-config'
import type { ModelSettingUtil } from './interface'

export default class SiliconFlowSettingUtil extends BaseConfig implements ModelSettingUtil {
  public provider: ModelProvider = ModelProviderEnum.SiliconFlow
  async getCurrentModelDisplayName(
    model: string,
    sessionType: SessionType,
    providerSettings?: ProviderSettings
  ): Promise<string> {
    return `SiliconFlow API (${providerSettings?.models?.find((m) => m.modelId === model)?.nickname || model})`
  }

  protected async listProviderModels(settings: ProviderSettings) {
    const dependencies = await createModelDependencies()
    const siliconFlow = new SiliconFlow(
      {
        apiKey: settings.apiKey!,
        model: {
          modelId: '',
          capabilities: [],
        },
      },
      dependencies
    )
    return siliconFlow.listModels()
  }
}
