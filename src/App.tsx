import React, { useEffect, useState } from "react";
import style from "./App.module.css";
import {
  deleteAccount,
  getActiveSession,
  getLoginUrl,
  logout,
  requestToken,
} from "./server";
import Account from "./Account";
import Address from "./Address";
import Connect from "./Connect";
import Destination from "./Destination";
import SignInRefused from "./SignInRefused";
import Reconnect from "./Reconnect";
import Base from "./marketing/Base";
import usePageMeta from "./marketing/usePageMeta";

function navigateTo(url: string) {
  window.location.href = url;
}

// Where a signed-in user lands. Onboarding (destination → address → connect)
// runs only right after the sign-in that created the account; everyone else —
// a returning user, a new tab, a reconnect — goes straight to the account page.
const STAGE_KEY = "dk_flow_stage";
// Set (to a timestamp) when the user starts a reconnect from /app/reconnect.
// If they abandon Google's consent screen it would linger, so it only counts
// when Google sends them back within RECONNECT_TTL_MS.
const RECONNECT_KEY = "dk_reconnecting";
const RECONNECT_TTL_MS = 15 * 60 * 1000;
// One-shot flags set by the OAuth callback and read by the page it lands on.
const RECONNECTED_KEY = "dk_reconnected";
const SIGNIN_FAILED_KEY = "dk_signin_failed";
const ACCOUNT_DELETED_KEY = "dk_account_deleted";

const PAGE_TITLE = "Your account — dearkarl";
const PAGE_DESCRIPTION =
  "Sign in with Google, get your Karl address, and connect Claude Code.";

const SIGNIN_FAILED_MESSAGE =
  "Google sign-in didn't go through. Please try again.";

type Stage = "destination" | "address" | "connect" | "account";

function readStage(): Stage {
  try {
    return sessionStorage.getItem(STAGE_KEY) === "destination" ? "destination" : "account";
  } catch {
    return "account";
  }
}

function readSession(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeSession(key: string, value: string | null) {
  try {
    if (value === null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, value);
  } catch {
    // Storage unavailable; the app still works for this page view.
  }
}

/** Reads and clears a one-shot flag. */
function takeFlag(key: string): boolean {
  const v = readSession(key) === "1";
  writeSession(key, null);
  return v;
}

/** True if a reconnect was started recently; clears the marker either way. */
function takePendingReconnect(): boolean {
  const started = Number(readSession(RECONNECT_KEY));
  writeSession(RECONNECT_KEY, null);
  return started > 0 && Date.now() - started < RECONNECT_TTL_MS;
}

// OAuth codes this page has already started exchanging. React's StrictMode
// runs effects twice in development, and a code is single-use: the second
// exchange would fail (or race the first into a duplicate insert).
const exchangedCodes = new Set<string>();

/** For tests, which reuse codes across cases. */
export function resetExchangedCodes(): void {
  exchangedCodes.clear();
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="4" y="10" width="16" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function ContinueIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M21 12a9 9 0 1 1-2.6-6.3" />
      <path d="M21 12h-8" />
    </svg>
  );
}

