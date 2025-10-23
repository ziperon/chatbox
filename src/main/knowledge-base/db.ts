import fs from 'node:fs'
import path from 'node:path'
import type { Client } from '@libsql/client'
import { LibSQLVector } from '@mastra/core/vector/libsql'
import { app } from 'electron'
import { sentry } from '../adapters/sentry'
import { getLogger } from '../util'

const log = getLogger('knowledge-base:db')

// Database file path
let dbPath: string
let dbDir: string

// Initialize database paths with proper error handling
function initializeDatabasePaths() {
  try {
    dbPath = path.normalize(path.join(app.getPath('userData'), 'databases', 'chatbox_kb.db'))
    dbDir = path.dirname(dbPath)
    
    // Ensure database directory exists
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true, mode: 0o755 })
    }
    
    log.info(`[DB] Database path: ${dbPath}`)
  } catch (error) {
    log.error('[DB] Failed to initialize database paths:', error)
    throw error
  }
}

// Initialize paths immediately
initializeDatabasePaths()

// Polyfill for mastra
if (typeof global.crypto === 'undefined' || !('subtle' in global.crypto)) {
  global.crypto = require('node:crypto')
}

let db: Client
let vectorStore: LibSQLVector

async function initDB(db: Client) {
  try {
    await db.batch([
      `CREATE TABLE IF NOT EXISTS knowledge_base (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        embedding_model TEXT NOT NULL,
        rerank_model TEXT,
        vision_model TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS kb_file (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        kb_id INTEGER NOT NULL,
        filename TEXT NOT NULL,
        filepath TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        file_size INTEGER DEFAULT 0,
        chunk_count INTEGER DEFAULT 0,
        total_chunks INTEGER DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'pending',
        error TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        processing_started_at DATETIME,
        FOREIGN KEY (kb_id) REFERENCES knowledge_base(id)
      )`,
    ])
    // Add total_chunks column if it doesn't exist (for existing databases)
    await db.batch([`ALTER TABLE kb_file ADD COLUMN total_chunks INTEGER DEFAULT 0`]).catch((error) => {
      if (error instanceof Error && !error.message.includes('duplicate column name')) {
        log.error('[DB] Failed to add total_chunks column', error)
      } else {
        // Ignore error if column already exists
        log.info('[DB] Database initialized (total_chunks column already exists)')
      }
    })

    log.info('[DB] Database initialized')
  } catch (error) {
    log.error('[DB] Failed to initialize database:', error)

    sentry.withScope((scope) => {
      scope.setTag('component', 'knowledge-base-db')
      scope.setTag('operation', 'database_initialization')
      scope.setExtra('dbPath', dbPath)
      sentry.captureException(error)
    })
    throw error
  }
}

