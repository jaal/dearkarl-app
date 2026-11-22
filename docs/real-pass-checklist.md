# Real pass: no stubs, on production

This checks the user path against the real services: Google, Drive, Elastic,
Email Routing and Claude Code. It runs on https://dearkarl.com and takes about
30–40 minutes.

Run it:

- before launch;
- after each deploy that touches sign-in, mail or MCP.

The automated journeys (`pnpm test:e2e`, local stub) cover the same
scenarios on every change. This pass checks only what the stub cannot:
Google's consent screen, real mail delivery and spam placement, and the real
Claude Code client.

**Who does what**

- **Olek** creates the accounts, types passwords and 2FA codes, and approves
  in chat every click that changes an account.
- **Claude** drives the browser and the terminal, and checks every result.

**Accounts**

- **Ania**: the user. A Gmail account added as a test user on the OAuth
  consent screen, because the Google app is still in Testing mode.
- **Obcy**: a stranger. Any other mailbox.

**Mail routing.** Mail to `*@in.dearkarl.com` reaches the `dearkarl-app`
worker through the zone's Email Routing catch-all. No routing rule is needed
per address.

**Record for each step:**

- pass or fail;
- for mail: the time it took to arrive and whether it landed in Inbox,
  Promotions or Spam;
- a screenshot when the result differs from what is expected.

| # | Scenario | Steps (who) | Expected |
|---|---|---|---|
| 1 | **Registration with real consent** | Claude: dearkarl.com → "Create your free address" → "Continue with Google". Olek: signs in as Ania if asked, and says "yes, click Allow". Claude: clicks Allow, goes through onboarding (Where your mail lands → address → Connect Claude Code), generates a token. | Google's consent screen names the app and asks **only** for `drive.file` plus email. The address is `claude-<name>-<hash>@in.dearkarl.com`. The MCP command names `https://dearkarl.com/mcp`. A `dearkarl` folder appears in Ania's Drive. |
| 2 | **Own mail → Drive, and the "Saved" reply** | Claude (approved): from Ania's Gmail, forwards an article and sends a note with a subject, to her Karl address. | Within about a minute: one `.md` file per mail in Ania's `dearkarl` folder, with readable content. A "Saved to your Google Drive" mail from `karl@mail.dearkarl.com` with Reply-To `hi@dearkarl.com`. Record its delivery time and folder. SPF, DKIM and DMARC show `pass` in "Show original". |
| 3 | **Real Claude Code reads it** | Claude, in a scratch directory: `claude mcp add --transport http karl-test https://dearkarl.com/mcp --header "Authorization: Bearer <token>"`, then `claude -p "List my Karl files and summarise the newest one"`. | The answer names the file from step 2 and summarises it. `claude mcp list` shows the server as connected. Remove it afterwards with `claude mcp remove karl-test`. |
| 4 | **Stranger** | Claude (approved): from Obcy, sends two mails to Ania's address. | Obcy gets **one** "I don't know this address yet" reply, not two within 24 hours. Nothing new appears in Ania's Drive. |
| 5 | **Address change** | Claude: changes the name part on Ania's account page. From Ania, sends one mail to the old address and one to the new address. | Old address: the reply "That isn't your DearKarl address" names the new one, and nothing is saved. New address: the mail is saved and "Saved" arrives. |
| 6 | **DMARC fail (spoof)** | Claude (approved): sends through Elastic with `From: <Ania's gmail>`, to Ania's Karl address. This spoofs only our own test account. | Gmail publishes `p=none`, so the mail arrives, but with DMARC = fail. Karl saves nothing and sends Ania no reply. A diagnostic "[DearKarl] Rejected: sender authentication failed" goes to hi@dearkarl.com. |
| 7 | **Logout keeps saving** | Claude: "Log out" on the account page, then sends mail from Ania. | The top bar shows Register / Log in. The mail is still saved to Drive and "Saved" arrives. |
| 8 | **Log in with an emailed code** | Claude: "Log in" → Ania's address → reads the code in Ania's Gmail → enters it. Also tries a wrong code, an unknown address, and "Send a new code" twice within a minute. | The code mail arrives; record its delivery time and folder. The right code opens the account page. A wrong code shows an error. An unknown address shows the same screen, and no mail is sent anywhere. The second request within 60 seconds sends no new mail. |
| 9 | **Revoked access → "sign in again" → reconnect** | Olek approves, then Claude: myaccount.google.com/permissions (Ania) → dearkarl → remove access. Sends mail from Ania. Opens "My account" on dearkarl.com, then the link in the "Please sign in to DearKarl again" mail. Reconnects with Google (Allow approved). Resends. | First send: nothing is saved, and the "sign in again" mail arrives. "My account" goes to `/app/reconnect`, and so does the link in the mail. After reconnecting: "Drive access renewed.", the address is unchanged, and the resend is saved. |
| 10 | **Revoke the MCP token** | Claude: revokes the token on the account page → `claude -p "list my Karl files"`. | MCP answers 401, and Claude Code reports that the server is unauthorised. |
| 11 | **Delete account** | Olek approves, then Claude: Delete account → "Yes, delete my account". Sends mail from Ania to her old address. Requests a login code for her address. | The "Your account is deleted" page appears. dearkarl is **gone** from myaccount.google.com/permissions. The `dearkarl` folder and its files are **still** in Drive. Mail to the address gets "I don't know this address yet". No login code mail arrives. |
| 12 | **Phone** | Olek, on a real phone: home → registration (a second test account, if there is one) → account page. | No sideways scrolling. Buttons are reachable. The address and the command can be copied. |

## After the pass

- Write the results, with delivery times and spam placement, into a dated
  note.
- Clean up:
  - delete the test account on the account page (scenario 11 already does
    this);
  - delete the test files from Ania's Drive if they are not needed;
  - remove `karl-test` from Claude Code.
- Google refresh tokens expire after 7 days while the app is in Testing
  mode. If the account has sat idle longer, re-run scenario 1 before the
  next pass.
