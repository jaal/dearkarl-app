import React, { useState } from "react";
import { STEP_COUNT, Steps } from "./Steps";
import style from "./App.module.css";
import { formatKarlAddress } from "./karlAddress";
import { createApiToken } from "./server";
import {
  MCP_SERVER_NAME,
  connectCommand,
  readStoredToken,
  storeToken,
} from "./claudeCodeLine";

function CopySheetsIcon() {
  return (
    <svg
      className="sheets"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" />
    </svg>
  );
}

function CopyTickIcon() {
  return (
    <svg
      className="tick"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function Connect(props: {
  karlEmail: string;
  userEmail: string;
  onNext: () => void;
}): React.JSX.Element {
  const [copied, setCopied] = useState(false);
  const [token, setToken] = useState<string | null>(readStoredToken);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const karlAddress = formatKarlAddress(props.karlEmail);
  const command = token ? connectCommand(token) : "";

  const generate = async () => {
    setError("");
    setBusy(true);
    const result = await createApiToken(MCP_SERVER_NAME);
    setBusy(false);
    if (!result) {
      setError("Could not generate a token. Please try again.");
      return;
    }
    setToken(result.token);
    storeToken(result.token);
  };

  const copy = async () => {
    if (!command) return;
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard may be unavailable; the text stays select-all in the box.
    }
  };

  return (
    <>
      <Steps current={3} />

      <div className="card narrow">
        <p className="eyebrow">Step 3 of {STEP_COUNT}</p>
        <h1>Paste this into Claude Code</h1>

        {token ? (
          <div className="copyrow">
            <code className="mono">{command}</code>
            <button
              className="copybtn"
              type="button"
              aria-label="Copy"
              data-attr="connect-copy-line"
              data-copied={copied ? "1" : undefined}
              onClick={copy}
            >
              <CopySheetsIcon />
              <CopyTickIcon />
            </button>
          </div>
        ) : (
          <div className="btn-row" style={{ marginTop: 0, marginBottom: 14 }}>
            <button className="btn" data-attr="connect-generate-token" onClick={generate} disabled={busy}>
              {busy ? "Generating…" : "Generate my token"}
            </button>
            <span className="small">
              Your line appears here, with the token already in it.
            </span>
          </div>
        )}

        {error && (
          <p role="alert" className={style.error}>
            {error}
          </p>
        )}

        <p>
          That is the whole install. It tells Claude Code where Karl lives, and
          the token inside it proves which account is yours. Nothing gets
          downloaded.
        </p>

        {token && (
          <p className="small" style={{ marginTop: 10 }}>
            Keep this line safe — the token in it is shown once. If you need a
            fresh one, generate a new token on your account page.
          </p>
        )}

        <div className="notice" style={{ marginTop: 22 }}>
          <p style={{ marginBottom: ".6em" }}>
            <b>What you just set up</b>
          </p>
          <ul
            className="small"
            style={{ margin: 0, paddingLeft: "1.1rem" }}
          >
            <li>
              <b>Your address:</b> <code>{karlAddress}</code>
            </li>
            <li>
              <b>Mail lands in:</b> your Drive folder <code>dearkarl</code>
            </li>
            <li>
              <b>Mail is accepted from:</b> <code>{props.userEmail}</code> — and
              nothing else. Anything from another address is turned away, not
              saved.
            </li>
          </ul>
        </div>

        {token && (
          <div className="btn-row">
            <button className="btn" data-attr="connect-next" onClick={props.onNext}>
              Next: check for new mail
            </button>
            <button
              className="btn ghost"
              type="button"
              data-attr="connect-new-token"
              onClick={generate}
              disabled={busy}
            >
              New token
            </button>
          </div>
        )}

        <div className="later-note">
          <b>Keep that line safe.</b> The token in it is proof of which account
          is yours, and it is shown once. If you lose it, revoke it on your
          account page and paste a fresh one — the command is the same, only the
          token changes.
        </div>
      </div>
    </>
  );
}

export default Connect;
