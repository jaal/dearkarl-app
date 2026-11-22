/**
 * Who really sent this mail? Karl writes into a user's Drive and Claude reads
 * it, so a forged mail is a way into someone's AI. The envelope MAIL FROM
 * (message.from) and the From: header are both just text the sender types;
 * only Cloudflare's own verdict on them counts.
 *
 * Trust only the topmost Authentication-Results header, and only when
 * Cloudflare wrote it (authserv-id mx.cloudflare.net). A sender can add an
 * Authentication-Results header of their own, but it lands below Cloudflare's.
 *
 * A sender is identified by one of two proofs:
 *  - "header": the From: header address, with dmarc=pass for that address's
 *    domain. A manual Forward from Gmail: Google signs it as the user.
 *  - "envelope": the MAIL FROM address, with spf=pass for its domain. A Gmail
 *    auto-forward filter: From: is the newsletter, but Google's own servers
 *    sent it on the user's behalf (Gmail tags the address +caf_=…).
 * Both are domain-level proofs; the local part is bound by the provider (Google)
 * refusing to let one account send as another. Anything else (softfail, none,
 * neutral, no verdict) proves nothing and the mail is not saved.
 */
export const CLOUDFLARE_AUTHSERV_ID = "mx.cloudflare.net";

export interface MailHeader {
  key: string;
  value: string;
}

export interface AuthVerdict {
  dmarc: string | null;
  /** Domain the DMARC verdict is about (header.from=). */
  dmarcDomain: string | null;
  spf: string | null;
  /** Address or domain the SPF verdict is about (smtp.mailfrom=). */
  spfMailFrom: string | null;
}

/** Cloudflare's verdict, or null when the topmost header isn't Cloudflare's. */
export function cloudflareVerdict(headers: MailHeader[]): AuthVerdict | null {
  const first = headers.find((h) => h.key.toLowerCase() === "authentication-results");
  if (!first) return null;
  const value = first.value.replace(/\s+/g, " ").trim();
  if (!value.toLowerCase().startsWith(`${CLOUDFLARE_AUTHSERV_ID};`)) return null;
  const pick = (re: RegExp) => re.exec(value)?.[1]?.toLowerCase() ?? null;
  return {
    dmarc: pick(/\bdmarc=([a-z]+)/i),
    dmarcDomain: pick(/\bheader\.from=([^\s;()]+)/i),
    spf: pick(/\bspf=([a-z]+)/i),
    spfMailFrom: pick(/\bsmtp\.mailfrom=([^\s;()]+)/i),
  };
}

/** An explicit fail: worth a diagnostic note, not just a silent drop. */
export function explicitlyFailed(v: AuthVerdict): boolean {
  return v.dmarc === "fail" || v.spf === "fail" || v.spf === "hardfail";
}

const domainOf = (address: string) => address.split("@")[1] ?? "";

/** Gmail's auto-forward and plus addresses belong to the same account. */
export function canonicalAddress(address: string): string {
  const a = address.trim().toLowerCase();
  const [local, domain] = a.split("@");
  if (!local || !domain) return a;
  if (domain === "gmail.com" || domain === "googlemail.com")
    return `${local.split("+")[0]}@${domain}`;
  return a;
}

export interface ProvenSender {
  address: string;
  via: "header" | "envelope";
}

/** Every sender identity the verdict proves, header proof first. */
export function provenSenders(
  v: AuthVerdict,
  headerFrom: string | undefined,
  envelopeFrom: string,
): ProvenSender[] {
  const out: ProvenSender[] = [];
  const hf = (headerFrom ?? "").trim().toLowerCase();
  if (hf.includes("@") && v.dmarc === "pass" && v.dmarcDomain === domainOf(hf))
    out.push({ address: canonicalAddress(hf), via: "header" });

  const ef = envelopeFrom.trim().toLowerCase();
  const spfDomain = v.spfMailFrom?.includes("@") ? domainOf(v.spfMailFrom) : v.spfMailFrom;
  if (ef.includes("@") && v.spf === "pass" && spfDomain === domainOf(ef))
    out.push({ address: canonicalAddress(ef), via: "envelope" });
  return out;
}
