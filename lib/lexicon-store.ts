import { Language } from './word-judge';
import { LEXICON_STORE, openLocalDatabase } from './local-database';

export type StoredLexicon = {
  language: Language;
  text: string;
  count: number;
  name: string;
  updatedAt: string;
};

export async function readStoredLexicon(language: Language): Promise<StoredLexicon | null> {
  const database = await openLocalDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(LEXICON_STORE, 'readonly');
    const request = transaction.objectStore(LEXICON_STORE).get(language);
    request.onsuccess = () => resolve((request.result as StoredLexicon | undefined) ?? null);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
  });
}

export async function saveStoredLexicon(lexicon: StoredLexicon): Promise<void> {
  const database = await openLocalDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(LEXICON_STORE, 'readwrite');
    transaction.objectStore(LEXICON_STORE).put(lexicon);
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function removeStoredLexicon(language: Language): Promise<void> {
  const database = await openLocalDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(LEXICON_STORE, 'readwrite');
    transaction.objectStore(LEXICON_STORE).delete(language);
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => reject(transaction.error);
  });
}
