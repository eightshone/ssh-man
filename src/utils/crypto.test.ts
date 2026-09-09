import { test } from "node:test";
import assert from "node:assert/strict";
import * as crypto from "./crypto";

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
