import {
  getPassword,
  setPassword,
  deletePassword,
  findCredentials,
} from "@napi-rs/keyring/keytar.js";

const SERVICE = "sshman";

export type SecretLookup =
  | { ok: true; password: string | null }
  | { ok: false };

// on Linux without a Secret Service (e.g. WSL with no session bus), get/set
// silently fall back to the in-memory kernel keyring, which is wiped on
// reboot. findCredentials only works against a real store, so it doubles as
// the "will this survive a restart" probe. Memoized: probed once per run.
let availability: Promise<boolean> | undefined;
export function isKeyringAvailable(): Promise<boolean> {
  availability ??= findCredentials(SERVICE).then(
    () => true,
    // locked (e.g. right after boot) is still a real store: reads prompt
    // to unlock it, so it isn't "unavailable"
    (err) => /IsLocked/.test(String(err?.message ?? err)),
  );
  return availability;
}

// looked up by server id. `ok: false` means the keyring backend itself is
// unavailable; `ok: true, password: null` means no secret was stored
export async function getServerPassword(serverId: string): Promise<SecretLookup> {
  if (!(await isKeyringAvailable())) return { ok: false };
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
  // never "save" into the volatile fallback, the caller must know it failed
  if (!(await isKeyringAvailable())) return false;
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
