import { test } from "node:test";
import assert from "node:assert/strict";
import validateServerName from "./validateServerName";
import { server } from "./types";

const existingServer: server = {
  id: "1",
  name: "prod-web",
  host: "1.2.3.4",
  port: 22,
  username: "root",
  usePassword: false,
  privateKey: "~/.ssh/id_rsa",
};

test("accepts a valid, unused name", () => {
  assert.equal(validateServerName("staging-web", [existingServer]), true);
});

test("rejects invalid characters", () => {
  const result = validateServerName("prod.web!", [existingServer]);
  assert.equal(typeof result, "string");
});

test("rejects names starting or ending with a separator", () => {
  assert.equal(typeof validateServerName("-prod", [existingServer]), "string");
  assert.equal(typeof validateServerName("prod-", [existingServer]), "string");
});

test("rejects a name that already exists (case/space insensitive)", () => {
  const result = validateServerName("Prod Web", [existingServer]);
  assert.equal(typeof result, "string");
});
