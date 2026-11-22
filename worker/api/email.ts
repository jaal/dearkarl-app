import { formatAddress } from "../../shared/address";
import PostalMime from "postal-mime";
import UsersDB, { claimUnknownSenderNotice } from "../db";
import GoogleDrive, { DriveAuthError } from "../google/drive";
import sendEmail, {
  ElasticEmailCredentials,
  sendDiagnosticEmail,
} from "../send-email";
import {
  EmailContent,
  couldNotSaveEmail,
  diagAuthRejectedSubject,
  diagNoVerdictSubject,
  savedEmail,
  signInAgainEmail,
  unknownSenderEmail,
  wrongAddressEmail,
} from "./messages";
import GoogleToken from "../google/token";
import { getValidToken } from "./utils";
import { htmlToMarkdown } from "../../shared/html-to-md";
import { cloudflareVerdict, explicitlyFailed, provenSenders } from "./senderCheck";

/** Google Drive rejects these in names; also cap the length. */
function safeFileName(name: string): string {
  const cleaned = name.replace(/[/\\\r\n\t]+/g, "-").trim();
  return (cleaned || "message").slice(0, 120);
}

export async function emailHandler(
  env: Env,
  message: ForwardableEmailMessage,
  creds: ElasticEmailCredentials,
) {
  const parser = new PostalMime();
  const rawEmail = new Response(message.raw as unknown as BodyInit);
  const email = await parser.parse(await rawEmail.arrayBuffer());

  const diagnosticTo = (env as { DIAGNOSTIC_EMAIL?: string }).DIAGNOSTIC_EMAIL;
  const send = (to: string, content: EmailContent) =>
    sendEmail(creds, { to, subject: content.subject, text: content.html });

  // Only Cloudflare's own verdict counts (senderCheck.ts). No verdict at all
  // means Cloudflare's format changed or the mail did not come through Email
  // Routing: save nothing, and tell the operator, since every user's mail
  // would stop the same way.
  const verdict = cloudflareVerdict(email.headers);
  if (!verdict) {
    await sendDiagnosticEmail(creds, diagNoVerdictSubject, `rawSize=${message.rawSize}`, diagnosticTo);
    return;
  }
  if (explicitlyFailed(verdict)) {
    await sendDiagnosticEmail(creds, diagAuthRejectedSubject, `rawSize=${message.rawSize}`, diagnosticTo);
    return;
  }

  const senders = provenSenders(verdict, email.from?.address, message.from);
  const db = new UsersDB(env.DB);
  let user = null;
  for (const s of senders) {
    user = await db.getUser(s.address);
    if (user) break;
  }
  if (!user) {
    // Reply only to an address SPF vouched for: an unproven envelope may be
    // someone else's address typed in by a forger, who'd make Karl spam them.
    const replyTo = senders.find((s) => s.via === "envelope")?.address;
    if (replyTo && (await claimUnknownSenderNotice(env.DB, replyTo, Date.now()))) {
      await send(replyTo, unknownSenderEmail({ from: replyTo }));
    }
    return;
  }

  // Match on the envelope recipient, not the To header: with auto-forwarding
  // (e.g. a Gmail filter) the To header still names the original recipient.
  const toAddress = message.to.toLowerCase();
  const emailToLogin = toAddress.split("@")[0];
  if (!emailToLogin || user.login !== emailToLogin) {
    await send(
      user.email,
      wrongAddressEmail({
        to: toAddress,
        karlAddress: formatAddress(user.login ?? ""),
      }),
    );
    return;
  }

  const secret = env.GOOGLE_CLIENT_SECRET;
  const client = new GoogleToken(secret);

  const accessToken = await getValidToken(user, client, db);
  if (accessToken === null) {
    await send(user.email, signInAgainEmail());
    return;
  }

  const drive = new GoogleDrive(accessToken);
  const filename = safeFileName(
    email.subject ?? `${crypto.randomUUID().split("-")[0]}.md`,
  );

  try {
    const rootFolder = await drive.getRootFolderId();
    await drive.pushFile(
      rootFolder,
      filename,
      email.html ? htmlToMarkdown(email.html) : (email.text ?? "NONE"),
    );
    await send(user.email, savedEmail());
  } catch (e: any) {
    // Only an actual authorization failure should tell the user to log in
    // again — otherwise the advice is wrong and sends them in a loop.
    const isAuthProblem = e instanceof DriveAuthError;
    await send(
      user.email,
      isAuthProblem
        ? signInAgainEmail()
        : couldNotSaveEmail(),
    );
  }
}

export default emailHandler;
