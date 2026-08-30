import { describe, expect, it } from 'vitest';
import {
  activeEncryptedRecord,
  createCustomSecretReservation,
  CUSTOM_SECRET_MESSAGE_MAX_LENGTH,
  customTriggerIsDictionaryWord,
  deactivateCustomSecret,
  getCustomSecretMessageError,
  getCustomSecretTriggerError,
  normalizeCustomSecretTrigger,
  replaceCustomSecretMessage,
} from './custom-secret';
import { resolveSecretAction } from './secret-actions';

const trigger = String.fromCharCode(112, 114, 117, 101, 98, 97, 120);
const firstMessage = String.fromCharCode(109, 101, 110, 115, 97, 106, 101, 32, 117, 110, 111);
const secondMessage = String.fromCharCode(109, 101, 110, 115, 97, 106, 101, 32, 100, 111, 115);

describe('local custom secret reservations', () => {
  it('normalizes triggers and enforces the local form limits', () => {
    expect(normalizeCustomSecretTrigger('  ÁRBOLÑ  ')).toBe('arbolñ');
    expect(getCustomSecretTriggerError('dos palabras')).toContain('una sola palabra');
    expect(getCustomSecretMessageError('')).toContain('mensaje');
    expect(getCustomSecretMessageError('x'.repeat(CUSTOM_SECRET_MESSAGE_MAX_LENGTH))).toBeNull();
    expect(getCustomSecretMessageError('x'.repeat(CUSTOM_SECRET_MESSAGE_MAX_LENGTH + 1))).toContain('hasta');
  });

  it('rejects a trigger found in either language lexicon', () => {
    expect(customTriggerIsDictionaryWord('CASA', 'arbol\ncasa\nniño', 'apple\nhouse\nword')).toBe(true);
    expect(customTriggerIsDictionaryWord('HOUSE', 'arbol\ncasa\nniño', 'apple\nhouse\nword')).toBe(true);
    expect(customTriggerIsDictionaryWord(trigger, 'arbol\ncasa\nniño', 'apple\nhouse\nword')).toBe(false);
  });

  it('stores no trigger or message plaintext and resolves the encrypted action', async () => {
    const reservation = await createCustomSecretReservation(trigger, firstMessage, new Date('2026-08-30T00:00:00Z'));
    const serialized = JSON.stringify(reservation);
    const encrypted = activeEncryptedRecord(reservation);

    expect(serialized).not.toContain(trigger);
    expect(serialized).not.toContain(firstMessage);
    expect(encrypted).not.toBeNull();
    await expect(resolveSecretAction(trigger, encrypted ? [encrypted] : [])).resolves.toEqual({
      type: 'judge-message',
      forceInvalid: true,
      message: firstMessage,
    });
  });

  it('edits only with the reserved trigger and deactivation keeps the reservation', async () => {
    const reservation = await createCustomSecretReservation(trigger, firstMessage);
    await expect(replaceCustomSecretMessage(reservation, `${trigger}x`, secondMessage)).resolves.toBeNull();

    const updated = await replaceCustomSecretMessage(reservation, trigger, secondMessage);
    expect(updated?.selector).toBe(reservation.selector);
    expect(updated?.ciphertext).not.toBe(reservation.ciphertext);
    const encrypted = activeEncryptedRecord(updated);
    await expect(resolveSecretAction(trigger, encrypted ? [encrypted] : [])).resolves.toMatchObject({ message: secondMessage });

    const inactive = deactivateCustomSecret(updated!);
    expect(inactive.selector).toBe(reservation.selector);
    expect(inactive.active).toBe(false);
    expect(inactive.ciphertext).toBeNull();
    expect(activeEncryptedRecord(inactive)).toBeNull();
  });
});
