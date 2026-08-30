export type SecretAction =
  | { type: 'toggle-anagrams' }
  | { type: 'judge-message'; forceInvalid: boolean; message: string };

export type EncryptedSecretRecord = {
  selector: string;
  salt: string;
  iv: string;
  ciphertext: string;
};

const KEY_ITERATIONS = 250_000;

const ENCRYPTED_RECORDS: EncryptedSecretRecord[] = [
  {
    selector: '2181e27417392c8491260bad4810da31ee9101abe8ba19cbeeb8c43bf6a6e0fe',
    salt: 'f6baa0fb192c50a03c0cf0949f8a2769',
    iv: '0c5119f89d73762f616e7950',
    ciphertext: 'cfefdde11b107969e07bca87b74f340d100bc452e267d05129ad1f48d2',
  },
  {
    selector: '3ccd74ad43d8ce7afe36f2a71a365e6a6381248d2c02654177e568e7d40e590f',
    salt: '06563a6ef752aa069247066f7851daca',
    iv: 'f4fd540b9d1ab1634709eb22',
    ciphertext: '3327cd2b8d6456f814f9ffca05efef6565813f1d03a60426481135ca7e1459946cc34bd81e50920c3b01dc7d51497bf9c8eb87927c51307cb2a6a21f9c3fcf11799d3fb7679ee6e5eaf79781d19fe2f07050c4bf7aa25aac',
  },
  {
    selector: '15bff92f4fdad4e4736b89688dce9a7598bc29cce3f10ce852a13c321c87afcc',
    salt: 'b5c054a04b1d33986f99298816bc3264',
    iv: '9a402feee457419f05fa37be',
    ciphertext: '8b8e12858099319f33c3df5321186a2c5ba6975707a18978753c580fd9879f44199c554675cd6c9f108d123df94374007faa2c21501ebf4bcd68d6a748b902afa7cc777aeb6e0187cb741abc806cb8a4dd3a30',
  },
];

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function hexToBytes(value: string): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < value.length; index += 2) {
    bytes[index / 2] = Number.parseInt(value.slice(index, index + 2), 16);
  }
  return bytes;
}

function bytesToHex(value: ArrayBuffer | Uint8Array): string {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function secretSelectorFor(input: string): Promise<string> {
  return bytesToHex(await globalThis.crypto.subtle.digest('SHA-256', encoder.encode(input)));
}

async function deriveSecretKey(input: string, salt: Uint8Array<ArrayBuffer>, usage: KeyUsage): Promise<CryptoKey> {
  const keyMaterial = await globalThis.crypto.subtle.importKey(
    'raw',
    encoder.encode(input),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return globalThis.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt,
      iterations: KEY_ITERATIONS,
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    [usage],
  );
}

async function decryptRecord(input: string, record: EncryptedSecretRecord): Promise<unknown> {
  const key = await deriveSecretKey(input, hexToBytes(record.salt), 'decrypt');
  const plaintext = await globalThis.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: hexToBytes(record.iv) },
    key,
    hexToBytes(record.ciphertext),
  );
  return JSON.parse(decoder.decode(plaintext));
}

function serializeAction(action: SecretAction): Record<string, unknown> {
  if (action.type === 'toggle-anagrams') return { v: 1, k: 0 };
  return { v: 1, k: 1, f: action.forceInvalid ? 1 : 0, m: action.message };
}

export async function encryptSecretAction(input: string, action: SecretAction): Promise<EncryptedSecretRecord> {
  if (!globalThis.crypto?.subtle) throw new Error('Web Crypto is not available.');
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveSecretKey(input, salt, 'encrypt');
  const plaintext = encoder.encode(JSON.stringify(serializeAction(action)));
  const ciphertext = await globalThis.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);

  return {
    selector: await secretSelectorFor(input),
    salt: bytesToHex(salt),
    iv: bytesToHex(iv),
    ciphertext: bytesToHex(ciphertext),
  };
}

function parseAction(payload: unknown): SecretAction | null {
  if (!payload || typeof payload !== 'object') return null;
  const value = payload as Record<string, unknown>;
  if (value.v !== 1) return null;
  if (value.k === 0) return { type: 'toggle-anagrams' };
  if (value.k === 1 && (value.f === 0 || value.f === 1) && typeof value.m === 'string') {
    return { type: 'judge-message', forceInvalid: value.f === 1, message: value.m };
  }
  return null;
}

export async function isBuiltInSecretTrigger(input: string): Promise<boolean> {
  if (!globalThis.crypto?.subtle) return false;
  const selector = await secretSelectorFor(input);
  return ENCRYPTED_RECORDS.some((candidate) => candidate.selector === selector);
}

export async function resolveSecretAction(
  input: string,
  additionalRecords: EncryptedSecretRecord[] = [],
): Promise<SecretAction | null> {
  if (!globalThis.crypto?.subtle) return null;
  const selector = await secretSelectorFor(input);
  const record = ENCRYPTED_RECORDS.find((candidate) => candidate.selector === selector)
    ?? additionalRecords.find((candidate) => candidate.selector === selector);
  if (!record) return null;

  try {
    return parseAction(await decryptRecord(input, record));
  } catch {
    return null;
  }
}
