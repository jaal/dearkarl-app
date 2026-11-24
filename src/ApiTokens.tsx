import React, { useEffect, useState } from "react";
import style from "./App.module.css";
import type { ApiTokenCreated, ApiTokenSummary } from "./server";
import { createApiToken, listApiTokens, revokeApiToken } from "./server";
import { CopyButton } from "./CopyButton";
import { AutoCheck } from "./AutoCheck";
import {
  connectCommand,
  mcpUrl,
  readStoredToken,
  storeToken,
} from "./claudeCodeLine";

const EXPIRY_OPTIONS = [
  { label: "Never", days: null },
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
  { label: "365 days", days: 365 },
];

function formatDate(epochMs: number | null): string {
  if (epochMs === null) return "Never";
  return new Date(epochMs).toLocaleString();
}

/** A stored token is only worth showing while it is still on the active list. */
function stillActive(token: string, tokens: ApiTokenSummary[]): boolean {
  return tokens.some((t) => t.prefix && token.startsWith(t.prefix));
}

/**
 * Everything about letting Claude read the folder: the Claude Code line, the
 * connector URL for Claude's apps, and the Personal Access Tokens behind the
 * line. One section, because the line is just a token wrapped in a command.
 */
export function ApiTokens(): React.JSX.Element {
  const [tokens, setTokens] = useState<ApiTokenSummary[]>([]);
  const [name, setName] = useState("");
  const [expiry, setExpiry] = useState<number | null>(null);
  /** The token the Claude Code line is filled with, if we still know it. */
  const [token, setToken] = useState<string | null>(readStoredToken);
  /** Just generated on this page: show it raw, once, with the warning. */
  const [created, setCreated] = useState<ApiTokenCreated | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const refresh = async () => {
    const list = await listApiTokens();
    if (!list) return;
    setTokens(list);
    setToken((t) => (t && stillActive(t, list) ? t : null));
  };

  useEffect(() => {
    refresh();
  }, []);

  const generate = async (tokenName: string | undefined, days?: number) => {
    setError("");
    setBusy(true);
    const result = await createApiToken(tokenName, days);
    setBusy(false);
    if (!result) {
      setError("Could not generate a token. Please try again.");
      return;
    }
    setCreated(result);
    setToken(result.token);
    storeToken(result.token);
    setName("");
    refresh();
  };

  const revoke = async (id: number) => {
    setBusy(true);
    await revokeApiToken(id);
    setBusy(false);
    refresh();
  };

  return (
    <section aria-labelledby="connect-claude">
      <h2 id="connect-claude">Connect Claude</h2>
      <p>
        Claude reads the files in your <code>dearkarl</code> Drive folder
        through MCP — read-only, nothing else in your Drive.
      </p>

      {error && (
        <p role="alert" className={style.error}>
          {error}
        </p>
      )}

      <h3>Claude Code</h3>
      <p className="small">
        Paste this line into your terminal once, then open a new Claude Code
        session.
      </p>
      {token ? (
        <>
          <div className="copyrow">
            <code className="mono">{connectCommand(token)}</code>
            <CopyButton text={connectCommand(token)} label="Copy line" />
          </div>
          <p className="small">
            The token in this line is shown only while you're here. Lost it?
            Generate a new line and revoke the old token below.{" "}
            <button
              className="linkbtn"
              type="button"
              onClick={() => generate("Claude Code")}
              disabled={busy}
            >
              New line
            </button>
          </p>
        </>
      ) : (
        <div className="btn-row" style={{ marginTop: 4 }}>
          <button
            className="btn"
            type="button"
            onClick={() => generate("Claude Code")}
            disabled={busy}
          >
            {busy ? "Generating…" : "Generate my token"}
          </button>
          <span className="small">
            Your line appears here, with the token already in it. Tokens are
            shown once, so each visit needs a fresh one.
          </span>
        </div>
      )}

      <AutoCheck
        heading={<h3>Let Claude Code check for new mail</h3>}
        onConnected={refresh}
      />

      <h3>Claude apps (claude.ai, Desktop, mobile)</h3>
      <p className="small">
        Settings → Connectors → Add custom connector, with this URL. You sign in
        with Google there; no token needed.
      </p>
      <div className="copyrow">
        <code className="mono">{mcpUrl()}</code>
        <CopyButton text={mcpUrl()} label="Copy URL" />
      </div>

      <h3>Personal access tokens</h3>
      <p className="small">
        For any other MCP client: point it at <code>{mcpUrl()}</code> and send
        the token as <code>Authorization: Bearer &lt;token&gt;</code>.
      </p>

      {created && (
        <div className="notice">
          <p style={{ marginBottom: ".6em" }}>
            <b>New token “{created.name}” — shown only once.</b> Dear Karl
            doesn't keep it. It is also in the Claude Code line above.
          </p>
          <div className="copyrow" style={{ marginBottom: 8 }}>
            <code className="mono">{created.token}</code>
            <CopyButton text={created.token} label="Copy token" />
          </div>
          <button
            className="linkbtn"
            type="button"
            onClick={() => setCreated(null)}
          >
            Hide
          </button>
        </div>
      )}

      <form
        className="token-form"
        onSubmit={(e) => {
          e.preventDefault();
          generate(name.trim() || undefined, expiry ?? undefined);
        }}
      >
        <label>
          Token name
          <input
            type="text"
            value={name}
            placeholder="e.g. Cursor"
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label>
          Expires
          <select
            value={expiry ?? ""}
            onChange={(e) =>
              setExpiry(e.target.value === "" ? null : Number(e.target.value))
            }
          >
            {EXPIRY_OPTIONS.map((o) => (
              <option key={o.label} value={o.days ?? ""}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <button className="btn ghost" type="submit" disabled={busy}>
          Generate token
        </button>
      </form>

      {tokens.length > 0 && (
        <div className="rows" style={{ marginTop: 16 }}>
          {tokens.map((t) => (
            <div
              className="rowitem"
              key={t.id}
              style={{ alignItems: "center" }}
            >
              <span>
                <span className="v">
                  <strong>{t.name}</strong> <code>({t.prefix}…)</code>
                </span>
                <br />
                <span className="small">
                  Created {formatDate(t.createdAt)}, last used{" "}
                  {formatDate(t.lastUsedAt)}
                </span>
              </span>
              <button
                className="btn ghost btn-sm"
                onClick={() => revoke(t.id)}
                disabled={busy}
              >
                Revoke
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
