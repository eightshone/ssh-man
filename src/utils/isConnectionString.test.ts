import { test } from "node:test";
import assert from "node:assert/strict";
import isConnectionString from "./isConnectionString";

test("accepts a bare host", () => {
  assert.equal(isConnectionString("example.com"), true);
});

test("accepts user@host:port", () => {
  assert.equal(isConnectionString("root@1.2.3.4:22"), true);
});

test("accepts user:password@host", () => {
  assert.equal(isConnectionString("root:hunter2@1.2.3.4"), true);
});

test("rejects auto-saved server names even if they match the shape", () => {
  assert.equal(isConnectionString("auto-save-root-1.2.3.4"), false);
});

test("rejects an empty string", () => {
  assert.equal(isConnectionString(""), false);
});

test("rejects malformed strings with multiple @ signs", () => {
  assert.equal(isConnectionString("root@extra@1.2.3.4"), false);
});
