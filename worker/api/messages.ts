/**
 * User-facing mail copy, as agreed in docs/email-copy-proposal.md.
 *
 * Every mail follows one template: greeting → what happened → what to do →
 * "Karl" → footer. Every placeholder comes from inbound mail anyone can send,
 * so all of them are HTML-escaped before they reach the body.
 *
 * Privacy: mail goes out through Elastic Email, a third party. Nothing from the
 * user's own message — its subject or the Drive filename built from it — is put
 * in these mails, so Elastic never sees what people save.
 */
import { escapeHtml } from "../send-email";
import { SITE_ORIGIN, SUPPORT_EMAIL } from "../../shared/urls";

export interface EmailContent {
  subject: string;
  /** HTML body, ready for Elastic Email. */
  html: string;
}

/** Every link in user mail points at the public site (shared/urls.ts). */
const SITE = SITE_ORIGIN;
const CONTACT = SUPPORT_EMAIL;
/** The app page that renews Karl's Google access (src/Reconnect.tsx). */
const RECONNECT = `${SITE}/app/reconnect`;
/** Mail is English-only; each legal page holds both languages (#pl on top, #en below). */
const PRIVACY_EN = `${SITE}/privacy#en`;
const PRIVACY_PL = `${SITE}/privacy#pl`;
const TERMS_EN = `${SITE}/terms#en`;
const TERMS_PL = `${SITE}/terms#pl`;

const FONT = "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";

const link = (url: string, text = url, style = "color:#1a56db") =>
  `<a href="${url}" style="${style}">${text}</a>`;
const mailto = (address: string, style?: string) =>
  link(`mailto:${address}`, address, style);
const p = (...lines: string[]) =>
  `<p style="margin:0 0 16px">${lines.join("<br>\n")}</p>`;

const MUTED_LINK = "color:#666;text-decoration:underline";
const dot = " &nbsp;·&nbsp; ";

/**
 * Footer as a full-width band under the mail: three short lines instead of
 * a column, so it stays out of the way of the message itself.
 */
function footer(whyLine: string): string {
  const lines = [
    [
      `<strong>DearKarl</strong>`,
      link(SITE, "dearkarl.com", MUTED_LINK),
      `Contact: ${mailto(CONTACT, MUTED_LINK)}`,
    ].join(dot),
    [
      `Privacy policy: ${link(PRIVACY_EN, "English", MUTED_LINK)} / ${link(PRIVACY_PL, "Polski", MUTED_LINK)}`,
      `Terms: ${link(TERMS_EN, "English", MUTED_LINK)} / ${link(TERMS_PL, "Polski", MUTED_LINK)}`,
    ].join(dot),
    [
      "Technologie 21 Aleksander Jaworski",
      "Pionerska 7/2, 53-213 Wrocław, Poland",
      "VAT ID (NIP): 6912215667, registered in CEIDG",
    ].join(dot),
    whyLine,
  ];
  return `<tr><td style="background:#f6f6f6;border-top:1px solid #e3e3e3;padding:16px 24px;color:#666;font-size:12px;line-height:1.6">${lines.join("<br>\n")}</td></tr>`;
}

const ACCOUNT_WHY = "You got this because you have a DearKarl account.";

/**
 * Mail layout: a full-width table (tables survive Gmail/Outlook, divs with
 * max-width don't), the message text in a readable column, and the footer —
 * always the last argument — as a band across the whole width.
 */
const body = (...blocks: string[]) => {
  const foot = blocks.pop() ?? "";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;${FONT}">
<tr><td style="padding:24px 24px 8px;color:#1f1f1f;font-size:15px;line-height:1.5"><div style="max-width:600px">
${blocks.join("\n")}
</div></td></tr>
${foot}
</table>`;
};

// ---------------------------------------------------------------- 1. Saved

export function savedEmail(): EmailContent {
  return {
    subject: "Saved to your Google Drive",
    html: body(
      p("Hi,"),
      p("I saved your email to the dearkarl folder on your Google Drive."),
      p("Karl"),
      footer("You get this after every saved email."),
    ),
  };
}

// ------------------------------------------------- 2. Sender not recognised

export function unknownSenderEmail(v: { from: string }): EmailContent {
  const from = escapeHtml(v.from);
  return {
    subject: "I don't know this address yet",
    html: body(
      p("Hi,"),
      p(
        `I got your email, but ${from} isn't linked to a DearKarl account, so I didn't save anything.`,
      ),
      p(
        "If you already have an account, send from the Google address you signed up with.",
        `If not, you can create one at ${link(SITE)}.`,
      ),
      p("Karl"),
      footer(
        `You got this because an email from ${from} was sent to a DearKarl address.`,
      ),
    ),
  };
}

// ------------------------------------------------ 3. Wrong DearKarl address

export function wrongAddressEmail(v: {
  to: string;
  karlAddress: string;
}): EmailContent {
  const to = escapeHtml(v.to);
  const karl = escapeHtml(v.karlAddress);
  return {
    subject: "That isn't your DearKarl address",
    html: body(
      p("Hi,"),
      p(
        `You sent an email to ${to}, which isn't your DearKarl address, so I didn't save anything.`,
      ),
      p(`Your address is ${karl}. Send the email there and I'll save it.`),
      p("Karl"),
      footer(ACCOUNT_WHY),
    ),
  };
}

// ---------------------------------------------------------- 4. Sign in again

export function signInAgainEmail(): EmailContent {
  return {
    subject: "Please sign in to DearKarl again",
    html: body(
      p("Hi,"),
      p(
        `I couldn't save your email because my access to your Google Drive has expired. Nothing was saved.`,
      ),
      p(
        `Reconnect your Google Drive here: ${link(RECONNECT)}`,
        "Then send the email once more.",
      ),
      p("Karl"),
      footer(ACCOUNT_WHY),
    ),
  };
}

// ----------------------------------------------------------- 5. Could not save

export function couldNotSaveEmail(): EmailContent {
  return {
    subject: "I couldn't save your email",
    html: body(
      p("Hi,"),
      p("I couldn't save your email to your Google Drive. Nothing was saved."),
      p(
        "This usually means the drive is full. Free up some space and send the email again.",
        `If it keeps happening, write to ${mailto(CONTACT)}.`,
      ),
      p("Karl"),
      footer(ACCOUNT_WHY),
    ),
  };
}

// ------------------------------------------------------------ Operator mails

// ------------------------------------------------------- 6. Sign-in code

export function loginCodeEmail(v: { code: string; minutes: number }): EmailContent {
  const code = escapeHtml(v.code);
  return {
    subject: `Your DearKarl sign-in code: ${code}`,
    html: body(
      p("Hi,"),
      p("Here is your code to log in to DearKarl:"),
      `<p style="margin:0 0 16px;font-size:28px;letter-spacing:6px;font-weight:600">${code}</p>`,
      p(
        `It works once, for ${v.minutes} minutes.`,
        "If you didn't ask for it, ignore this email; nobody can log in without the code.",
      ),
      p("Karl"),
      footer(ACCOUNT_WHY),
    ),
  };
}

export const DIAG_PREFIX = "[DearKarl]";

export const diagAuthRejectedSubject = `${DIAG_PREFIX} Rejected: sender authentication failed`;

/** `[DearKarl] Error: <first line of the message>`, kept short for filters. */
export function diagErrorSubject(message: string): string {
  const first = (message.split(/\r?\n/)[0] ?? "").trim().slice(0, 120);
  return `${DIAG_PREFIX} Error: ${first || "unknown"}`;
}
