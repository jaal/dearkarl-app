import { describe, expect, it } from "vitest";
import {
  HASH_LENGTH,
  buildLocalPart,
  formatAddress,
  nameFromEmail,
  parseLocalPart,
  randomDigits,
  randomHash,
  validateName,
} from "../shared/address";

describe("nameFromEmail", () => {
  it("takes the part before @, lowercased", () => {
    expect(nameFromEmail("Olek.Jaworski@gmail.com")).toBe("olek.jaworski");
  });
  it("drops a +tag", () => {
    expect(nameFromEmail("olek+news@gmail.com")).toBe("olek");
  });
  it("drops characters an address can't carry", () => {
    expect(nameFromEmail("o'brien!@x.com")).toBe("obrien");
  });
  it("trims leading and trailing punctuation and collapses runs", () => {
    expect(nameFromEmail("..a__b..@x.com")).toBe("a.b");
  });
  it("caps the length at 32", () => {
    expect(nameFromEmail(`${"a".repeat(40)}@x.com`)).toHaveLength(32);
  });
  it("falls back to 'user' when nothing usable is left", () => {
    expect(nameFromEmail("!!!@x.com")).toBe("user");
  });
});

describe("validateName", () => {
  it("accepts and lowercases a good name", () => {
    expect(validateName("  Olek.J ")).toEqual({ ok: true, name: "olek.j" });
  });
  it.each(["", "-olek", "olek.", "ol ek", "olek@x", "o..k", "a".repeat(33)])(
    "rejects %j",
    (bad) => {
      expect(validateName(bad).ok).toBe(false);
    },
  );
});

describe("local part", () => {
  it("builds and parses back", () => {
    const lp = buildLocalPart("claude", "olek.jaworski", "k3m9xq");
    expect(lp).toBe("claude-olek.jaworski-k3m9xq");
    expect(parseLocalPart(lp)).toEqual({
      prefix: "claude",
      name: "olek.jaworski",
      hash: "k3m9xq",
    });
  });
  it("keeps hyphens inside the name", () => {
    expect(parseLocalPart("claude-jan-maria-k3m9xq")?.name).toBe("jan-maria");
  });
  it("returns null for a legacy login", () => {
    expect(parseLocalPart("olek.jaworski1")).toBeNull();
  });
  it("formats onto in.dearkarl.com", () => {
    expect(formatAddress("claude-a-k3m9xq")).toBe(
      "claude-a-k3m9xq@in.dearkarl.com",
    );
  });
});

describe("random parts", () => {
  it("hash has the fixed length and no look-alike characters", () => {
    for (let i = 0; i < 200; i++) {
      const h = randomHash();
      expect(h).toHaveLength(HASH_LENGTH);
      expect(h).toMatch(/^[a-hj-km-np-z2-9]+$/);
    }
  });
  it("digits are always four", () => {
    expect(randomDigits(() => 0)).toBe("1000");
    expect(randomDigits((n) => n - 1)).toBe("9999");
  });
});
