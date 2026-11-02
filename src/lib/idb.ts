/**
 * 极简 IndexedDB 封装。学习记录优先写入 IndexedDB，
 * 浏览器不支持或被禁用时自动退回 localStorage（由 storage.ts 处理）。
 */

const DB_NAME = 'echo-politics'
const DB_VERSION = 1
const STORE = 'state'

let dbPromise: Promise<IDBDatabase | null> | null = null

function openDatabase(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null)
      return
    }
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION)
      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => resolve(null)
      request.onblocked = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
  return dbPromise
}

export async function idbAvailable(): Promise<boolean> {
  return Boolean(await openDatabase())
}

export async function idbGet<T>(key: string): Promise<T | null> {
  const db = await openDatabase()
  if (!db) return null
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readonly')
      const request = tx.objectStore(STORE).get(key)
      request.onsuccess = () => resolve((request.result as T) ?? null)
      request.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

export async function idbSet(key: string, value: unknown): Promise<boolean> {
  const db = await openDatabase()
  if (!db) return false
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(value, key)
      tx.oncomplete = () => resolve(true)
      tx.onerror = () => resolve(false)
      tx.onabort = () => resolve(false)
    } catch {
      resolve(false)
    }
  })
}

export async function idbDelete(key: string): Promise<void> {
  const db = await openDatabase()
  if (!db) return
  try {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(key)
  } catch {
    /* ignore */
  }
}
