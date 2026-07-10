/**
 * AES-GCM encryption helpers.
 * The symmetric key is derived from `process.env.IPFS_ENCRYPTION_KEY`
 * (a base64-encoded 32-byte secret) for the scaffold; in production we'd
 * derive per-record keys from user-controlled wallet signatures.
 *
 * IMPORTANT: The exported `crypto` object must NOT call `crypto.subtle` or
 * `crypto.getRandomValues` on itself — that would be a recursive call.
 * Use `globalThis.crypto` (the Web Crypto API available in Node ≥ 19 and all
 * modern browsers) to reach the platform implementation.
 */

const KEY_B64 = process.env.IPFS_ENCRYPTION_KEY!;

// Alias for the platform Web Crypto so we never accidentally call ourselves.
const webCrypto = globalThis.crypto;

async function key(): Promise<CryptoKey> {
  const raw = Buffer.from(KEY_B64, "base64");
  if (raw.length !== 32) throw new Error("ENCRYPTION_KEY must be 32 bytes (base64)");
  return webCrypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export const crypto = {
  async encrypt(plain: Uint8Array): Promise<{ ciphertext: Uint8Array; iv: Uint8Array }> {
    // Use globalThis.crypto, NOT `crypto.getRandomValues` (which would recurse).
    const iv = webCrypto.getRandomValues(new Uint8Array(12));
    const ciphertext = new Uint8Array(
      await webCrypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv.buffer as ArrayBuffer },
        await key(),
        plain.buffer as ArrayBuffer,
      ),
    );
    return { ciphertext, iv };
  },

  async decrypt(ciphertext: Uint8Array, iv: Uint8Array): Promise<Uint8Array> {
    const result = await webCrypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv.buffer as ArrayBuffer },
      await key(),
      ciphertext.buffer as ArrayBuffer,
    );
    return new Uint8Array(result);
  },
};