export async function initializeDatabase() {
  try {
    log.info('[DB] Initializing database...')
    
    // Ensure paths are initialized
    if (!dbPath || !dbDir) {
      initializeDatabasePaths()
    }
    
    // Close any existing connections
    if (db) {
      try {
        await db.close()
      } catch (e) {
        log.warn('[DB] Error closing existing database connection:', e)
      }
    }
    
    // Initialize vector store with retry logic
    let retries = 3
    let lastError: Error | null = null
    
    while (retries > 0) {
      try {
        vectorStore = new LibSQLVector({
          connectionUrl: `file:${dbPath}`,
          // Add additional connection options for better Windows compatibility
          syncUrl: undefined,
          authToken: undefined,
          syncInterval: 0
        })
        
        // Get the underlying turso client
        // biome-ignore lint/suspicious/noExplicitAny: access internal property
        db = (vectorStore as any).turso
        
        // Test the connection
        await db.execute('SELECT 1')
        
        // Initialize database schema
        await initDB(db)
        
        // Clean up any processing files left from previous session
        await cleanupProcessingFiles()
        
        log.info('[DB] Database initialized successfully')
        return
      } catch (error) {
        lastError = error as Error
        log.warn(`[DB] Database initialization attempt ${4 - retries} failed:`, error)
        retries--
        
        // Wait before retry
        if (retries > 0) {
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      }
    }
    
    // If we get here, all retries failed
    throw lastError || new Error('Failed to initialize database after multiple attempts')
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    log.error('[DB] Critical error initializing database:', error)
    
    sentry.withScope((scope) => {
      scope.setTag('component', 'knowledge-base-db')
      scope.setTag('operation', 'vector_store_initialization')
      scope.setExtra('dbPath', dbPath)
      scope.setExtra('error', errorMessage)
      sentry.captureException(error)
    })
    
    throw new Error(`Failed to initialize database: ${errorMessage}`)
  }
}

let isInitializing = false

export async function ensureDatabaseInitialized() {
  if (!db || !vectorStore) {
    if (isInitializing) {
      // If we're already initializing, wait a bit and check again
      await new Promise(resolve => setTimeout(resolve, 500))
      if (db && vectorStore) return { db, vectorStore }
      throw new Error('Database initialization is taking longer than expected')
    }
    
    try {
      isInitializing = true
      await initializeDatabase()
      return { db: db!, vectorStore: vectorStore! }
    } finally {
      isInitializing = false
    }
  }
  return { db, vectorStore }
}

export function getDatabase(): Client {
  if (!db) {
    log.warn('[DB] Database not initialized, attempting to initialize synchronously')
    // Try to initialize synchronously (not recommended, but maintains backward compatibility)
    require('deasync')((done: () => void) => {
      ensureDatabaseInitialized()
        .then(() => done())
        .catch(() => done())
    })
    
    if (!db) {
      const error = new Error('Database not available')
      log.error('[DB] Database not available')
      sentry.withScope((scope) => {
        scope.setTag('component', 'knowledge-base-db')
        scope.setTag('operation', 'database_access')
        sentry.captureException(error)
      })
      throw error
    }
  }
  return db
}

export function getVectorStore(): LibSQLVector {
  if (!vectorStore) {
    log.warn('[DB] Vector store not initialized, attempting to initialize synchronously')
    // Try to initialize synchronously (not recommended, but maintains backward compatibility)
    require('deasync')((done: () => void) => {
      ensureDatabaseInitialized()
        .then(() => done())
        .catch(() => done())
    })
    
    if (!vectorStore) {
      const error = new Error('Vector store not available')
      log.error('[DB] Vector store not available')
      sentry.withScope((scope) => {
        scope.setTag('component', 'knowledge-base-db')
        scope.setTag('operation', 'vector_store_access')
        sentry.captureException(error)
      })
      throw error
    }
  }
  return vectorStore
}

// Helper function to parse SQLite timestamp correctly
export function parseSQLiteTimestamp(sqliteTimestamp: string): number {
  try {
    // SQLite CURRENT_TIMESTAMP returns UTC time in format: 'YYYY-MM-DD HH:MM:SS'
    // We need to explicitly tell JavaScript this is UTC time
    const utcDate = new Date(`${sqliteTimestamp} UTC`)
    const timestamp = utcDate.getTime()

    if (Number.isNaN(timestamp)) {
      throw new Error(`Invalid timestamp format: ${sqliteTimestamp}`)
    }

    return timestamp
  } catch (error) {
    log.error(`[DB] Failed to parse SQLite timestamp: ${sqliteTimestamp}`, error)
    sentry.withScope((scope) => {
      scope.setTag('component', 'knowledge-base-db')
      scope.setTag('operation', 'timestamp_parsing')
      scope.setExtra('sqliteTimestamp', sqliteTimestamp)
      sentry.captureException(error)
    })
    // Return current timestamp as fallback
    return Date.now()
  }
}

// Transaction wrapper - ensures atomicity of database operations
export async function withTransaction<T>(operation: () => Promise<T>): Promise<T> {
  const db = getDatabase()
  const transactionId = Math.random().toString(36).slice(2, 10)

  try {
    try {
      // Start transaction
      await db.execute('BEGIN TRANSACTION')
      
      try {
        // Execute the operation
        const result = await operation()
        
        // Commit the transaction
        await db.execute('COMMIT')
        return result
      } catch (operationError) {
        // Rollback on operation error
        try {
          await db.execute('ROLLBACK')
        } catch (rollbackError) {
          log.error(`[DB] Error rolling back transaction (attempt ${attempt}):`, rollbackError)
          sentry.withScope((scope) => {
            scope.setTag('component', 'knowledge-base-db')
            scope.setTag('operation', 'transaction_rollback')
            scope.setTag('attempt', attempt.toString())
            sentry.captureException(rollbackError)
          })
        }
        
        // If this is a connection error or session error, we'll retry
        const errorMessage = operationError instanceof Error ? operationError.message : String(operationError)
        if (errorMessage.includes('session') || errorMessage.includes('connection')) {
          lastError = operationError as Error
          log.warn(`[DB] Session/connection error in transaction (attempt ${attempt}/${maxRetries}):`, operationError)
          
          // Wait before retry
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 500 * attempt))
            continue
          }
        }
        
        // For other errors or if we've exhausted retries, rethrow
        throw operationError

// Cleanup processing files that may have been left from previous session
async function cleanupProcessingFiles() {
  try {
    log.debug('[DB] Cleaning up processing files from previous session...')
    const result = await db.execute({
      sql: 'UPDATE kb_file SET status = ?, processing_started_at = NULL WHERE status = ?',
      args: ['paused', 'processing'],
    })
    const affectedRows = result.rowsAffected || 0
    if (affectedRows > 0) {
      log.debug(`[DB] Set ${affectedRows} interrupted processing files to paused status (manual resume required)`)
    }
  } catch (err) {
    log.error('[DB] Failed to cleanup processing files:', err)
    sentry.withScope((scope) => {
      scope.setTag('component', 'knowledge-base-db')
      scope.setTag('operation', 'cleanup_processing_files')
      sentry.captureException(err)
    })
  }
}

// Check for timed out processing files and mark them as failed
export async function checkProcessingTimeouts() {
  try {
    // Files processing for more than 5 minutes should be marked as failed
    const timeoutMinutes = 5
    const timeoutThreshold = new Date(Date.now() - timeoutMinutes * 60 * 1000).toISOString()

    const db = getDatabase()

    // Find processing files that started before the timeout threshold
    const rs = await db.execute({
      sql: `SELECT id, filename FROM kb_file 
            WHERE status = 'processing' 
            AND processing_started_at IS NOT NULL
            AND datetime(processing_started_at) < datetime(?)`,
      args: [timeoutThreshold],
    })

    if (rs.rows.length > 0) {
      log.debug(`[DB] Found ${rs.rows.length} timed out processing files`)

      // Mark them as failed
      for (const file of rs.rows) {
        await db.execute({
          sql: 'UPDATE kb_file SET status = ?, error = ?, processing_started_at = NULL WHERE id = ?',
          args: ['failed', `Processing timeout after ${timeoutMinutes} minutes`, file.id],
        })
        log.debug(`[DB] Marked file as failed due to timeout: ${file.filename} (id=${file.id})`)
      }
    }
  } catch (err) {
    log.error('[DB] Failed to check processing timeouts:', err)
  }
}
