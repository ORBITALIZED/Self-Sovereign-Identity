/**
 * AES-GCM encryption helpers.
 * The symmetric key is derived from `process.env.IPFS_ENCRYPTION_KEY`
 * (a base64-encoded 32-byte secret) for the scaffold; in production we'd
 * derive per-record keys from user-controlled wallet signatures.
 */

const KEY_B64 = process.env.IPFS_ENCRYPTION_KEY!;

async function key(): Promise<CryptoKey> {
  const raw = Buffer.from(KEY_B64, "base64");
  if (raw.length !== 32) throw new Error("ENCRYPTION_KEY must be 32 bytes (base64)");
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export const crypto = {
  async encrypt(plain: Uint8Array): Promise<{ ciphertext: Uint8Array; iv: Uint8Array }> {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = new Uint8Array(
      await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await key(), plain),
    );
    return { ciphertext, iv };
  },

  async decrypt(ciphertext: Uint8Array, iv: Uint8Array): Promise<Uint8Array> {
    return new Uint8Array(
      await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv as BufferSource }, await key(), ciphertext as BufferSource),
    );
  },
};
