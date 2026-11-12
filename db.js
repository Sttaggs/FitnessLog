const NAME = 'fitnesslog-v1';
const VERSION = 2;
let databasePromise;
export function openDb() {
  if (!databasePromise) databasePromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('sessions')) db.createObjectStore('sessions', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('exercises')) db.createObjectStore('exercises', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('photos')) db.createObjectStore('photos', { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return databasePromise;
}
async function store(name, mode, operation) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(name, mode);
    const result = operation(tx.objectStore(name));
    result.onsuccess = () => resolve(result.result);
    result.onerror = () => reject(result.error);
    tx.onerror = () => reject(tx.error);
  });
}
export const list = (name) => store(name, 'readonly', s => s.getAll());
export const get = (name, id) => store(name, 'readonly', s => s.get(id));
export const put = (name, value) => store(name, 'readwrite', s => s.put(value));
export const remove = (name, id) => store(name, 'readwrite', s => s.delete(id));
export async function replaceAll(name, values) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(name, 'readwrite');
    const s = tx.objectStore(name); s.clear();
    for (const value of values) s.put(value);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}
// Restore across object stores in one transaction, without erasing unlisted stores.
export async function replaceStores(collections) {
  const db=await openDb(), names=Object.keys(collections);
  if(!names.length)return;
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(names,'readwrite');
    for(const name of names){
      const store=tx.objectStore(name);
      store.clear();
      for(const value of collections[name])store.put(value);
    }
    tx.oncomplete=()=>resolve();
    tx.onerror=()=>reject(tx.error);
    tx.onabort=()=>reject(tx.error||new Error('Restore cancelled'));
  });
}
export function newId() { return crypto.randomUUID(); }
