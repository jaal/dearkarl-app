import React, { useState } from "react";
import style from "./App.module.css";
import { formatKarlAddress } from "./karlAddress";
import { ApiTokens } from "./ApiTokens";
import { CopyButton } from "./CopyButton";
import { changeAddressName } from "./server";
import { KARL_ADDRESS_DOMAIN } from "./karlAddress";
import { parseLocalPart } from "../shared/address";
import { ApiPaths } from "../shared/api";

/** Inline editor for the address, shown in place of the address row's value.
    The prefix stays; the readable part is the user's; the ending is drawn
    again on save, so the new address can't be guessed from the old one. */
function AddressEditor(props: {
  karlEmail: string;
  onSaved: (karlEmail: string) => void;
  onCancel: () => void;
}): React.JSX.Element {
  const parsed = parseLocalPart(props.karlEmail);
  const [name, setName] = useState(parsed?.name ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    const result = await changeAddressName(name);
    setSaving(false);
    if ("error" in result) setError(result.error);
    else props.onSaved(result.karlEmail);
  };

  return (
    <form className="address-editor" onSubmit={save}>
      <label htmlFor="address-name" className="visually-hidden">
        Readable part of your address
      </label>
      <div className="address-field">
        <span className="fixed">{parsed?.prefix ?? "claude"}-</span>
        <input
          id="address-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={32}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          autoFocus
          required
          size={Math.max(8, name.length + 1)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "address-error address-help" : "address-help"}
        />
        <span className="fixed" title="A new random ending is drawn when you save">
          -<span className="new-hash">••••••</span>@{KARL_ADDRESS_DOMAIN}
        </span>
      </div>
      {error && (
        <p id="address-error" role="alert" className={style.error}>
          {error}
        </p>
      )}
      <p id="address-help" className="small">
        Saving gives you a new address with a new random ending (•••••• above),
        so it stays hard to guess. The current one stops working at once —
        update any forwarding rules that use it.
      </p>
      <div className="btn-row" style={{ marginTop: 12 }}>
        <button className="btn btn-sm" type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save new address"}
        </button>
        <button
          className="btn ghost btn-sm"
          type="button"
          onClick={props.onCancel}
          disabled={saving}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function Account(props: {
  karlEmail: string;
  userEmail: string;
  /** Just came back from /app/reconnect with fresh Google access. */
  reconnected?: boolean;
  /** False when Karl cannot save to their Drive right now. */
  driveConnected?: boolean;
  error?: string;
  busy?: boolean;
  onLogout: () => void;
  onDeleteAccount: () => void;
  onAddressChanged: (karlEmail: string) => void;
}): React.JSX.Element {
  const karlAddress = formatKarlAddress(props.karlEmail);
  const [editingAddress, setEditingAddress] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  return (
    <div className="card">
      <h1>Your account</h1>
      {props.driveConnected === false ? (
        <>
          <p className="status bad">
            <span className="led" aria-hidden="true" />
            Not connected — Karl can't reach your Drive folder.
          </p>
          <div className="warn" role="alert" style={{ marginTop: 16 }}>
            <p>
              <b>Karl has no access to your Google Drive.</b> Mail you send
              now is not saved. This happens when access is removed in your
              Google account, when it expires, or when the Drive box on
              Google's screen is left unticked.
            </p>
            <div className="btn-row" style={{ marginTop: 12 }}>
              <a className="btn" href="/app/reconnect" data-attr="account-reconnect">
                Reconnect Google Drive
              </a>
            </div>
          </div>
        </>
      ) : (
        <p className="status">
          <span className="led" aria-hidden="true" />
          Connected — mail is landing in your Drive folder.
        </p>
      )}

      {props.reconnected && (
        <p className="notice" role="status" style={{ marginTop: 16 }}>
          <b>Drive access renewed.</b> Karl can save your mail again. Anything
          that failed while access was gone was not saved — send it once more.
        </p>
      )}

      {props.error && (
        <p role="alert" className={style.error}>
          {props.error}
        </p>
      )}

      <div className="rows" style={{ marginTop: 24 }}>
        <div className={editingAddress ? "rowitem editing" : "rowitem"}>
          <span className="k">Your address</span>
          {editingAddress ? (
            <AddressEditor
              karlEmail={props.karlEmail}
              onSaved={(login) => {
                props.onAddressChanged(login);
                setEditingAddress(false);
              }}
              onCancel={() => setEditingAddress(false)}
            />
          ) : (
            <span className="v address-value">
              <span className="mono-inline">{karlAddress}</span>
              <CopyButton text={karlAddress} label="Copy address" inline attr="account-copy-address" />
              <button
                className="btn ghost btn-sm"
                type="button"
                data-attr="account-change-address"
                onClick={() => setEditingAddress(true)}
              >
                Change
              </button>
            </span>
          )}
        </div>
        <div className="rowitem">
          <span className="k">Your Drive folder</span>
          <span className="v">
            <a
              href={ApiPaths.driveFolder}
              target="_blank"
              rel="noopener"
            >
              Open in Drive ↗
            </a>
          </span>
        </div>
        <div className="rowitem">
          <span className="k">Senders allowed to write to you</span>
          <span className="v">{props.userEmail}</span>
        </div>
      </div>

      <ApiTokens />

      <h2>Leaving</h2>
      <div className="danger-zone">
        <div className="rowitem">
          <span>
            <span className="v">Log out</span>
            <br />
            <span className="small">
              Stops this browser session. Your folder and every file in it stay
              exactly where they are, and stay yours.
            </span>
          </span>
          <button
            className="btn ghost"
            data-attr="account-logout"
            onClick={props.onLogout}
            disabled={props.busy}
          >
            Log out
          </button>
        </div>
        <div className="rowitem">
          <span>
            <span className="v">Delete account</span>
            <br />
            <span className="small">
              {confirmingDelete ? (
                <>
                  <b>This cannot be undone.</b> Your address{" "}
                  <code>{karlAddress}</code> stops working at once, Karl loses
                  access to your Drive, and we delete what we hold about you.
                  The dearkarl folder and every file in it stay in your Drive.
                </>
              ) : (
                <>
                  Gives up your address and removes what we hold about you. Your
                  folder and its files stay in your Drive.
                </>
              )}
            </span>
          </span>
          {confirmingDelete ? (
            <span className="btn-row" style={{ marginTop: 0 }}>
              <button
                className="btn ghost"
                onClick={() => setConfirmingDelete(false)}
                disabled={props.busy}
              >
                Cancel
              </button>
              <button
                className="btn"
                data-attr="account-delete-confirm"
                onClick={props.onDeleteAccount}
                disabled={props.busy}
              >
                Yes, delete my account
              </button>
            </span>
          ) : (
            <button
              className="btn ghost"
              data-attr="account-delete"
              onClick={() => setConfirmingDelete(true)}
              disabled={props.busy}
            >
              Delete account
            </button>
          )}
        </div>
      </div>

      <div className="later-note">
        <b>There is no inbox on this page, and there never will be.</b> Reading
        happens in Claude. A web inbox would mean holding your mail to render it
        — the one thing this whole design exists to avoid.
      </div>
    </div>
  );
}

export default Account;
