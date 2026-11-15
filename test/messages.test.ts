import { describe, expect, it } from "vitest";
import {
  couldNotSaveEmail,
  diagErrorSubject,
  savedEmail,
  signInAgainEmail,
  unknownSenderEmail,
  wrongAddressEmail,
} from "../worker/api/messages";

const evil = `<img src=x onerror=alert(1)>`;

describe("mail copy", () => {
  const all = () => [
    savedEmail(),
    unknownSenderEmail({ from: "a@b.c" }),
    wrongAddressEmail({ to: "x@k", karlAddress: "y@k" }),
    signInAgainEmail(),
    couldNotSaveEmail(),
  ];
  const links = (html: string) =>
    [...html.matchAll(/<a href="([^"]*)"[^>]*>([^<]*)<\/a>/g)].map(
      ([, href, text]) => ({ href, text }),
    );

  it("escapes every placeholder taken from inbound mail", () => {
    const mails = [
      unknownSenderEmail({ from: evil }),
      wrongAddressEmail({ to: evil, karlAddress: evil }),
    ];
    for (const m of mails) {
      expect(m.html).not.toContain("<img");
      expect(m.html).toContain("&lt;img");
    }
  });

  it("puts the footer with company details on every user mail", () => {
    for (const m of all()) {
      expect(m.html).toContain("NIP");
      expect(m.html).toContain("6912215667");
      expect(m.html).toContain("mailto:hi@dearkarl.com");
      expect(m.html).not.toContain("Dear Karl");
    }
  });

  it("links both language versions of the privacy policy and terms", () => {
    for (const m of all()) {
      const hrefs = links(m.html).map((l) => l.href);
      expect(hrefs).toContain("https://dearkarl.com/privacy");
      expect(hrefs).toContain("https://dearkarl.com/polityka-prywatnosci");
      expect(hrefs).toContain("https://dearkarl.com/terms");
      expect(hrefs).toContain("https://dearkarl.com/regulamin");
    }
  });

  it("links only dearkarl.com, never the test deployment", () => {
    for (const m of all()) {
      expect(m.html).not.toContain("przemekkudla");
      for (const { href } of links(m.html)) {
        expect(href).toMatch(/^(https:\/\/dearkarl\.com(\/|$)|mailto:hi@dearkarl\.com$)/);
      }
    }
  });

  it("sends sign-up to dearkarl.com", () => {
    expect(unknownSenderEmail({ from: "a@b.c" }).html).toContain(
      '<a href="https://dearkarl.com" style="color:#1a56db">https://dearkarl.com</a>',
    );
  });

  it("sends the sign-in-again mail to the reconnect page in the app", () => {
    expect(signInAgainEmail().html).toContain(
      '<a href="https://dearkarl.com/app/reconnect" style="color:#1a56db">https://dearkarl.com/app/reconnect</a>',
    );
  });

  it("never shows one address as link text while linking to another", () => {
    for (const m of all()) {
      for (const { href, text } of links(m.html)) {
        const host = text.match(/([a-z0-9-]+\.)+[a-z]{2,}/i)?.[0];
        if (host) expect(href).toContain(host);
      }
    }
  });

  it("is English only", () => {
    for (const m of all()) {
      expect(m.html).not.toMatch(/Cześć|Dostajesz|Zapisane/);
    }
  });

  it("uses the agreed subjects", () => {
    expect(savedEmail().subject).toBe("Saved to your Google Drive");
    expect(signInAgainEmail().subject).toBe(
      "Please sign in to DearKarl again",
    );
    expect(couldNotSaveEmail().subject).toBe(
      "I couldn't save your email",
    );
    expect(unknownSenderEmail({ from: "a@b.c" }).subject).toBe(
      "I don't know this address yet",
    );
  });

  it("never carries the user's email subject or filename (mail goes via Elastic)", () => {
    // None of the builders accept a subject; this guards against it creeping back.
    for (const m of all()) {
      expect(m.subject).not.toMatch(/"|Saved:/);
      expect(m.html).not.toMatch(/"[^"<>]*"\s+(to|because)|as "/);
    }
  });

  it("tells the user their right address on mail 3", () => {
    const { html } = wrongAddressEmail({
      to: "abc@dearkarl.com",
      karlAddress: "me123@dearkarl.com",
    });
    expect(html).toContain("me123@dearkarl.com");
  });
});

describe("diagErrorSubject", () => {
  it("uses only the first line", () => {
    expect(diagErrorSubject("boom\nstack")).toBe("[DearKarl] Error: boom");
    expect(diagErrorSubject("")).toBe("[DearKarl] Error: unknown");
  });
});
