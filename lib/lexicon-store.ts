import { Language } from './word-judge';

export type StoredLexicon = {
  language: Language;
  text: string;
  count: number;
  name: string;
  updatedAt: string;
};

const DATABASE = 'palabra-justa';
const STORE = 'lexicons';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE)) {
        database.createObjectStore(STORE, { keyPath: 'language' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function readStoredLexicon(language: Language): Promise<StoredLexicon | null> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE, 'readonly');
    const request = transaction.objectStore(STORE).get(language);
    request.onsuccess = () => resolve((request.result as StoredLexicon | undefined) ?? null);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
  });
}

export async function saveStoredLexicon(lexicon: StoredLexicon): Promise<void> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE, 'readwrite');
    transaction.objectStore(STORE).put(lexicon);
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function removeStoredLexicon(language: Language): Promise<void> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE, 'readwrite');
    transaction.objectStore(STORE).delete(language);
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => reject(transaction.error);
  });
}
