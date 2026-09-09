import {
  getPassword,
  setPassword,
  deletePassword,
} from "@napi-rs/keyring/keytar.js";

const SERVICE = "sshman";

export type SecretLookup =
  | { ok: true; password: string | null }
  | { ok: false };

// looked up by server id. `ok: false` means the keyring backend itself is
// unavailable; `ok: true, password: null` means no secret was stored
export async function getServerPassword(serverId: string): Promise<SecretLookup> {
  try {
    const password = await getPassword(SERVICE, serverId);
    return { ok: true, password };
  } catch {
    return { ok: false };
  }
}

export async function setServerPassword(
  serverId: string,
  password: string,
): Promise<boolean> {
  try {
    await setPassword(SERVICE, serverId, password);
    return true;
  } catch {
    return false;
  }
}

export async function deleteServerPassword(serverId: string): Promise<void> {
  try {
    await deletePassword(SERVICE, serverId);
  } catch {
    // no backend, or nothing stored, either way there's nothing left to do
  }
}
