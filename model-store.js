// Binary assets belong in IndexedDB, not the small synchronous settings store.
function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('momo-assets', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('models');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function transaction(mode, action) {
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('models', mode);
      const request = action(tx.objectStore('models'));
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('存储已中止'));
    });
  } finally { db.close(); }
}
export const readModel = () => transaction('readonly', store => store.get('companion'));
export const storeModel = model => transaction('readwrite', store => store.put(model, 'companion'));
export const removeModel = () => transaction('readwrite', store => store.delete('companion'));
