import { encryptSecretAction, EncryptedSecretRecord, secretSelectorFor } from './secret-actions';
import { hasWord, normalizeWord } from './word-judge';

export const CUSTOM_SECRET_ID = 'owner-slot';
export const CUSTOM_SECRET_TRIGGER_MAX_LENGTH = 24;
export const CUSTOM_SECRET_MESSAGE_MAX_LENGTH = 160;

export type CustomSecretReservation = {
  id: typeof CUSTOM_SECRET_ID;
  selector: string;
  active: boolean;
  salt: string | null;
  iv: string | null;
  ciphertext: string | null;
  messageLength: number;
  createdAt: string;
  updatedAt: string;
};

export function normalizeCustomSecretTrigger(input: string): string {
  return normalizeWord(input, 'es');
}

export function getCustomSecretTriggerError(input: string): string | null {
  const trigger = normalizeCustomSecretTrigger(input);
  if (!trigger) return 'Escribe una palabra clave.';
  if (!/^[a-zñ]+$/.test(trigger)) return 'Usa una sola palabra formada únicamente por letras.';
  if (trigger.length < 2) return 'La palabra clave debe tener al menos 2 letras.';
  if (trigger.length > CUSTOM_SECRET_TRIGGER_MAX_LENGTH) {
    return `La palabra clave admite hasta ${CUSTOM_SECRET_TRIGGER_MAX_LENGTH} letras.`;
  }
  return null;
}

export function getCustomSecretMessageError(input: string): string | null {
  const message = input.trim();
  if (!message) return 'Escribe el mensaje que quieres mostrar.';
  if (message.length > CUSTOM_SECRET_MESSAGE_MAX_LENGTH) {
    return `El mensaje admite hasta ${CUSTOM_SECRET_MESSAGE_MAX_LENGTH} caracteres.`;
  }
  return null;
}

export function customTriggerIsDictionaryWord(
  trigger: string,
  spanishLexicon: string,
  englishLexicon: string,
): boolean {
  return hasWord(spanishLexicon, normalizeWord(trigger, 'es'))
    || hasWord(englishLexicon, normalizeWord(trigger, 'en'));
}

export async function createCustomSecretReservation(
  triggerInput: string,
  messageInput: string,
  now = new Date(),
): Promise<CustomSecretReservation> {
  const triggerError = getCustomSecretTriggerError(triggerInput);
  const messageError = getCustomSecretMessageError(messageInput);
  if (triggerError || messageError) throw new Error(triggerError ?? messageError ?? 'Invalid custom secret.');
  const trigger = normalizeCustomSecretTrigger(triggerInput);
  const message = messageInput.trim();
  const encrypted = await encryptSecretAction(trigger, { type: 'judge-message', forceInvalid: true, message });
  const timestamp = now.toISOString();

  return {
    id: CUSTOM_SECRET_ID,
    ...encrypted,
    active: true,
    messageLength: message.length,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export async function replaceCustomSecretMessage(
  reservation: CustomSecretReservation,
  triggerInput: string,
  messageInput: string,
  now = new Date(),
): Promise<CustomSecretReservation | null> {
  const triggerError = getCustomSecretTriggerError(triggerInput);
  const messageError = getCustomSecretMessageError(messageInput);
  if (triggerError || messageError) throw new Error(triggerError ?? messageError ?? 'Invalid custom secret.');
  const trigger = normalizeCustomSecretTrigger(triggerInput);
  if (await secretSelectorFor(trigger) !== reservation.selector) return null;
  const message = messageInput.trim();
  const encrypted = await encryptSecretAction(trigger, { type: 'judge-message', forceInvalid: true, message });

  return {
    ...reservation,
    ...encrypted,
    active: true,
    messageLength: message.length,
    updatedAt: now.toISOString(),
  };
}

export function deactivateCustomSecret(
  reservation: CustomSecretReservation,
  now = new Date(),
): CustomSecretReservation {
  return {
    ...reservation,
    active: false,
    salt: null,
    iv: null,
    ciphertext: null,
    messageLength: 0,
    updatedAt: now.toISOString(),
  };
}

export function activeEncryptedRecord(reservation: CustomSecretReservation | null): EncryptedSecretRecord | null {
  if (!reservation?.active || !reservation.salt || !reservation.iv || !reservation.ciphertext) return null;
  return {
    selector: reservation.selector,
    salt: reservation.salt,
    iv: reservation.iv,
    ciphertext: reservation.ciphertext,
  };
}
