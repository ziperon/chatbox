/* Simple local API server for web KB. Replace in-memory stubs with real Qdrant integration. */
const express = require('express')
const cors = require('cors')
const { QdrantClient } = require('@qdrant/js-client-rest')

// Qdrant client
const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333'
const client = new QdrantClient({ url: QDRANT_URL })
const vectorSize = 1536 // default for text-embedding-3-small
const distance = 'Cosine'
function collectionNameForKb(id) {
  return `kb_${id}_chunks`
}

const app = express()
app.use(cors())
app.use(express.json({ limit: '10mb' }))

// In-memory state for demo purposes
let kbSeq = 1
let fileSeq = 1
const knowledgeBases = [] // { id, name, embeddingModel, rerankModel, visionModel }
const files = [] // { id, kbId, filename, mimeType, fileSize, status, chunkCount, totalChunks, createdAt, chunks: string[] }

// Helpers
const ok = (res, data) => res.json(data)
const notFound = (res, msg = 'Not found') => res.status(404).json({ error: msg })

// KB routes
app.get('/api/kb', (_req, res) => ok(res, knowledgeBases))

app.post('/api/kb', (req, res) => {
  console.log('[KB CREATE] body =', req.body)
  const { name, embeddingModel, rerankModel, visionModel } = req.body || {}
  if (!name) return res.status(400).json({ error: 'name is required' })
  // Provide sensible defaults if UI didn't send models
  const emb = embeddingModel || 'text-embedding-3-small'
  const rerank = rerankModel || 'cohere/rerank-english-v3.0'
  const kb = { id: kbSeq++, name: String(name), embeddingModel: emb, rerankModel: rerank, visionModel }
  knowledgeBases.push(kb)
  // Create Qdrant collection for this KB
  const coll = collectionNameForKb(kb.id+kb.name)
  client
    .createCollection(coll, {
      vectors: { size: vectorSize, distance },
      optimizers_config: { default_segment_number: 1 },
    })
    .then(() => {
      console.log(`[KB API] Qdrant collection created: ${coll}`)
      return ok(res, { id: kb.id, name: kb.name })
    })
    .catch((err) => {
      console.error(`[KB API] Failed to create Qdrant collection ${coll}:`, err)
      // Still return KB created; client can retry collection creation later
      return ok(res, { id: kb.id, name: kb.name, warning: 'qdrant_collection_create_failed' })
    })
})

app.patch('/api/kb/:id', (req, res) => {
  const id = Number(req.params.id)
  const kb = knowledgeBases.find((k) => k.id === id)
  if (!kb) return notFound(res, 'KB not found')
  const { name, rerankModel, visionModel } = req.body || {}
  if (name !== undefined) kb.name = name
  if (rerankModel !== undefined) kb.rerankModel = rerankModel
  if (visionModel !== undefined) kb.visionModel = visionModel
  return ok(res, { success: true })
})

app.delete('/api/kb/:id', (req, res) => {
  const id = Number(req.params.id)
  const idx = knowledgeBases.findIndex((k) => k.id === id)
  if (idx === -1) return notFound(res, 'KB not found')
  knowledgeBases.splice(idx, 1)
  for (let i = files.length - 1; i >= 0; i--) if (files[i].kbId === id) files.splice(i, 1)
  const coll = collectionNameForKb(id)
  client
    .deleteCollection(coll)
    .then(() => {
      console.log(`[KB API] Qdrant collection deleted: ${coll}`)
      return ok(res, { success: true })
    })
    .catch((err) => {
      console.error(`[KB API] Failed to delete Qdrant collection ${coll}:`, err)
      return ok(res, { success: true, warning: 'qdrant_collection_delete_failed' })
    })
})

// Files
app.get('/api/kb/:id/files', (req, res) => {
    console.log('[UPLOAD] body=', req.body)

  const kbId = Number(req.params.id)
  return ok(res, files.filter((f) => f.kbId === kbId))
})

app.get('/api/kb/:id/files/count', (req, res) => {
  const kbId = Number(req.params.id)
  return ok(res, files.filter((f) => f.kbId === kbId).length)
})

