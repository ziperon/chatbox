import type { FileMeta, KnowledgeBase, KnowledgeBaseFile, KnowledgeBaseSearchResult } from 'src/shared/types'
import type { KBUploadProgress } from './interface'
import { QdrantClient } from '@qdrant/js-client-rest'

// Config: allow overrides via window globals, fallback to localhost
const OLLAMA_BASE: string =
  (typeof window !== 'undefined' && (window as any).__OLLAMA_BASE__) || 'http://localhost:11434'
const QDRANT_BASE: string =
  (typeof window !== 'undefined' && (window as any).__QDRANT_BASE__) || 'http://localhost:6333'
const QDRANT_API_KEY: string | undefined =
  typeof window !== 'undefined' ? (window as any).__QDRANT_API_KEY__ : undefined
const client = new QdrantClient({ url: QDRANT_BASE, apiKey: QDRANT_API_KEY })


// Local storage keys
const LS_KB_LIST = 'kb_list'
const LS_KB_NEXT_ID = 'kb_next_id'
const LS_KB_FILES_PREFIX = 'kb_files_'
const LS_KB_NEXT_FILE_ID_PREFIX = 'kb_next_file_id_'

function loadJSON<T>(key: string, def: T): T {
  try {
    const v = localStorage.getItem(key)
    return v ? (JSON.parse(v) as T) : def
  } catch {
    return def
  }
}
function saveJSON<T>(key: string, v: T) {
  localStorage.setItem(key, JSON.stringify(v))
}

function collectionNameForKb(id: number) {
  return `kb_${id}_chunks`
}

async function ensureCollection(collection: string, vectorSize: number) {
  try {
    const info = await client.getCollection(collection)
    const existingSize = (info as any)?.result?.config?.params?.vectors?.size
    if (typeof existingSize === 'number' && existingSize !== vectorSize) {
      await client.deleteCollection(collection)
      await client.createCollection(collection, {
        vectors: { size: vectorSize, distance: 'Cosine' },
      })
    }
    return
  } catch {
    // create if not found
    await client.createCollection(collection, {
      vectors: { size: vectorSize, distance: 'Cosine' },
    })
  }
}

