// Regenerates the legal PDFs in public/ from the pages as they are served,
// so a PDF can never say something the page doesn't. Run it after the new
// legal text is deployed:
//
//   node scripts/legal-pdfs.mjs                         # from https://dearkarl.com
//   node scripts/legal-pdfs.mjs http://localhost:5173   # from a local copy
//
// regulamin.pdf is the Polish half of /terms, terms.pdf the English half;
// polityka-prywatnosci.pdf is the whole bilingual /privacy page.
import { chromium } from "@playwright/test";
import { resolve } from "node:path";

const BASE = (process.argv[2] ?? "https://dearkarl.com").replace(/\/$/, "");
const OUT = resolve(import.meta.dirname, "../public");

const DOCS = [
  { path: "/terms", keep: "pl", file: "regulamin.pdf", title: "Regulamin — dearkarl" },
  { path: "/terms", keep: "en", file: "terms.pdf", title: "Terms of Service — dearkarl" },
  {
    path: "/privacy",
    keep: "both",
    file: "polityka-prywatnosci.pdf",
    title: "Polityka prywatności / Privacy notice — dearkarl",
  },
];

// The system Chrome, as in playwright.config.ts: no browser download needed.
const browser = await chromium.launch({ channel: "chrome" });
try {
  for (const doc of DOCS) {
    const page = await browser.newPage();
    await page.goto(BASE + doc.path, { waitUntil: "networkidle" });
    await page.locator("section#pl h1").waitFor();
    await page.evaluate(({ keep, title }) => {
      // The cookie dialog and the sign-in links make no sense on paper.
      document.querySelector("dialog.consent")?.remove();
      document.querySelector(".brandbar-r")?.remove();
      if (keep !== "both") {
        const drop = keep === "pl" ? "en" : "pl";
        document.querySelector(".doc .langs")?.remove();
        document.querySelector(".doc > hr")?.remove();
        document.querySelector(`section#${drop}`)?.remove();
        // "Translation: further down this page" points at the half we dropped.
        const first = document.querySelector(`section#${keep} > h1 + * p, section#${keep} > h1 + p`);
        if (first?.querySelector(`a[href="#${drop}"]`)) first.remove();
        document.documentElement.lang = keep;
      }
      document.title = title;
    }, doc);
    await page.emulateMedia({ media: "print" });
    await page.pdf({
      path: resolve(OUT, doc.file),
      format: "A4",
      printBackground: true,
      margin: { top: "18mm", bottom: "18mm", left: "16mm", right: "16mm" },
    });
    await page.close();
    console.log(`${doc.file} <- ${BASE}${doc.path} (${doc.keep})`);
  }
} finally {
  await browser.close();
}
