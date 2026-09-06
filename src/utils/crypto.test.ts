import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type * as CryptoModule from "./crypto";

// crypto.ts derives its config directory from the home directory at import
// time, so point HOME at a throwaway directory before importing it — this
// keeps the test from touching the real ~/.sshman on the developer's machine.
let fakeHome: string;
let crypto: typeof CryptoModule;

before(async () => {
  fakeHome = mkdtempSync(join(tmpdir(), "sshman-crypto-test-"));
  const originalHome = process.env.HOME;
  process.env.HOME = fakeHome;
  crypto = await import("./crypto");
  process.env.HOME = originalHome;
});

after(() => {
  rmSync(fakeHome, { recursive: true, force: true });
});

test("encrypt/decrypt round-trips with the machine-derived key", () => {
  const plaintext = "super secret ssh password";
  const ciphertext = crypto.encrypt(plaintext);
  assert.notEqual(ciphertext, plaintext);
  assert.equal(crypto.decrypt(ciphertext), plaintext);
});

test("encryptWithPassword/decryptWithPassword round-trips", () => {
  const plaintext = '{"servers":[]}';
  const ciphertext = crypto.encryptWithPassword(plaintext, "correct horse battery staple");
  assert.equal(
    crypto.decryptWithPassword(ciphertext, "correct horse battery staple"),
    plaintext,
  );
});

test("decryptWithPassword rejects the wrong password", () => {
  const ciphertext = crypto.encryptWithPassword("hello", "right-password");
  assert.throws(() => crypto.decryptWithPassword(ciphertext, "wrong-password"));
});

test("decryptWithPassword rejects truncated ciphertext", () => {
  assert.throws(() => crypto.decryptWithPassword("dG9vc2hvcnQ=", "any-password"));
});

test("isPlainJSON detects JSON-shaped content", () => {
  assert.equal(crypto.isPlainJSON('{"a":1}'), true);
  assert.equal(crypto.isPlainJSON("[1,2,3]"), true);
  assert.equal(crypto.isPlainJSON("not json"), false);
});
