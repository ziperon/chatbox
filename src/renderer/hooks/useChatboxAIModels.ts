import { useMemo } from 'react'
import { type ProviderModelInfo } from 'src/shared/types'

const useChatboxAIModels = () => {
  const allChatboxAIModels = useMemo<ProviderModelInfo[]>(() => [], [])
  const chatboxAIModels = useMemo<ProviderModelInfo[]>(() => [], [])
  
  return { allChatboxAIModels, chatboxAIModels }
}

export default useChatboxAIModels
