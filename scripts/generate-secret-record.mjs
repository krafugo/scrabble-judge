import { webcrypto } from 'node:crypto';

const input = process.env.SECRET_TRIGGER;
const payload = process.env.SECRET_PAYLOAD_JSON;
if (!input || !payload) {
  throw new Error('Provide SECRET_TRIGGER and SECRET_PAYLOAD_JSON outside version control.');
}
JSON.parse(payload);

const encoder = new TextEncoder();
const toHex = (bytes) => Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
const salt = webcrypto.getRandomValues(new Uint8Array(16));
const iv = webcrypto.getRandomValues(new Uint8Array(12));
const material = await webcrypto.subtle.importKey('raw', encoder.encode(input), 'PBKDF2', false, ['deriveKey']);
const key = await webcrypto.subtle.deriveKey(
  { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 250_000 },
  material,
  { name: 'AES-GCM', length: 256 },
  false,
  ['encrypt'],
);
const ciphertext = new Uint8Array(
  await webcrypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(payload)),
);
const selector = new Uint8Array(await webcrypto.subtle.digest('SHA-256', encoder.encode(input)));

process.stdout.write(`${JSON.stringify({
  selector: toHex(selector),
  salt: toHex(salt),
  iv: toHex(iv),
  ciphertext: toHex(ciphertext),
}, null, 2)}\n`);
