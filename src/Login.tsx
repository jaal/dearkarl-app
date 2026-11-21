import React, { useEffect, useState } from "react";
import style from "./App.module.css";
import { requestLoginCode, verifyLoginCode } from "./server";
import Base from "./marketing/Base";
import usePageMeta from "./marketing/usePageMeta";
import useSignedIn from "./marketing/useSignedIn";

const PAGE_TITLE = "Log in — dearkarl";
const PAGE_DESCRIPTION =
  "Log in to your DearKarl account with a one-time code sent to your email.";

function navigateTo(url: string) {
  window.location.href = url;
}

/**
 * /login: returning users get a one-time code by email. New accounts are
 * made at /app, with Google, because the Drive folder needs a Google account.
 */
export default function Login(): React.JSX.Element {
  usePageMeta({ title: PAGE_TITLE, description: PAGE_DESCRIPTION });
  const signedIn = useSignedIn();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [resent, setResent] = useState(false);

  // Already logged in: nothing to do here.
  useEffect(() => {
    if (signedIn) navigateTo("/app");
  }, [signedIn]);

  const sendCode = async (address: string) => {
    setError("");
    setBusy(true);
    const ok = await requestLoginCode(address);
    setBusy(false);
    if (!ok) {
      setError("Could not send the code. Check the address and try again.");
      return false;
    }
    return true;
  };

  const onEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const address = email.trim();
    if (await sendCode(address)) {
      setSentTo(address);
      setCode("");
      setResent(false);
    }
  };

  const onCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sentTo) return;
    setError("");
    setBusy(true);
    const result = await verifyLoginCode(sentTo, code);
    if (result === "ok") {
      navigateTo("/app");
      return;
    }
    setBusy(false);
    setError(
      result === "invalid"
        ? "That code is wrong or has expired. Check the latest email, or send a new code."
        : "Could not reach Dear Karl. Check your connection and retry.",
    );
  };

  return (
    <Base title={PAGE_TITLE} description={PAGE_DESCRIPTION} authNav={false}>
      <div className="app">
        <div className="card narrow">
          <h1>Log in</h1>
          {sentTo === null ? (
            <form onSubmit={onEmail}>
              <p className="lede">
                Enter the Google address you signed up with. We'll email you a
                one-time code.
              </p>
              <label className="login-label">
                <span>Email</span>
                <input
                  className="field"
                  type="email"
                  name="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              {error && <p role="alert" className={style.error}>{error}</p>}
              <div className="btn-row">
                <button className="btn" type="submit" disabled={busy}>
                  Email me a code
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={onCode}>
              <p className="lede">
                If <b>{sentTo}</b> has a DearKarl account, a 6-digit code is on
                its way. It works for 10 minutes.
              </p>
              <label className="login-label">
                <span>Code</span>
                <input
                  className="field"
                  type="text"
                  name="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9 ]{6,7}"
                  maxLength={7}
                  required
                  autoFocus
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </label>
              {error && <p role="alert" className={style.error}>{error}</p>}
              {resent && !error && (
                <p className="small" role="status">
                  A new code is on its way (at most one a minute).
                </p>
              )}
              <div className="btn-row">
                <button className="btn" type="submit" disabled={busy}>
                  Log in
                </button>
                <button
                  className="btn ghost"
                  type="button"
                  disabled={busy}
                  onClick={async () => setResent(await sendCode(sentTo))}
                >
                  Send a new code
                </button>
              </div>
              <p className="small" style={{ marginTop: 16 }}>
                <a
                  href="/login"
                  onClick={(e) => {
                    e.preventDefault();
                    setSentTo(null);
                    setError("");
                  }}
                >
                  Use a different email
                </a>
              </p>
            </form>
          )}
        </div>
        <p className="switch-auth">
          New to DearKarl? <a href="/app">Create your free address</a>
        </p>
      </div>
    </Base>
  );
}
