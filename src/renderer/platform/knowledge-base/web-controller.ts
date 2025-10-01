import type { KnowledgeBaseController, KBUploadProgress } from './interface'
import type { FileMeta, KnowledgeBase, KnowledgeBaseFile, KnowledgeBaseSearchResult } from 'src/shared/types'
import { webKb } from './web-handlers'

export default class WebKnowledgeBaseController implements KnowledgeBaseController {
  // KB CRUD
  async list(): Promise<KnowledgeBase[]> {
    return webKb.list()
  }

  async create(createParams: { name: string; embeddingModel: string; rerankModel: string; visionModel?: string }): Promise<void> {
    await webKb.create(createParams)
  }

  async delete(id: number): Promise<void> {
    await webKb.delete(id)
  }

  // Files
  async listFiles(kbId: number): Promise<KnowledgeBaseFile[]> {
    return webKb.listFiles(kbId)
  }

  async countFiles(kbId: number): Promise<number> {
    return webKb.countFiles(kbId)
  }

  async listFilesPaginated(kbId: number, offset = 0, limit = 20): Promise<KnowledgeBaseFile[]> {
    return webKb.listFilesPaginated(kbId, offset, limit)
  }

  async uploadFile(kbId: number, file: FileMeta, onProgress?: (p: KBUploadProgress) => void): Promise<void> {
    await webKb.uploadFile(kbId, file, onProgress)
  }

  async deleteFile(fileId: number): Promise<void> {
    await webKb.deleteFile(fileId)
  }

  async retryFile(fileId: number): Promise<void> {
    await webKb.retryFile(fileId)
  }

  async pauseFile(fileId: number): Promise<void> {
    await webKb.pauseFile(fileId)
  }

  async resumeFile(fileId: number): Promise<void> {
    await webKb.resumeFile(fileId)
  }

  async search(kbId: number, query: string): Promise<KnowledgeBaseSearchResult[]> {
    return webKb.search(kbId, query)
  }

  async update(updateParams: { id: number; name?: string; rerankModel?: string; visionModel?: string }): Promise<void> {
    await webKb.update(updateParams)
  }

  async getFilesMeta(
    kbId: number,
    fileIds: number[],
  ): Promise<{
    id: number
    kbId: number
    filename: string
    mimeType: string
    fileSize: number
    chunkCount: number
    totalChunks: number
    status: string
    createdAt: number
  }[]> {
    return webKb.getFilesMeta(kbId, fileIds) as any
  }

  async readFileChunks(
    kbId: number,
    chunks: { fileId: number; chunkIndex: number }[],
  ): Promise<{ fileId: number; filename: string; chunkIndex: number; text: string }[]> {
    return webKb.readFileChunks(kbId, chunks)
  }
}
