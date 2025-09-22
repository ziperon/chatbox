import * as chardet from 'chardet'
import Epub from 'epub'
import * as fs from 'fs-extra'
import * as iconv from 'iconv-lite'
import officeParser from 'officeparser'
import { isEpubFilePath, isOfficeFilePath } from '../shared/file-extensions'
import { getLogger } from './util'

const log = getLogger('file-parser')

// Helper function to decode HTML entities
function decodeHtmlEntities(text: string): string {
  // Handle hexadecimal entities like &#x6b64;
  text = text.replace(/&#x([0-9A-Fa-f]+);/g, (match, hex) => {
    try {
      return String.fromCharCode(parseInt(hex, 16))
    } catch (e) {
      return match // Return original if conversion fails
    }
  })

  // Handle decimal entities like &#123;
  text = text.replace(/&#(\d+);/g, (match, dec) => {
    try {
      return String.fromCharCode(parseInt(dec, 10))
    } catch (e) {
      return match // Return original if conversion fails
    }
  })

  // Handle named entities
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
}

// Simple concurrent map implementation using native Promise.allSettled
async function concurrentMap<T, R>(
  items: T[],
  mapper: (item: T, index: number) => Promise<R>,
  concurrency: number = 8
): Promise<R[]> {
  const results: R[] = []

  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency)
    const batchNumber = Math.floor(i / concurrency) + 1
    const totalBatches = Math.ceil(items.length / concurrency)

    log.debug(`Processing batch ${batchNumber}/${totalBatches} with ${batch.length} items`)

    const batchResults = await Promise.allSettled(batch.map((item, batchIndex) => mapper(item, i + batchIndex)))

    // Extract successful results
    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        results.push(result.value)
      }
    }
  }

  return results
}

// Function to split text into chunks with overlap
function splitTextIntoChunks(text: string, chunkSize: number = 4000, overlap: number = 200): string[] {
  const chunks: string[] = []
  let start = 0

  while (start < text.length) {
    let end = start + chunkSize

    // If this isn't the last chunk, try to find a good breaking point
    if (end < text.length) {
      // Look for the nearest sentence or paragraph end
      const nextSentenceEnd = text.indexOf('. ', end)
      const nextParagraphEnd = text.indexOf('\n\n', end)

      // Choose the closest natural break point
      end = Math.min(
        nextSentenceEnd > 0 ? nextSentenceEnd + 1 : text.length,
        nextParagraphEnd > 0 ? nextParagraphEnd + 2 : text.length,
        text.length
      )

      // If we couldn't find a good break point, just use the chunk size
      if (end <= start) {
        end = start + chunkSize
      }
    } else {
      end = text.length
    }

    const chunk = text.slice(start, end).trim()
    if (chunk) {
      chunks.push(chunk)
    }

    // Move start position, accounting for overlap
    start = Math.max(start + 1, end - overlap)
  }

  return chunks
}

// Process large text by splitting it into chunks and processing each chunk with user query
async function processLargeText(
  text: string,
  processFn: (chunk: string, userQuery?: string, chunkIndex?: number, totalChunks?: number) => Promise<string>,
  options: {
    chunkSize?: number;
    overlap?: number;
    userQuery?: string;
  } = {}
): Promise<string> {
  const {
    chunkSize = 10000,
    overlap = 1000,
    userQuery = ''
  } = options;

  const chunks = splitTextIntoChunks(text, chunkSize, overlap);
  log.info(`Split text into ${chunks.length} chunks for processing`);

  const results: string[] = [];

  for (let i = 0; i < chunks.length; i++) {
    try {
      log.debug(`Processing chunk ${i + 1}/${chunks.length}`);
      
      // Include user query context with each chunk
      const chunkWithContext = userQuery 
        ? `User's query: "${userQuery}"\n\nText to analyze:\n${chunks[i]}`
        : chunks[i];
      
      const result = await processFn(
        chunkWithContext,
        userQuery,
        i + 1, // current chunk number (1-based)
        chunks.length // total chunks
      );
      
      results.push(result);
    } catch (error) {
      log.error(`Error processing chunk ${i + 1}:`, error);
      // Optionally, you might want to include the original chunk if processing fails
      results.push(`[Error processing chunk: ${error.message}]\n${chunks[i]}`);
    }
  }

  return results.join('\n\n').trim();
}

