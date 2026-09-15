const openDB = () => new Promise((resolve, reject) => {
  const request = indexedDB.open('aegis-meeting-audio', 1);
  request.onupgradeneeded = () => request.result.createObjectStore('parts', { keyPath: 'id' });
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});
export async function audioDraft(action, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('parts', action === 'list' ? 'readonly' : 'readwrite');
    const store = tx.objectStore('parts');
    const request = action === 'list' ? store.getAll() : action === 'put' ? store.put(value) : store.delete(value);
    tx.oncomplete = () => { const result = request.result; db.close(); resolve(result); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}
export const audioBase64 = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result).split(',')[1]);
  reader.onerror = () => reject(reader.error);
  reader.readAsDataURL(blob);
});