import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveSecretAction } from './secret-actions';

const hiddenInputs = [
  String.fromCharCode(109, 111, 100, 111, 32, 110, 97, 114, 97, 110, 106, 97),
  String.fromCharCode(109, 97, 114, 105, 97, 99, 108, 97, 114, 97),
  String.fromCharCode(116, 114, 97, 115, 116, 111, 121),
];

async function digestText(value: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

describe('encrypted secret actions', () => {
  it('unlocks the encrypted mode action with its matching input', async () => {
    await expect(resolveSecretAction(hiddenInputs[0])).resolves.toEqual({ type: 'toggle-anagrams' });
  });

  it('unlocks both personalized judge results without committed plaintext', async () => {
    const first = await resolveSecretAction(hiddenInputs[1]);
    const second = await resolveSecretAction(hiddenInputs[2]);

    expect(first?.type).toBe('judge-message');
    expect(second?.type).toBe('judge-message');
    if (first?.type !== 'judge-message' || second?.type !== 'judge-message') return;

    expect(first.forceInvalid).toBe(true);
    expect(second.forceInvalid).toBe(false);
    await expect(digestText(first.message)).resolves.toBe('9c8c3562bac4d00c161a62f5a2f1d1d8b69dc4d89f962892d0672866de8ccd10');
    await expect(digestText(second.message)).resolves.toBe('f8a340f65750c9f6c000d7c65d4b5e6d1af9c185b2e6949e5b28479d89fae8c4');

    const protectedSources = [
      path.resolve(import.meta.dirname, 'secret-actions.ts'),
      path.resolve(import.meta.dirname, 'secret-actions.test.ts'),
      path.resolve(import.meta.dirname, '../app/page.tsx'),
    ];
    for (const sourcePath of protectedSources) {
      const source = fs.readFileSync(sourcePath, 'utf8');
      for (const protectedText of [...hiddenInputs, first.message, second.message]) {
        expect(source).not.toContain(protectedText);
      }
    }
  });

  it('ignores ordinary and nearly matching input', async () => {
    await expect(resolveSecretAction('casa')).resolves.toBeNull();
    await expect(resolveSecretAction(`${hiddenInputs[1]}x`)).resolves.toBeNull();
  });
});