app.get('/api/kb/:id/files/paginated', (req, res) => {
  const kbId = Number(req.params.id)
  const offset = Number(req.query.offset || 0)
  const limit = Number(req.query.limit || 20)
  const all = files.filter((f) => f.kbId === kbId)
  return ok(res, all.slice(offset, offset + limit))
})
app.post('/api/kb/:id/files', (req, res) => {
  const kbId = Number(req.params.id)
  const body = req.body || {}
  const filename = body.filename || body.name
  const mimeType = body.mimeType || body.type || 'application/octet-stream'
  const fileSize = body.fileSize || body.size || 0
  const contentBase64 = body.contentBase64 // optional
  if (!filename) return res.status(400).json({ error: 'filename is required' })

  // find KB to resolve embedding provider/model
  const kb = knowledgeBases.find((k) => k.id === kbId)
  if (!kb) return notFound(res, 'KB not found')

  const now = Date.now()
  const fileId = fileSeq++

  // Helper: chunking
  function chunkText(text, maxLen = 1200) {
    const chunks = []
    let i = 0
    while (i < text.length) {
      chunks.push(text.slice(i, i + maxLen))
      i += maxLen
    }
    return chunks.length > 0 ? chunks : ['']
  }

  async function embedText(modelSpec, text) {
    // modelSpec example: 'ollama:nomic-embed-text' or 'openai:text-embedding-3-small'
    if (modelSpec && modelSpec.startsWith('ollama:')) {
      const model = modelSpec.split(':', 2)[1] || 'nomic-embed-text'
      const base = process.env.OLLAMA_BASE_URL || 'http://localhost:11434'
      const r = await fetch(`${base}/api/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, prompt: text }),
      })
      if (!r.ok) throw new Error(`Ollama embeddings failed: ${r.status}`)
      const j = await r.json()
      if (!j || !j.embedding) throw new Error('Ollama embeddings: invalid response')
      return j.embedding
    }
    throw new Error('Unsupported embedding provider; expected embeddingModel to start with "ollama:"')
  }

  async function upsertChunksToQdrant(kbId, fileId, filename, chunks) {
    const coll = collectionNameForKb(kbId)
    // Build points with embeddings
    const points = []
    for (let idx = 0; idx < chunks.length; idx++) {
      const text = chunks[idx]
      const vector = await embedText(kb.embeddingModel, text)
      points.push({
        id: Number(`${fileId}${idx.toString().padStart(4, '0')}`),
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
    }
    await client.upsert(collectionNameForKb(kbId), { wait: true, points })
  }

  async function handleUpload() {
    // extract text (only text/* and markdown/csv/json for now)
    let textContent = ''
    if (contentBase64) {
      const buf = Buffer.from(contentBase64, 'base64')
      const isTextLike = mimeType.startsWith('text/') || mimeType === 'application/json' || mimeType === 'text/markdown' || mimeType === 'text/csv'
      if (!isTextLike) {
        // For non-text types not handled yet
        return { ok: false, code: 415, msg: `Unsupported mimeType for text extraction: ${mimeType}` }
      }
      textContent = buf.toString('utf-8')
    } else {
      // No content provided: store as empty single chunk (backward compatibility)
      textContent = ''
    }

    const chunks = chunkText(textContent)
    // upsert to Qdrant with embeddings (if text present)
    if (textContent.length > 0) {
      await upsertChunksToQdrant(kbId, fileId, filename, chunks)
    }

    // Maintain in-memory file meta for UI
    const file = {
      id: fileId,
      kbId,
      filename,
      mimeType,
      fileSize,
      status: 'done',
      chunkCount: chunks.length,
      totalChunks: chunks.length,
      createdAt: now,
      chunks, // only for demo; in production read from Qdrant when needed
    }
    files.push(file)
    return { ok: true, fileId }
  }

  handleUpload()
    .then((r) => {
      if (!r.ok) return res.status(r.code || 400).json({ error: r.msg || 'upload_failed' })
      return ok(res, { id: r.fileId })
    })
    .catch((e) => {
      console.error('[KB API] upload failed:', e)
      return res.status(500).json({ error: 'internal_error' })
    })
})

app.delete('/api/files/:fileId', (req, res) => {
  const fileId = Number(req.params.fileId)
  const idx = files.findIndex((f) => f.id === fileId)
  if (idx === -1) return notFound(res, 'File not found')
  files.splice(idx, 1)
  return ok(res, { success: true })
})

app.post('/api/files/:fileId/retry', (req, res) => {
  const fileId = Number(req.params.fileId)
  const f = files.find((x) => x.id === fileId)
  if (!f) return notFound(res, 'File not found')
  f.status = 'processing'
  return ok(res, { success: true })
})

app.post('/api/files/:fileId/resume', (req, res) => {
  const fileId = Number(req.params.fileId)
  const f = files.find((x) => x.id === fileId)
  if (!f) return notFound(res, 'File not found')
  f.status = 'processing'
  return ok(res, { success: true })
})

// Search using Qdrant vector search with KB's embedding provider
app.post('/api/kb/:id/search', async (req, res) => {
  try {
    const kbId = Number(req.params.id)
    const { query } = req.body || {}
    if (!query) return res.status(400).json({ error: 'query is required' })
    const kb = knowledgeBases.find((k) => k.id === kbId)
    if (!kb) return notFound(res, 'KB not found')

    const vector = await (async () => embedText(kb.embeddingModel, query))()
    const search = await client.search(collectionNameForKb(kbId), {
      vector,
      limit: 20,
      with_payload: true,
      with_vector: false,
      filter: { must: [{ key: 'kbId', match: { value: kbId } }] },
    })
    const out = (search || []).map((p) => ({
      score: p.score,
      text: p.payload?.text || '',
      fileId: p.payload?.fileId,
      filename: p.payload?.filename,
      chunkIndex: p.payload?.chunkIndex ?? 0,
    }))
    return ok(res, out)
  } catch (e) {
    console.error('[KB API] search failed:', e)
    return res.status(500).json({ error: 'internal_error' })
  }
})

app.post('/api/kb/:id/files/meta', (req, res) => {
  const kbId = Number(req.params.id)
  const { fileIds } = req.body || {}
  const set = new Set((fileIds || []).map(Number))
  const metas = files
    .filter((f) => f.kbId === kbId && set.has(f.id))
    .map((f) => ({
      id: f.id,
      kbId: f.kbId,
      filename: f.filename,
      mimeType: f.mimeType,
      fileSize: f.fileSize,
      chunkCount: f.chunkCount,
      totalChunks: f.totalChunks,
      status: f.status,
      createdAt: f.createdAt,
    }))
  return ok(res, metas)
})

app.post('/api/kb/:id/files/read-chunks', (req, res) => {
  const kbId = Number(req.params.id)
  const { chunks } = req.body || { chunks: [] }
  const out = []
  for (const { fileId, chunkIndex } of chunks || []) {
    const f = files.find((x) => x.kbId === kbId && x.id === Number(fileId))
    if (!f) continue
    const text = f.chunks[chunkIndex] || ''
    out.push({ fileId: f.id, filename: f.filename, chunkIndex, text })
  }
  return ok(res, out)
})

const PORT = Number(process.env.KB_SERVER_PORT || 8787)
app.listen(PORT, () => {
  console.log(`[KB API] listening on http://localhost:${PORT}`)
})
