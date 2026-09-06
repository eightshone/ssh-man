import { test } from "node:test";
import assert from "node:assert/strict";
import normalizeServerName from "./normalizeServerName";

test("lowercases the name", () => {
  assert.equal(normalizeServerName("MyServer"), "myserver");
});

test("replaces spaces with dashes", () => {
  assert.equal(normalizeServerName("my server name"), "my-server-name");
});

test("leaves an already-normalized name unchanged", () => {
  assert.equal(normalizeServerName("my-server"), "my-server");
});
