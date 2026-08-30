import { CUSTOM_SECRET_ID, CustomSecretReservation } from './custom-secret';
import { CUSTOM_SECRET_STORE, openLocalDatabase } from './local-database';

export async function readCustomSecretReservation(): Promise<CustomSecretReservation | null> {
  const database = await openLocalDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(CUSTOM_SECRET_STORE, 'readonly');
    const request = transaction.objectStore(CUSTOM_SECRET_STORE).get(CUSTOM_SECRET_ID);
    request.onsuccess = () => resolve((request.result as CustomSecretReservation | undefined) ?? null);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
  });
}

export async function reserveCustomSecret(reservation: CustomSecretReservation): Promise<void> {
  const database = await openLocalDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(CUSTOM_SECRET_STORE, 'readwrite');
    transaction.objectStore(CUSTOM_SECRET_STORE).add(reservation);
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => { database.close(); reject(transaction.error); };
  });
}

export async function updateCustomSecretReservation(reservation: CustomSecretReservation): Promise<void> {
  const database = await openLocalDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(CUSTOM_SECRET_STORE, 'readwrite');
    const store = transaction.objectStore(CUSTOM_SECRET_STORE);
    const request = store.get(CUSTOM_SECRET_ID);
    request.onsuccess = () => {
      const current = request.result as CustomSecretReservation | undefined;
      if (!current || current.selector !== reservation.selector) {
        transaction.abort();
        return;
      }
      store.put(reservation);
    };
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onabort = () => { database.close(); reject(new Error('The reserved trigger cannot be replaced.')); };
    transaction.onerror = () => { database.close(); reject(transaction.error); };
  });
}