async function embedWithOllama(modelSpec: string, text: string): Promise<number[]> {
  let spec = modelSpec || 'nomic-embed-text:latest'
  if (!spec.includes(':')) spec = `ollama:${spec}`
  if (!spec.startsWith('ollama:')) {
    throw new Error('Unsupported embedding provider; expected embeddingModel for web to use Ollama')
  }
  const model = spec.split(':', 2)[1] || 'nomic-embed-text'
  const r = await fetch(`${OLLAMA_BASE}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt: text }),
  })
  if (!r.ok) {
    const t = await r.text().catch(() => '')
    throw new Error(`Ollama embeddings failed: ${r.status} ${t}`)
  }
  const j = await r.json()
  if (!j || !j.embedding || !Array.isArray(j.embedding)) throw new Error('Ollama embeddings: invalid response')
  return j.embedding as number[]
}

function chunkText(text: string, maxLen = 1200): string[] {
  const out: string[] = []
  let i = 0
  while (i < text.length) {
    out.push(text.slice(i, i + maxLen))
    i += maxLen
  }
  return out.length ? out : ['']
}

function makeUuid(): string {
  if (typeof crypto !== 'undefined' && typeof (crypto as any).randomUUID === 'function') {
    return (crypto as any).randomUUID()
  }
  // Fallback simple UUIDv4 generator
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

function base64ToUtf8(b64: string): string {
  try {
    const binStr = atob(b64)
    const len = binStr.length
    const bytes = new Uint8Array(len)
    for (let i = 0; i < len; i++) bytes[i] = binStr.charCodeAt(i)
    const dec = new TextDecoder('utf-8', { fatal: false })
    return dec.decode(bytes)
  } catch {
    // fallback
    return atob(b64)
  }
}

// --- Web-side parsers to mirror desktop capabilities (best-effort) ---
function base64ToBytes(b64: string): Uint8Array {
  const binStr = atob(b64)
  const len = binStr.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) bytes[i] = binStr.charCodeAt(i)
  return bytes
}

async function parsePdfBase64(b64: string): Promise<string> {
  // Dynamic import to avoid increasing initial bundle size
  const pdfjsLib: any = await import('pdfjs-dist/build/pdf')
  try {
    if (pdfjsLib?.GlobalWorkerOptions) {
      // Point workerSrc to CDN to avoid bundler worker setup
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js'
    }
  } catch {}

  const data = base64ToBytes(b64)
  const loadingTask = pdfjsLib.getDocument({ data })
  const pdf = await loadingTask.promise
  const numPages: number = pdf.numPages
  const pages: string[] = []
  for (let p = 1; p <= numPages; p++) {
    const page = await pdf.getPage(p)
    const content = await page.getTextContent()
    const strings: string[] = (content.items || []).map((it: any) => String((it && it.str) || ''))
    const text = strings.join(' ').replace(/\s+/g, ' ').trim()
    if (text) pages.push(text)
  }
  return pages.join('\n\n')
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#x([0-9A-Fa-f]+);/g, (_m, hex) => {
      try {
        return String.fromCharCode(parseInt(hex, 16))
      } catch {
        return _m
      }
    })
    .replace(/&#(\d+);/g, (_m, dec) => {
      try {
        return String.fromCharCode(parseInt(dec, 10))
      } catch {
        return _m
      }
    })
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

function htmlToText(html: string): string {
  const noScripts = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
  const noStyles = noScripts.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
  const withoutTags = noStyles.replace(/<[^>]*>/g, '')
  const decoded = decodeHtmlEntities(withoutTags)
  return decoded.replace(/[\r\t]+/g, ' ').replace(/\s+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
}

function detectDelimiter(headerLine: string): string {
  if (headerLine.includes('\t')) return '\t'
  if (headerLine.includes(';')) return ';'
  if (headerLine.includes('|')) return '|'
  return ','
}

// Basic CSV/TSV parser with quoted field support
function parseDelimitedText(text: string): string {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length === 0) return ''
  const delimiter = detectDelimiter(lines[0])
  const rows: string[][] = []

  // Regex to split CSV respecting quotes
  const splitter = new RegExp(
    `(?:^|${delimiter})(\"(?:[^\"]|\"\")*\"|[^${delimiter}\n\r]*)`,
    'g'
  )

  for (const line of lines) {
    const cells: string[] = []
    const matches = line.match(splitter)
    if (matches) {
      for (let m of matches) {
        // Remove leading delimiter
        if (m.startsWith(delimiter) || m.startsWith(',')) m = m.slice(1)
        // Unquote
        m = m.trim()
        if (m.startsWith('"') && m.endsWith('"')) {
          m = m.slice(1, -1).replace(/\"\"/g, '"')
        }
        cells.push(m)
      }
    } else {
      cells.push(line)
    }
    rows.push(cells)
  }

  if (rows.length === 0) return ''
  const headers = rows[0]
  const body = rows.slice(1)
  const linesOut: string[] = []
  linesOut.push(`Columns: ${headers.join(', ')}`)
  const maxRows = 1000
  for (let i = 0; i < Math.min(body.length, maxRows); i++) {
    const row = body[i]
    const pairs = headers.map((h, idx) => `${h}: ${row[idx] ?? ''}`)
    linesOut.push(pairs.join(', '))
  }
  if (body.length > maxRows) {
    linesOut.push(`... and ${body.length - maxRows} more rows not shown`)
  }
  return linesOut.join('\n')
}

function guessIsDelimitedMime(mime: string, filename: string): boolean {
  const name = filename.toLowerCase()
  return (
    mime === 'text/csv' ||
    mime === 'text/tab-separated-values' ||
    mime === 'application/csv' ||
    name.endsWith('.csv') ||
    name.endsWith('.tsv')
  )
}

function jsonPretty(text: string): string {
  try {
    const obj = JSON.parse(text)
    return JSON.stringify(obj, null, 2)
  } catch {
    return text
  }
}

async function ocrImageWithOllama(visionSpec: string | undefined, mimeType: string, base64: string): Promise<string> {
  if (!visionSpec) throw new Error('visionModel not set')
  let spec = visionSpec
  if (!spec.includes(':')) spec = `ollama:${spec}`
  if (!spec.startsWith('ollama:')) {
    throw new Error('Unsupported vision provider; expected visionModel to use Ollama')
  }
  const model = spec.split(':', 2)[1]
  // Ollama /api/generate supports images: [base64]
  const r = await fetch(`${OLLAMA_BASE}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt: 'OCR this image into Markdown. Tables should be formatted as HTML. Do not surround output with code fences.',
      images: [base64],
      stream: false,
    }),
  })
  if (!r.ok) {
    const t = await r.text().catch(() => '')
    throw new Error(`Ollama vision OCR failed: ${r.status} ${t}`)
  }
  const j = await r.json().catch(() => ({} as any))
  const out = (j && (j.response || j.text)) || ''
  return String(out || '').trim()
}

function loadKbList(): KnowledgeBase[] {
  return loadJSON<KnowledgeBase[]>(LS_KB_LIST, [])
}
function saveKbList(list: KnowledgeBase[]) {
  saveJSON(LS_KB_LIST, list)
}
function nextKbId(): number {
  const id = loadJSON<number>(LS_KB_NEXT_ID, 1)
  saveJSON(LS_KB_NEXT_ID, id + 1)
  return id
}
function filesKey(kbId: number) {
  return `${LS_KB_FILES_PREFIX}${kbId}`
}
function nextFileIdKey(kbId: number) {
  return `${LS_KB_NEXT_FILE_ID_PREFIX}${kbId}`
}
function loadKbFiles(kbId: number): KnowledgeBaseFile[] {
  return loadJSON<KnowledgeBaseFile[]>(filesKey(kbId), [])
}
function saveKbFiles(kbId: number, list: KnowledgeBaseFile[]) {
  saveJSON(filesKey(kbId), list)
}
function nextFileId(kbId: number): number {
  const key = nextFileIdKey(kbId)
  const id = loadJSON<number>(key, 1)
  saveJSON(key, id + 1)
  return id
}

// Public API mirroring Electron kb ipc handlers, but for web
export const webKb = {
  // KB CRUD
  async list(): Promise<KnowledgeBase[]> {
    return loadKbList()
  },
  async create(params: { name: string; embeddingModel: string; rerankModel: string; visionModel?: string }): Promise<{ id: number; name: string }> {
    if (!params.name?.trim()) throw new Error('Knowledge base name is required')
    if (!params.embeddingModel?.trim()) throw new Error('Embedding model is required')
    const list = loadKbList()
    const id = nextKbId()
    const now = Date.now()
    const kb: KnowledgeBase = {
      id,
      name: params.name.trim(),
      embeddingModel: params.embeddingModel || 'ollama:nomic-embed-text',
      rerankModel: params.rerankModel,
      visionModel: params.visionModel,
      createdAt: now,
    }
    list.push(kb)
    saveKbList(list)
    return { id, name: kb.name }
  },
  async update(params: { id: number; name?: string; rerankModel?: string; visionModel?: string }): Promise<number> {
    const list = loadKbList()
    const kb = list.find((k) => k.id === params.id)
    if (!kb) throw new Error('Invalid knowledge base ID')
    if (params.name !== undefined) {
      if (!params.name.trim()) throw new Error('Knowledge base name cannot be empty')
      kb.name = params.name.trim()
    }
    if (params.rerankModel !== undefined) kb.rerankModel = params.rerankModel
    if (params.visionModel !== undefined) kb.visionModel = params.visionModel
    saveKbList(list)
    return 1
  },
  async delete(kbId: number): Promise<{ success: boolean; error?: string }> {
    const list = loadKbList()
    const exists = list.some((k) => k.id === kbId)
    if (!exists) throw new Error(`Knowledge base ${kbId} not found`)
    saveKbList(list.filter((k) => k.id !== kbId))
    // clear metas, keep Qdrant data or optionally:
    saveKbFiles(kbId, [])
    return { success: true }
  },

  // Files
  async listFiles(kbId: number): Promise<KnowledgeBaseFile[]> {
    return loadKbFiles(kbId)
  },
  async countFiles(kbId: number): Promise<number> {
    return loadKbFiles(kbId).length
  },
  async listFilesPaginated(kbId: number, offset = 0, limit = 20): Promise<KnowledgeBaseFile[]> {
    const all = loadKbFiles(kbId)
    return all.slice(offset, offset + limit)
  },
  async getFilesMeta(kbId: number, fileIds: number[]) {
    if (!fileIds?.length) return []
    const all = loadKbFiles(kbId)
    const set = new Set(fileIds)
    return all
      .filter((f) => set.has(f.id))
      .map((f) => ({
        id: f.id,
        kbId: f.kb_id,
        filename: f.filename,
        mimeType: f.mime_type,
        fileSize: f.file_size,
        chunkCount: f.chunk_count,
        totalChunks: f.total_chunks,
        status: f.status,
        createdAt: f.createdAt,
      }))
  },
  async readFileChunks(
    kbId: number,
    chunks: { fileId: number; chunkIndex: number }[],
  ): Promise<{ fileId: number; filename: string; chunkIndex: number; text: string }[]> {
    const out: { fileId: number; filename: string; chunkIndex: number; text: string }[] = []

    if (!chunks || chunks.length === 0) return out

    // 1) Try exact per-index fetch first (fast path)
    // debug
    try { console.debug('[KB] readFileChunks request', { kbId, chunks }) } catch {}
    for (const c of chunks) {
      try {
        const res = await client.scroll(collectionNameForKb(kbId), {
          with_payload: true,
          with_vector: false,
          limit: 1,
          filter: {
            must: [
              { key: 'kbId', match: { value: kbId } },
              { key: 'fileId', match: { value: c.fileId } },
              { key: 'chunkIndex', match: { value: c.chunkIndex } },
            ],
          },
        })
        const pointsArr = (res as any)?.result?.points || (res as any)?.points || []
        const item = pointsArr?.[0]
        if (item?.payload) {
          out.push({
            fileId: item.payload.fileId,
            filename: item.payload.filename,
            chunkIndex: item.payload.chunkIndex,
            text: item.payload.text || '',
          })
        }
      } catch {}
    }

    // If we already found some, return them
    if (out.length > 0) { try { console.debug('[KB] readFileChunks exact-hit', out.length) } catch {} ; return out }

    // 2) Group requested indices by fileId
    const byFile: Map<number, number[]> = new Map()
    for (const c of chunks) {
      const arr = byFile.get(c.fileId) || []
      arr.push(c.chunkIndex)
      byFile.set(c.fileId, arr)
    }

    for (const [fileId, indices] of byFile.entries()) {
      const indexSet = new Set(indices)
      // 2a) Targeted combined fetch using 'should' over chunkIndex values
      try {
        const shouldConds = indices.map((idx) => ({ key: 'chunkIndex', match: { value: idx } }))
        const res1 = await client.scroll(collectionNameForKb(kbId), {
          with_payload: true,
          with_vector: false,
          limit: Math.max(indices.length, 10),
          filter: {
            must: [
              { key: 'kbId', match: { value: kbId } },
              { key: 'fileId', match: { value: fileId } },
            ],
            should: shouldConds,
          } as any,
        })
        const items1 = (res1 as any)?.result?.points || (res1 as any)?.points || []
        for (const it of items1) {
          const p = it?.payload
          if (p && indexSet.has(p.chunkIndex)) {
            out.push({ fileId: p.fileId, filename: p.filename, chunkIndex: p.chunkIndex, text: p.text || '' })
          }
        }
        if (out.length > 0) continue
      } catch {}

      // 2b) Fallback broader page and filter client-side
      try {
        const res2 = await client.scroll(collectionNameForKb(kbId), {
          with_payload: true,
          with_vector: false,
          // Fetch a reasonable page; UI only shows first few chunks
          limit: Math.max(20, indices.length * 5),
          filter: {
            must: [
              { key: 'kbId', match: { value: kbId } },
              { key: 'fileId', match: { value: fileId } },
            ],
          },
        })
        const items2 = (res2 as any)?.result?.points || (res2 as any)?.points || []
        for (const it of items2) {
          const p = it?.payload
          if (p && indexSet.has(p.chunkIndex)) {
            out.push({ fileId: p.fileId, filename: p.filename, chunkIndex: p.chunkIndex, text: p.text || '' })
          }
        }
      } catch {}
    }

    if (out.length > 0) { try { console.debug('[KB] readFileChunks group-hit', out.length) } catch {} ; return out }

    // 3) Final fallback: return first few chunks for each file to ensure preview shows something
    for (const [fileId, indices] of byFile.entries()) {
      try {
        const res3 = await client.scroll(collectionNameForKb(kbId), {
          with_payload: true,
          with_vector: false,
          limit: Math.max(5, indices.length),
          filter: {
            must: [
              { key: 'kbId', match: { value: kbId } },
              { key: 'fileId', match: { value: fileId } },
            ],
          },
        })
        const items3 = (res3 as any)?.result?.points || (res3 as any)?.points || []
        for (const it of items3) {
          const p = it?.payload
          if (!p) continue
          out.push({ fileId: p.fileId, filename: p.filename, chunkIndex: p.chunkIndex, text: p.text || '' })
        }
      } catch {}
    }
    try { console.debug('[KB] readFileChunks fallback-hit', out.length) } catch {}
    return out
  },
  async uploadFile(
    kbId: number,
    file: FileMeta,
    onProgress?: (p: KBUploadProgress) => void,
  ): Promise<void> {
    const kb = loadKbList().find((k) => k.id === kbId)
    if (!kb) throw new Error('KB not found')
    const filename = file.name
    const mimeType = (file as any).type || 'application/octet-stream'
    const fileSize = (file as any).size || 0
    const contentBase64 = (file as any).contentBase64 as string | undefined
    if (!filename) throw new Error('filename is required')
    const isImage = mimeType.startsWith('image/')
    const isPdf = mimeType === 'application/pdf' || filename.toLowerCase().endsWith('.pdf')
    const isHtml = mimeType === 'text/html' || filename.toLowerCase().endsWith('.html') || filename.toLowerCase().endsWith('.htm')
    const isMd = mimeType === 'text/markdown' || filename.toLowerCase().endsWith('.md')
    const isJson = mimeType === 'application/json' || filename.toLowerCase().endsWith('.json')
    const isDelimited = guessIsDelimitedMime(mimeType, filename)
    const isPlainText = mimeType.startsWith('text/') || isMd || isHtml || isJson || isDelimited
    if (!isPlainText && !isImage && !isPdf) throw new Error(`Unsupported mimeType for web extraction: ${mimeType}`)
    if (!contentBase64) throw new Error('contentBase64 is required for upload in web mode')

    const now = Date.now()
    const fileId = nextFileId(kbId)
    let textContent = ''
    if (isImage) {
      // OCR via Ollama vision
      textContent = await ocrImageWithOllama(
        loadKbList().find((k) => k.id === kbId)?.visionModel,
        mimeType,
        contentBase64,
      )
    } else if (isPdf) {
      textContent = await parsePdfBase64(contentBase64)
    } else if (isJson) {
      textContent = jsonPretty(base64ToUtf8(contentBase64))
    } else if (isHtml) {
      textContent = htmlToText(base64ToUtf8(contentBase64))
    } else if (isDelimited) {
      textContent = parseDelimitedText(base64ToUtf8(contentBase64))
    } else {
      textContent = base64ToUtf8(contentBase64)
    }
    const chunks = chunkText(textContent)

    // initialize meta as processing
    const all0 = loadKbFiles(kbId)
    const meta0: KnowledgeBaseFile = {
      id: fileId,
      kb_id: kbId,
      filename,
      filepath: '',
      mime_type: mimeType,
      file_size: fileSize,
      chunk_count: 0,
      total_chunks: chunks.length,
      status: 'processing',
      error: '',
      createdAt: now,
    }
    all0.push(meta0)
    saveKbFiles(kbId, all0)
    onProgress?.({ phase: 'start', currentChunk: 0, totalChunks: chunks.length, message: 'Starting upload' })

    // ensure collection
    try {
      const testVector = await embedWithOllama(kb.embeddingModel, chunks[0] || '')
      await ensureCollection(collectionNameForKb(kbId), testVector.length)
      onProgress?.({ phase: 'ensureCollection', currentChunk: 0, totalChunks: chunks.length, message: 'Collection ready' })
    } catch (e: any) {
      // mark failed and rethrow
      const allErr = loadKbFiles(kbId)
      const i = allErr.findIndex((f) => f.id === fileId)
      if (i !== -1) {
        allErr[i].status = 'failed'
        allErr[i].error = e?.message || String(e)
        saveKbFiles(kbId, allErr)
      }
      onProgress?.({ phase: 'error', currentChunk: 0, totalChunks: chunks.length, message: e?.message || 'Failed to ensure collection' })
      throw e
    }

    try {
      const BATCH_SIZE: number =
        (typeof window !== 'undefined' && Number((window as any).__KB_EMBED_BATCH__)) || 32
      let totalEmbedded = 0
      let totalUpserted = 0
      let batchPoints: any[] = []

      for (let idx = 0; idx < chunks.length; idx++) {
        const text = chunks[idx]
        const vector = await embedWithOllama(kb.embeddingModel, text)
        batchPoints.push({
          id: makeUuid(),
          vector,
          payload: {
            kbId,
            fileId,
            filename,
            chunkIndex: idx,
            text,
            createdAt: now,
            mimeType,
            fileSize,
            status: 'done',
          },
        })

        totalEmbedded++
        // update meta chunk_count after each embedded chunk
        const all = loadKbFiles(kbId)
        const i = all.findIndex((f) => f.id === fileId)
        if (i !== -1) {
          all[i].chunk_count = totalEmbedded
          saveKbFiles(kbId, all)
        }
        onProgress?.({
          phase: 'embedding',
          currentChunk: totalEmbedded,
          totalChunks: chunks.length,
          message: `Embedding ${totalEmbedded}/${chunks.length}`,
        })

        const isBatchFull = batchPoints.length >= BATCH_SIZE
        const isLast = idx === chunks.length - 1
        if (isBatchFull || isLast) {
          onProgress?.({
            phase: 'upsert',
            currentChunk: totalUpserted + batchPoints.length,
            totalChunks: chunks.length,
            message: `Upserting batch (${totalUpserted + 1}..${totalUpserted + batchPoints.length})`,
          })
          await client.upsert(collectionNameForKb(kbId), { points: batchPoints })
          totalUpserted += batchPoints.length
          batchPoints = []
        }
      }

      // finalize meta
      const all = loadKbFiles(kbId)
      const i = all.findIndex((f) => f.id === fileId)
      if (i !== -1) {
        all[i].status = 'done'
        all[i].total_chunks = chunks.length
        all[i].chunk_count = chunks.length
        saveKbFiles(kbId, all)
      }
      onProgress?.({ phase: 'done', currentChunk: chunks.length, totalChunks: chunks.length, message: 'Completed' })
    } catch (e: any) {
      const all = loadKbFiles(kbId)
      const i = all.findIndex((f) => f.id === fileId)
      if (i !== -1) {
        all[i].status = 'failed'
        all[i].error = e?.message || String(e)
        saveKbFiles(kbId, all)
      }
      onProgress?.({ phase: 'error', currentChunk: 0, totalChunks: chunks.length, message: e?.message || 'Upload failed' })
      throw e
    }
  },
  async deleteFile(fileId: number): Promise<{ success: boolean }> {
    // meta only; qdrant cleanup could be added
    const allKbs = loadKbList()
    for (const kb of allKbs) {
      const files = loadKbFiles(kb.id)
      const idx = files.findIndex((f) => f.id === fileId)
      if (idx !== -1) {
        files.splice(idx, 1)
        saveKbFiles(kb.id, files)
        break
      }
    }
    return { success: true }
  },
  async retryFile(_fileId: number) {},
  async pauseFile(_fileId: number) {},
  async resumeFile(_fileId: number) {},

  async search(kbId: number, query: string): Promise<KnowledgeBaseSearchResult[]> {
    const kb = loadKbList().find((k) => k.id === kbId)
    if (!kb) throw new Error('KB not found')
    if (!query) return []
    const vector = await embedWithOllama(kb.embeddingModel, query)
    await ensureCollection(collectionNameForKb(kbId), vector.length)
    const res = await client.search(collectionNameForKb(kbId), {
      vector,
      limit: 20,
      with_payload: true,
      with_vector: false,
      filter: { must: [{ key: 'kbId', match: { value: kbId } }] },
    })
    const arr = ((res as any)?.result || (res as any) || []) as any[]
    return arr.map((p: any, idx: number) => ({
      id: idx,
      score: p.score,
      text: p.payload?.text || '',
      fileId: p.payload?.fileId,
      filename: p.payload?.filename,
      mimeType: p.payload?.mimeType,
      chunkIndex: p.payload?.chunkIndex ?? 0,
    }))
  },
}

export type { KnowledgeBase, KnowledgeBaseFile }

// Utility: list all Qdrant collections
export async function listCollections(): Promise<string[]> {
  const res = await client.getCollections()
  const arr = (res as any)?.result?.collections || []
  return arr.map((c: any) => c?.name).filter((n: any) => typeof n === 'string')
}
