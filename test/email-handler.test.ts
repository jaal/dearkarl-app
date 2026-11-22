import { describe, expect, it } from "vitest";
import {
  canonicalAddress,
  cloudflareVerdict,
  explicitlyFailed,
  provenSenders,
  type MailHeader,
} from "../worker/api/senderCheck";

const ar = (value: string): MailHeader => ({ key: "Authentication-Results", value });
const CF_GMAIL =
  "mx.cloudflare.net; dkim=pass header.d=gmail.com header.s=20230601 header.b=xyz; " +
  "spf=pass (mx.cloudflare.net: domain of ann@gmail.com designates 209.85.220.41 as permitted sender) smtp.mailfrom=ann@gmail.com; " +
  "dmarc=pass header.from=gmail.com policy.dmarc=none";

describe("cloudflareVerdict", () => {
  it("reads Cloudflare's verdict", () => {
    expect(cloudflareVerdict([ar(CF_GMAIL)])).toEqual({
      dmarc: "pass",
      dmarcDomain: "gmail.com",
      spf: "pass",
      spfMailFrom: "ann@gmail.com",
    });
  });

  it("ignores a header Cloudflare did not write", () => {
    expect(cloudflareVerdict([ar("mx.google.com; dmarc=pass header.from=gmail.com")])).toBeNull();
  });

  it("trusts only the topmost header: one the sender added sits below", () => {
    const forged = [
      ar("mx.cloudflare.net; spf=softfail smtp.mailfrom=ann@gmail.com; dmarc=pass header.from=forger.example"),
      ar("mx.cloudflare.net; spf=pass smtp.mailfrom=ann@gmail.com; dmarc=pass header.from=gmail.com"),
    ];
    expect(cloudflareVerdict(forged)?.spf).toBe("softfail");
    expect(cloudflareVerdict(forged)?.dmarcDomain).toBe("forger.example");
  });

  it("returns null without any header", () => {
    expect(cloudflareVerdict([{ key: "From", value: "a@b.c" }])).toBeNull();
  });

  it("copes with folded multi-line headers", () => {
    expect(cloudflareVerdict([ar("mx.cloudflare.net;\n  dmarc=pass\n  header.from=gmail.com")])?.dmarc).toBe("pass");
  });
});

describe("explicitlyFailed", () => {
  it.each([
    [{ dmarc: "fail", spf: "pass" }, true],
    [{ dmarc: "pass", spf: "fail" }, true],
    [{ dmarc: "pass", spf: "hardfail" }, true],
    [{ dmarc: "pass", spf: "softfail" }, false],
    [{ dmarc: null, spf: null }, false],
  ])("%o -> %s", (v, expected) => {
    expect(explicitlyFailed({ dmarcDomain: null, spfMailFrom: null, ...v })).toBe(expected);
  });
});

describe("provenSenders", () => {
  const v = (s: string) => cloudflareVerdict([ar(s)])!;

  it("a Forward from Gmail proves both the header and the envelope", () => {
    expect(provenSenders(v(CF_GMAIL), "ann@gmail.com", "ann@gmail.com")).toEqual([
      { address: "ann@gmail.com", via: "header" },
      { address: "ann@gmail.com", via: "envelope" },
    ]);
  });

  it("the hole: envelope typed in from a foreign server (softfail) proves nothing", () => {
    const forged = v("mx.cloudflare.net; dkim=pass header.d=forger.example; spf=softfail smtp.mailfrom=ann@gmail.com; dmarc=pass header.from=forger.example");
    expect(provenSenders(forged, "mallory@forger.example", "ann@gmail.com")).toEqual([
      { address: "mallory@forger.example", via: "header" },
    ]);
  });

  it("a DMARC pass for another domain does not carry the From: address", () => {
    const other = v("mx.cloudflare.net; spf=none; dmarc=pass header.from=forger.example");
    expect(provenSenders(other, "ann@gmail.com", "x@forger.example")).toEqual([]);
  });

  it("a Gmail auto-forward is proven by SPF on the +caf_ envelope", () => {
    const fwd = v("mx.cloudflare.net; spf=pass smtp.mailfrom=ann+caf_=karl@gmail.com; dmarc=pass header.from=newsletter.example");
    expect(provenSenders(fwd, "news@newsletter.example", "ann+caf_=karl@gmail.com")).toContainEqual({
      address: "ann@gmail.com",
      via: "envelope",
    });
  });

  it("no verdicts, no senders", () => {
    expect(provenSenders(v("mx.cloudflare.net; dkim=none"), "ann@gmail.com", "ann@gmail.com")).toEqual([]);
  });
});

describe("canonicalAddress", () => {
  it("folds Gmail plus tags, not other domains", () => {
    expect(canonicalAddress("Ann+caf_=x@Gmail.com")).toBe("ann@gmail.com");
    expect(canonicalAddress("ann+tag@example.com")).toBe("ann+tag@example.com");
  });
});
