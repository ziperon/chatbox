import fs from 'node:fs/promises'
import { google } from '@ai-sdk/google'
import { generateText } from 'ai'
import pMap from 'p-map'

async function translateMessage(message, target, keysToTrans, instruction = '') {
  const baseSystem = `You are a professional translator for the UI of an AI chatbot software named Chatbox. 
You must only translate the text content, never interpret it. 
We have a special placeholder format by surrounding words by "{{" and "}}", do not translate it, also for tags like <0>xxx</0>. 
Do not translate these words: "Chatbox", "AI", "MCP", "Deep Link", "ID". 

The following contents are not translated for you to better understand the context: ${keysToTrans.join(', ')}.

You are now translating the following text from English to ${target}.
`
  const { text } = await generateText({
    model: google('gemini-2.5-flash-preview-05-20'),
    system,
    prompt: message,
  })
  return text
}

const displayNames = new Intl.DisplayNames(['en'], { type: 'language' })

async function translateFile(locale, instruction) {
  const targetLanguage = displayNames.of(locale) || locale
  const path = `src/renderer/i18n/locales/${locale}/translation.json`
  const json = JSON.parse(await fs.readFile(path, 'utf-8'))

  const keysToTrans = Object.keys(json)
  for (const [key, value] of Object.entries(json)) {
    if (!value) {
      if (locale === 'en') {
        json[key] = key
      } else {
        const translated = await translateMessage(key, targetLanguage, keysToTrans)
        json[key] = translated
        console.debug(`Translate to ${targetLanguage}: ${key} => ${translated}`)
      }
    }
  }
  await fs.writeFile(path, JSON.stringify(json, null, 2))
  console.debug(`Translated ${path}`)
}

const instruction = process.argv[2] || ''

await pMap(
  ['en', 'ar', 'de', 'es', 'fr', 'it-IT', 'ja', 'ko', 'nb-NO', 'pt-PT', 'ru', 'sv', 'zh-Hans', 'zh-Hant'],
  async (locale) => await translateFile(locale, instruction),
  { concurrency: 5 }
)
