import type { CoreMessage } from 'ai'
import pMap from 'p-map'
import type { ModelInterface } from 'src/shared/models/types'
import { createModelDependencies } from '@/adapters'
import type { Message } from '../../../shared/types'

export async function imageOCR(ocrModel: ModelInterface, messages: Message[]) {
  const dependencies = await createModelDependencies()

  return await pMap(messages, async (msg) => {
    await pMap(msg.contentParts, async (c) => {
      if (c.type === 'image' && !c.ocrResult) {
        const image = c
        const dataUrl = image.storageKey
        const imageData = await dependencies.storage.getImage(dataUrl)
        if (!imageData) {
          return c
        }
        const ocrResult = await doOCR(ocrModel, imageData)
        image.ocrResult = ocrResult
        return c
      }
      return c
    })
    return msg
  })
}
async function doOCR(model: ModelInterface, imageData: string) {
  const msg: CoreMessage = {
    role: 'user',
    content: [
      {
        type: 'text',
        text: 'OCR the following image into Markdown. Tables should be formatted as HTML. Do not sorround your output with triple backticks.',
      },
      { type: 'image', image: imageData, mimeType: 'image/png' },
    ],
  }
  const chatResult = await model.chat([msg], {})
  const text = chatResult.contentParts
    .filter((p) => p.type === 'text')
    .map((p) => p.text)
    .join('')

  return text
}
