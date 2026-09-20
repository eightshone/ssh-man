import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir, hostname, userInfo } from "node:os";
import { join } from "node:path";
import { randomBytes, scryptSync, createCipheriv } from "node:crypto";
import type * as LegacyCryptoModule from "./legacyCrypto";

// legacyCrypto.ts reads CONFIG_DIR from HOME at import time, so point HOME
// at a throwaway dir first
let fakeHome: string;
let legacyCrypto: typeof LegacyCryptoModule;

function encryptLegacy(plaintext: string, salt: Buffer): string {
  const key = scryptSync(`${hostname()}:${userInfo().username}`, salt, 32);
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

before(async () => {
  fakeHome = mkdtempSync(join(tmpdir(), "sshman-legacy-crypto-test-"));
  const originalHome = process.env.HOME;
  process.env.HOME = fakeHome;
  legacyCrypto = await import("./legacyCrypto");
  process.env.HOME = originalHome;
});

after(() => {
  rmSync(fakeHome, { recursive: true, force: true });
});

test("legacyDecrypt reads back data encrypted with the old machine-derived key", () => {
  const salt = randomBytes(32);
  mkdirSync(join(fakeHome, ".sshman"), { recursive: true });
  writeFileSync(join(fakeHome, ".sshman", ".salt"), salt);

  const plaintext = "super secret ssh password";
  const ciphertext = encryptLegacy(plaintext, salt);
  assert.equal(legacyCrypto.legacyDecrypt(ciphertext), plaintext);
});
