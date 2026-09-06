import { test } from "node:test";
import assert from "node:assert/strict";
import compareVersions from "./compareVersions";

test("returns 0 for equal versions", () => {
  assert.equal(compareVersions("1.2.3", "1.2.3"), 0);
});

test("returns 1 when the first version is greater", () => {
  assert.equal(compareVersions("1.3.0", "1.2.9"), 1);
  assert.equal(compareVersions("2.0.0", "1.9.9"), 1);
});

test("returns -1 when the first version is smaller", () => {
  assert.equal(compareVersions("1.2.3", "1.2.4"), -1);
  assert.equal(compareVersions("0.9.9", "1.0.0"), -1);
});

test("treats a missing segment as 0", () => {
  assert.equal(compareVersions("1.2", "1.2.0"), 0);
  assert.equal(compareVersions("1.2.1", "1.2"), 1);
});
