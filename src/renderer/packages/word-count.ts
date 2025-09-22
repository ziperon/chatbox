import { countWord as sharedCountWord } from '../../shared/utils/word_count'

/**
 * Renderer 层的 countWord 包装器
 */
export function countWord(data: string): number {
  try {
    return sharedCountWord(data)
  } catch (e) {
    return -1
  }
}
