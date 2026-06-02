import crypto from "crypto";
import { config } from "../config";

const ALGORITHM = "aes-256-cbc";

// Ensure we have a valid 32-byte key even if the user didn't configure a proper 64-character hex key
let keyBuffer: Buffer;
try {
  const hex = config.ENCRYPTION_KEY.trim();
  if (hex.length === 64) {
    keyBuffer = Buffer.from(hex, "hex");
  } else {
    // Generate a stable key from the provided string
    keyBuffer = crypto.scryptSync(hex || "default-salt-key-9876", "salt", 32);
  }
} catch (e) {
  keyBuffer = crypto.scryptSync("fallback-salt-key-1234", "salt", 32);
}

export function encrypt(text: string): string {
  if (!text) return "";
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, keyBuffer, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

export function decrypt(encryptedText: string): string {
  if (!encryptedText) return "";
  try {
    const parts = encryptedText.split(":");
    if (parts.length < 2) {
      // In case keys were stored unencrypted or in another format
      return encryptedText;
    }
    const iv = Buffer.from(parts.shift() || "", "hex");
    const encrypted = parts.join(":");
    const decipher = crypto.createDecipheriv(ALGORITHM, keyBuffer, iv);
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (e) {
    console.error("Decryption failed:", e);
    return "DECRYPTION_ERROR";
  }
}
