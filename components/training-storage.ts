const DATABASE_NAME = 'dyc-quiz-training'
const STORE_NAME = 'files'

function openTrainingDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function saveTrainingFile(id: string, file: File) {
  const db = await openTrainingDb()
  const blob = file.slice(0, file.size, file.type || 'application/octet-stream')
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite')
    const request = transaction.objectStore(STORE_NAME).put(blob, id)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
  db.close()
  const saved = await getTrainingFile(id)
  if (saved.size !== file.size || (file.type && saved.type !== file.type)) {
    throw new Error('The upload could not be verified in browser storage.')
  }
}

export async function getTrainingFile(id: string) {
  const db = await openTrainingDb()
  const file = await new Promise<Blob | undefined>((resolve, reject) => {
    const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(id)
    request.onsuccess = () => resolve(request.result as Blob | undefined)
    request.onerror = () => reject(request.error)
  })
  db.close()
  if (!file) throw new Error('Training file was not found in this browser.')
  return file
}

export async function deleteTrainingFile(id: string) {
  const db = await openTrainingDb()
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).delete(id)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
  db.close()
}