/**
 * Karl addresses: `{prefix}-{name}-{hash}@in.dearkarl.com`.
 *
 * - prefix: which AI the address feeds; "claude" for now.
 * - name:   readable part. Suggested from the user's email, the user may change
 *           it in settings.
 * - hash:   random, set once at signup and never changed by the user. It is
 *           what makes the address hard to guess.
 *
 * Example: olek.jaworski@gmail.com -> claude-olek.jaworski-k3m9xq@in.dearkarl.com
 *
 * Pure functions only, so both the worker and the frontend can import this.
 */

export const INBOUND_DOMAIN = "in.dearkarl.com";
export const DEFAULT_PREFIX = "claude";

export const HASH_LENGTH = 6;
/** No 0/o, 1/l/i: the hash gets read aloud and copied by hand. */
const HASH_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

export const NAME_MIN = 1;
export const NAME_MAX = 32;
/** Letters, digits, dot, underscore, hyphen; starts and ends with a letter or digit. */
const NAME_RE = /^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/;

export function formatAddress(localPart: string): string {
  return `${localPart}@${INBOUND_DOMAIN}`;
}

export function buildLocalPart(prefix: string, name: string, hash: string): string {
  return `${prefix}-${name}-${hash}`;
}

export interface ParsedLocalPart {
  prefix: string;
  name: string;
  hash: string;
}

/** Splits a local part into its three parts; null for anything else (e.g. legacy logins). */
export function parseLocalPart(localPart: string): ParsedLocalPart | null {
  const m = new RegExp(`^([a-z0-9]+)-(.+)-([a-z0-9]{${HASH_LENGTH}})$`).exec(
    localPart,
  );
  if (!m) return null;
  return { prefix: m[1], name: m[2], hash: m[3] };
}

export type NameCheck = { ok: true; name: string } | { ok: false; error: string };

/** Validates a name the user typed. Lowercases and trims it first. */
export function validateName(input: string): NameCheck {
  const name = input.trim().toLowerCase();
  if (name.length < NAME_MIN || name.length > NAME_MAX)
    return { ok: false, error: `Use ${NAME_MIN}–${NAME_MAX} characters.` };
  if (!NAME_RE.test(name))
    return {
      ok: false,
      error:
        "Use letters, digits, dots, hyphens or underscores, starting and ending with a letter or digit.",
    };
  if (/[._-]{2}/.test(name))
    return { ok: false, error: "Don't put two dots, hyphens or underscores in a row." };
  return { ok: true, name };
}

/**
 * Suggests a name from an email: the part before "@", without a "+tag",
 * lowercased, with anything outside the allowed characters dropped.
 */
export function nameFromEmail(email: string): string {
  let name = (email.split("@")[0] ?? "").split("+")[0].toLowerCase();
  name = name.replace(/[^a-z0-9._-]/g, "");
  name = name.replace(/[._-]{2,}/g, ".");
  name = name.replace(/^[._-]+|[._-]+$/g, "");
  name = name.slice(0, NAME_MAX).replace(/[._-]+$/, "");
  return validateName(name).ok ? name : "user";
}

/** `randomInt(n)` returns an integer in [0, n). Injected so tests are deterministic. */
export type RandomInt = (n: number) => number;

export const cryptoRandomInt: RandomInt = (n) => {
  // Rejection sampling keeps the distribution uniform.
  const limit = Math.floor(0x100000000 / n) * n;
  const buf = new Uint32Array(1);
  do crypto.getRandomValues(buf);
  while (buf[0] >= limit);
  return buf[0] % n;
};

export function randomHash(randomInt: RandomInt = cryptoRandomInt): string {
  let out = "";
  for (let i = 0; i < HASH_LENGTH; i++)
    out += HASH_ALPHABET[randomInt(HASH_ALPHABET.length)];
  return out;
}

/** Four random digits, appended to a name somebody else already uses. */
export function randomDigits(randomInt: RandomInt = cryptoRandomInt): string {
  return String(1000 + randomInt(9000));
}