export async function parseFile(filePath: string) {
  if (isOfficeFilePath(filePath)) {
    try {
      const data = await officeParser.parseOfficeAsync(filePath)
      return data
    } catch (error) {
      log.error(error)
      throw error
    }
  }

  if (isEpubFilePath(filePath)) {
    try {
      const data = await parseEpub(filePath)
      return data
    } catch (error) {
      log.error(error)
      throw error
    }
  }

  // Read first 4KB for encoding detection to avoid memory issues with large files
  const stats = await fs.stat(filePath)
  const sampleSize = Math.min(4096, stats.size)

  // Read sample using createReadStream for partial file reading
  const sampleBuffer = new Uint8Array(sampleSize)
  const fd = await fs.promises.open(filePath, 'r')
  await fd.read(sampleBuffer, 0, sampleSize, 0)
  await fd.close()

  // Detect encoding from sample
  const detectedEncoding = chardet.detect(sampleBuffer)
  const encoding = detectedEncoding || 'utf8'

  log.debug(`Detected encoding for ${filePath}: ${encoding}`)

  // Read full file as buffer and convert with detected encoding
  const fileBuffer = await fs.readFile(filePath)
  const data = iconv.decode(fileBuffer, encoding)
  return data
}

export async function parseEpub(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const epub = new Epub(filePath)

    epub.on('error', (error) => {
      log.error('EPUB parsing error:', error)
      reject(error)
    })

    epub.on('end', async () => {
      try {
        const metadata = epub.metadata as { title?: string; creator?: string; language?: string }
        log.info('EPUB metadata:', {
          title: metadata.title,
          creator: metadata.creator,
          language: metadata.language,
          chapters: epub.flow.length,
        })

        // Helper function to process a single chapter
        const processChapter = async (chapter: { id: string }): Promise<string | null> => {
          try {
            const chapterText = await new Promise<string>((resolveChapter, rejectChapter) => {
              epub.getChapter(chapter.id, (error, text) => {
                if (error) {
                  log.error(`Error reading chapter ${chapter.id}:`, error)
                  rejectChapter(error)
                } else {
                  resolveChapter(text || '')
                }
              })
            })

            // Remove HTML tags and extract plain text
            let plainText = chapterText.replace(/<[^>]*>/g, '') // Remove HTML tags

            // Decode HTML entities (including hex)
            plainText = decodeHtmlEntities(plainText)
              .replace(/\s+/g, ' ') // Replace multiple whitespaces with single space
              .trim()

            return plainText || null
          } catch (chapterError) {
            log.warn(`Failed to read chapter ${chapter.id}, skipping:`, chapterError)
            return null // Return null for failed chapters to continue processing
          }
        }

        // Extract text from all chapters using concurrent processing
        log.info(`Starting concurrent processing of ${epub.flow.length} chapters with concurrency: 8`)

        const chapterResults = await concurrentMap(epub.flow as { id: string }[], processChapter, 8)
        const chapterTexts = chapterResults.filter((text: string | null) => text !== null) as string[]
        log.info(`Successfully processed ${chapterTexts.length}/${epub.flow.length} chapters`)

        const fullText = chapterTexts.join('\n\n')

        if (!fullText) {
          throw new Error('No readable text content found in EPUB file')
        }

        log.info(`Successfully extracted ${fullText.length} characters from ${chapterTexts.length} chapters`)

        // Process the full text with chunking if needed
        if (fullText.length > 4000) {
          log.info('Text is large, processing with chunking')
          const processTextChunk = async (chunk: string): Promise<string> => {
            // Here you would typically call your Ollama API or other processing
            // For now, we'll just return the chunk as is
            return chunk
          }

          const processedText = await processLargeText(fullText, processTextChunk)
          resolve(processedText)
        } else {
          resolve(fullText)
        }
      } catch (error) {
        log.error('Error extracting EPUB content:', error)
        reject(error)
      }
    })

    epub.parse()
  })
}

// Example of how to use it with a user query
export async function processDocumentWithQuery(
  filePath: string, 
  userQuery: string,
  processChunkFn: (chunk: string) => Promise<string>
): Promise<string> {
  const text = await parseFile(filePath);
  
  return processLargeText(text, processChunkFn, {
    userQuery,
    chunkSize: 3000, // Slightly smaller chunks when including query
    overlap: 300     // Slightly larger overlap for better context
  });
}

// Example implementation of processChunkFn
const exampleProcessChunk = async (
  chunk: string, 
  userQuery?: string, 
  chunkIndex?: number, 
  totalChunks?: number
): Promise<string> => {
  // Here you would typically call your Ollama API
  // The chunk already includes the user query at the beginning
  
  // Example with Ollama API (uncomment and modify as needed):
  /*
  const response = await ollamaApi.generate({
    model: 'llama3',
    prompt: chunk,
    stream: false,
    options: {
      // You can include chunk information in the system prompt
      system: `You are analyzing document part ${chunkIndex} of ${totalChunks}. ` +
              `Focus on answering the user's query: "${userQuery || 'No specific query provided'}"`
    }
  });
  return response.response;
  */
  
  // For now, just return the chunk as is
  return chunk;
};

// Export the chunking functions for use elsewhere
export { splitTextIntoChunks, processLargeText }