function App(props: {
  code: string | null;
  /** True when Google redirected back with an OAuth error, i.e. the user
      declined the consent (access_denied) rather than granting it. */
  refused?: boolean;
  /** /app/reconnect: Karl lost access to the user's Drive and they came from
      the "sign in again" mail to renew it. */
  reconnect?: boolean;
}): React.JSX.Element {
  const [activeSession, setActiveSession] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [karlEmail, setKarlEmail] = useState("");
  const [error, setError] = useState("");
  const [newsletter, setNewsletter] = useState(false);
  const [stage, setStage] = useState<Stage>(readStage);
  const [reconnected, setReconnected] = useState(false);
  const [accountDeleted, setAccountDeleted] = useState(false);

  const goToAccount = () => {
    setStage("account");
    writeSession(STAGE_KEY, "account");
  };

  const loginGoogle = async () => {
    setError("");
    setBusy(true);
    writeSession(RECONNECT_KEY, props.reconnect ? String(Date.now()) : null);

    const loginUrl = await getLoginUrl();
    if (!loginUrl) {
      setError("Could not reach Dear Karl. Check your connection and retry.");
      setBusy(false);
      return;
    }
    navigateTo(loginUrl.url);
    setBusy(false);
  };

  const logoutGoogle = async () => {
    setBusy(true);
    writeSession(STAGE_KEY, null);
    await logout();
    navigateTo("/app");
  };

  const deleteAccountGoogle = async () => {
    setError("");
    setBusy(true);
    if (!(await deleteAccount())) {
      setError("Could not delete your account. Please try again.");
      setBusy(false);
      return;
    }
    writeSession(STAGE_KEY, null);
    writeSession(ACCOUNT_DELETED_KEY, "1");
    navigateTo("/app");
  };

  const initToken = async (code: string) => {
    setError("");
    setBusy(true);

    window.history.replaceState({}, "", "/app");
    const reconnecting = takePendingReconnect();
    const profile = await requestToken(code);
    if (!profile) {
      // The code exchange failed: say so on the page the user started from,
      // instead of silently dropping them back on the sign-in screen.
      writeSession(SIGNIN_FAILED_KEY, "1");
      setBusy(false);
      navigateTo(reconnecting ? "/app/reconnect" : "/app");
      return;
    }
    // A brand-new account runs onboarding; an existing one (including a
    // reconnect) goes to the account page.
    writeSession(STAGE_KEY, profile.isNewUser ? "destination" : "account");
    if (reconnecting) writeSession(RECONNECTED_KEY, "1");
    setBusy(false);
    navigateTo("/app");
  };

  // No busy flag here: every page except /app/reconnect shows "Loading…"
  // until this finishes, and the reconnect button must not look dead while
  // the session check (only used to show the user's email) is in flight.
  const init = async () => {
    if (takeFlag(SIGNIN_FAILED_KEY)) setError(SIGNIN_FAILED_MESSAGE);
    // One-shot flags only ever switch a notice on: StrictMode runs this twice
    // in development, and the second run finds them already taken.
    if (takeFlag(ACCOUNT_DELETED_KEY)) setAccountDeleted(true);
    const session = await getActiveSession();
    if (session) {
      setActiveSession(true);
      setUserEmail(session.userEmail);
      setKarlEmail(session.karlEmail);
      if (takeFlag(RECONNECTED_KEY)) setReconnected(true);
    } else {
      setActiveSession(false);
      setUserEmail("");
      setKarlEmail("");
    }
    setLoading(false);
  };

  useEffect(() => {
    if (props.code) {
      if (exchangedCodes.has(props.code)) return;
      exchangedCodes.add(props.code);
      initToken(props.code);
    } else {
      init();
    }
    return () => {};
  }, []);

  usePageMeta({ title: PAGE_TITLE, description: PAGE_DESCRIPTION });

  // Same frame as the marketing pages (brand bar, paper, footer), so the
  // site and the app read as one place.
  return (
    <Base
      title={PAGE_TITLE}
      description={PAGE_DESCRIPTION}
      authNav={false}
      badge={activeSession ? "Signed in" : "Free while it's new"}
    >
      <div className="app">
        {props.reconnect ? (
          <Reconnect
            userEmail={userEmail}
            error={error}
            busy={busy}
            onReconnect={loginGoogle}
          />
        ) : loading ? (
          <p className="small">Loading…</p>
        ) : !activeSession ? (
          props.refused ? (
            <SignInRefused
              onRetry={() =>
                navigateTo(takePendingReconnect() ? "/app/reconnect" : "/app")
              }
            />
          ) : (
            <>
              {accountDeleted && (
                <div className="card narrow" role="status">
                  <h1>Your account is deleted</h1>
                  <p className="lede">
                    Your Karl address no longer works and Karl no longer has
                    access to your Drive. The dearkarl folder and its files are
                    still in your Drive, and stay yours.
                  </p>
                </div>
              )}
              <nav className="steps" aria-label="Progress">
                <ol>
                  <li className="on">
                    <span className="n">1</span>
                    <span>Sign in</span>
                  </li>
                  <li className="sep" aria-hidden="true" />
                  <li>
                    <span className="n">2</span>
                    <span>Your address</span>
                  </li>
                  <li className="sep" aria-hidden="true" />
                  <li>
                    <span className="n">3</span>
                    <span>Connect Claude Code</span>
                  </li>
                </ol>
              </nav>

            <div className="card narrow">
              <p className="eyebrow">Step 1 of 3</p>
              <h1>Sign in with Google</h1>
              <p className="lede">
                One approval covers everything. Karl uses it to write mail into a
                folder he makes in your Drive, and to read that folder back to
                Claude. Later you can log in with Google or with a code we email
                you.
              </p>

              <ul className="fence">
                <li>
                  <span className="ic yes">
                    <CheckIcon />
                  </span>
                  <span>
                    Karl can see: <b>one folder, the one he creates.</b>
                  </span>
                </li>
                <li>
                  <span className="ic no">
                    <XIcon />
                  </span>
                  <span>
                    Karl cannot see: <b>the rest of your Drive.</b>
                  </span>
                </li>
                <li>
                  <span className="ic">
                    <LockIcon />
                  </span>
                  <span>
                    Karl never asks for: <b>your mailbox.</b>
                  </span>
                </li>
              </ul>

              <label className="optin">
                <input
                  type="checkbox"
                  name="newsletter"
                  value="1"
                  checked={newsletter}
                  onChange={(e) => setNewsletter(e.target.checked)}
                />
                <span className="optin-t">
                  Send me build notes, now and then.
                  <span className="optin-d">
                    Occasional email about what changed. Nothing to do with
                    running the product, and one click gets you off the list.
                    Leave it unticked and we never write your address down.
                  </span>
                </span>
              </label>

              {error && (
                <p role="alert" className={style.error}>
                  {error}
                </p>
              )}

              <div className="btn-row">
                <button className="btn" onClick={loginGoogle} disabled={busy}>
                  <ContinueIcon />
                  Continue with Google
                </button>
              </div>
              <p className="small" style={{ marginTop: 16 }}>
                Scope <code>drive.file</code> — the one that lets an app touch
                only the files it created. You can cut this off from your Google
                account, or from your account page, at any time.
              </p>
            </div>
            <p className="switch-auth">
              Already have an account? <a href="/login">Log in</a>
            </p>
            </>
          )
        ) : stage === "destination" ? (
          <Destination onNext={() => setStage("address")} />
        ) : stage === "address" ? (
          <Address
            karlEmail={karlEmail}
            userEmail={userEmail}
            onNext={() => setStage("connect")}
          />
        ) : stage === "connect" ? (
          <Connect
            karlEmail={karlEmail}
            userEmail={userEmail}
            onDone={goToAccount}
          />
        ) : (
          <Account
            karlEmail={karlEmail}
            userEmail={userEmail}
            reconnected={reconnected}
            error={error}
            busy={busy}
            onShowConnect={() => setStage("connect")}
            onLogout={logoutGoogle}
            onDeleteAccount={deleteAccountGoogle}
            onAddressChanged={setKarlEmail}
          />
        )}
      </div>
    </Base>
  );
}

export default App;
