import * as chardet from 'chardet'
import Epub from 'epub'
import * as fs from 'fs-extra'
import * as iconv from 'iconv-lite'
import officeParser, { OfficeParserConfig } from 'officeparser'
import { isCsvPath, isEpubFilePath, isOfficeFilePath, isWordFile, isExcelFile, isPowerPointFile } from '../shared/file-extensions'
import { getLogger } from './util'
import * as csv from 'csv-parse/sync'


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

// Enhanced office file parsing with better error handling
async function parseOfficeFile(filePath: string): Promise<string> {
  const startTime = Date.now()
  
  try {
    log.debug(`[OFFICE] Starting to parse office file: ${filePath}`)
    
    // Special handling for different office file types
    if (isWordFile(filePath)) {
      log.debug(`[OFFICE] Parsing Word document: ${filePath}`)
    } else if (isExcelFile(filePath)) {
      log.debug(`[OFFICE] Parsing Excel spreadsheet: ${filePath}`)
    } else if (isPowerPointFile(filePath)) {
      log.debug(`[OFFICE] Parsing PowerPoint presentation: ${filePath}`)
    }
    
    // Configure office parser options with valid properties
    // Using type assertion to handle the OfficeParserConfig type
    const parserOptions = {} as OfficeParserConfig;
    
    const content = await officeParser.parseOfficeAsync(filePath, parserOptions)
    
    const processingTime = Date.now() - startTime
    log.debug(`[OFFICE] Successfully parsed office file in ${processingTime}ms: ${filePath}`)
    
    // Post-process the content
    let processedContent = content
    
    // Clean up any remaining HTML entities
    processedContent = decodeHtmlEntities(processedContent)
    
    // Remove excessive whitespace but preserve paragraph breaks
    processedContent = processedContent
      .replace(/\s*\n\s*\n\s*/g, '\n\n')  // Preserve paragraph breaks
      .replace(/[ \t]+/g, ' ')  // Replace multiple spaces/tabs with single space
      .trim()
    
    return processedContent
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    log.error(`[OFFICE] Error parsing office file ${filePath}: ${errorMsg}`)
    
    // Try fallback methods if the main parser fails
    try {
      log.warn(`[OFFICE] Attempting fallback parsing for: ${filePath}`)
      const fallbackContent = await fs.readFile(filePath, 'utf-8')
      return fallbackContent
    } catch (fallbackError) {
      const fallbackErrorMsg = fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
      log.error(`[OFFICE] Fallback parsing failed for ${filePath}: ${fallbackErrorMsg}`)
      throw new Error(`Failed to parse office file: ${filePath}. Error: ${errorMsg}`)
    }
  }
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
      const errorMessage = error instanceof Error ? error.message : String(error);
      log.error(`Error processing chunk ${i + 1}:`, errorMessage);
      results.push(`[Error processing chunk: ${errorMessage}]\n${chunks[i]}`);
    }

  // Combine all results
  return results.join('\n\n');
}
}


/**
{{ ... }}
 * Парсинг CSV файла с автоматическим определением разделителя
 */
async function parseCsvFile(filePath: string): Promise<string> {
  try {
    // Читаем файл
    const fileContent = await fs.readFile(filePath, 'utf-8');

    // Пробуем определить разделитель
    const firstLine = fileContent.split('\n')[0];
    let delimiter = ',';

    // Проверяем различные разделители
    if (firstLine.includes('\t')) {
      delimiter = '\t';
    } else if (firstLine.includes(';')) {
      delimiter = ';';
    } else if (firstLine.includes('|')) {
      delimiter = '|';
    }

    // Parse CSV with proper typing
    const records: Record<string, string>[] = csv.parse(fileContent, {
      delimiter,
      columns: true, // Use first line as headers
      skip_empty_lines: true,
      trim: true,
      relax_quotes: true,
      skip_records_with_error: true
    }) as Record<string, string>[];

    if (records.length === 0) {
      return 'CSV file is empty or contains no data.';
    }

    // Convert to readable text
    const headers = Object.keys(records[0]);
    const rows = records.map((record: Record<string, string>) =>
      headers.map(header => `${header}: ${record[header] || ''}`).join(', ')
    );

    // Limit number of rows for very large files
    const maxRows = 1000;
    const totalRows = rows.length;
    const displayedRows = rows.slice(0, maxRows);

    let result = `CSV data (${totalRows} rows, ${headers.length} columns):\n\n`;
    result += `Columns: ${headers.join(', ')}\n\n`;
    result += displayedRows.join('\n');

    if (totalRows > maxRows) {
      result += `\n\n... and ${totalRows - maxRows} more rows not shown`;
    }

    return result;

  } catch (error) {
    log.error('Ошибка при парсинге CSV:', error);
    throw new Error(`Не удалось обработать CSV файл: ${error.message}`);
  }
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
async function processDocumentWithQuery(
  filePath: string,
  userQuery: string,
  processChunkFn: (chunk: string, userQuery?: string, chunkIndex?: number, totalChunks?: number) => Promise<string>
): Promise<string> {
  try {
    const fileContent = await parseFile(filePath);
    
    // Process the document in chunks with the user's query
    return processLargeText(fileContent, processChunkFn, {
      chunkSize: 3000, // Slightly smaller chunks when including query
      overlap: 300,    // Slightly larger overlap for better context
      userQuery
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    log.error(`Error processing document with query: ${errorMsg}`)
    throw new Error(`Failed to process document with query: ${filePath}. Error: ${errorMsg}`)
  }
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

// Main file parsing function
export async function parseFile(filePath: string): Promise<string> {
  const startTime = Date.now()
  
  try {
    log.debug(`[PARSER] Starting to parse file: ${filePath}`)
    
    let content: string
    
    if (isOfficeFilePath(filePath)) {
      content = await parseOfficeFile(filePath)
    } else if (isEpubFilePath(filePath)) {
      log.debug(`[PARSER] Parsing EPUB file: ${filePath}`)
      content = await parseEpub(filePath)
    } else if (isCsvPath(filePath)) {
      log.debug(`[PARSER] Parsing CSV file: ${filePath}`)
      content = await parseCsvFile(filePath)
    } else {
      // Default to text file parsing with encoding detection
      log.debug(`[PARSER] Parsing text file: ${filePath}`)
      const buffer = await fs.readFile(filePath)
      const detectedEncoding = chardet.detect(buffer) || 'utf-8'
      content = iconv.decode(buffer, detectedEncoding as BufferEncoding)
    }
    
    const processingTime = Date.now() - startTime
    log.debug(`[PARSER] Successfully parsed ${filePath} in ${processingTime}ms`)
    
    return content
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    log.error(`[PARSER] Error parsing file ${filePath}: ${errorMsg}`)
    
    // Try fallback to simple text reading if other methods fail
    try {
      log.warn(`[PARSER] Attempting fallback text reading for: ${filePath}`)
      const buffer = await fs.readFile(filePath)
      return buffer.toString('utf-8')
    } catch (fallbackError) {
      const fallbackErrorMsg = fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
      log.error(`[PARSER] Fallback reading failed for ${filePath}: ${fallbackErrorMsg}`)
      throw new Error(`Failed to parse file: ${filePath}. Error: ${errorMsg}`)
    }
  }
}

// Export the chunking functions and parseFile for use elsewhere
export { splitTextIntoChunks, processLargeText }
