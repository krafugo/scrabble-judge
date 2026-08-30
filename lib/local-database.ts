const DATABASE_NAME = 'palabra-justa';
const DATABASE_VERSION = 2;

export const LEXICON_STORE = 'lexicons';
export const CUSTOM_SECRET_STORE = 'custom-secret';

export function openLocalDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(LEXICON_STORE)) {
        database.createObjectStore(LEXICON_STORE, { keyPath: 'language' });
      }
      if (!database.objectStoreNames.contains(CUSTOM_SECRET_STORE)) {
        database.createObjectStore(CUSTOM_SECRET_STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
