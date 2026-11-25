import React, { useCallback, useEffect, useRef, useState } from "react";
import { listApiTokens } from "./server";
import { CopyButton } from "./CopyButton";
import { AUTO_CHECK_PROMPT, CHECK_EVERY_MINUTES, CHECK_SCRIPT_URL } from "./claudeCodeLine";

/** How often the page asks whether Claude Code has connected yet. */
const POLL_MS = 4000;
/** Stop asking on our own after this long; "Check now" still works. */
const POLL_FOR_MS = 15 * 60 * 1000;

/**
 * Claude Code has connected once any of the user's tokens has been used:
 * every successful /mcp request stamps `last_used_at` on its token.
 */
async function claudeCodeConnected(): Promise<boolean> {
  const tokens = await listApiTokens();
  return !!tokens?.some((t) => t.lastUsedAt !== null);
}

/**
 * The "let Claude check for new mail" prompt, shown only once Claude Code
 * has really reached /mcp. Until then the user sees what to do and the page
 * keeps checking by itself, so the prompt can't be pasted into a Claude Code
 * that doesn't have dearkarl yet.
 */
export function AutoCheck(props: {
  heading: React.ReactNode;
  /** Called once when the connection is first seen (e.g. to refresh a list). */
  onConnected?: () => void;
  /** Extra text above the waiting hint. */
  waitingHint?: React.ReactNode;
  /** Told whether the prompt is on screen (connected or revealed). */
  onShownChange?: (shown: boolean) => void;
}): React.JSX.Element {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkedOnce, setCheckedOnce] = useState(false);
  /** The user chose to see the prompt without waiting for the connection. */
  const [revealed, setRevealed] = useState(false);
  const onConnected = useRef(props.onConnected);
  onConnected.current = props.onConnected;

  const check = useCallback(async (byHand: boolean) => {
    if (byHand) setChecking(true);
    const ok = await claudeCodeConnected();
    if (byHand) {
      setChecking(false);
      setCheckedOnce(true);
    }
    setConnected((was) => {
      if (ok && !was) onConnected.current?.();
      return ok;
    });
  }, []);

  const onShownChange = props.onShownChange;
  useEffect(() => {
    onShownChange?.(!!connected || revealed);
  }, [connected, revealed, onShownChange]);

  useEffect(() => {
    if (connected) return;
    if (connected === null) {
      check(false);
      return;
    }
    const started = Date.now();
    const timer = window.setInterval(() => {
      if (Date.now() - started > POLL_FOR_MS) {
        window.clearInterval(timer);
        return;
      }
      if (!document.hidden) check(false);
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [connected, check]);

  return (
    <section className="autocheck" aria-live="polite">
      {props.heading}
      {connected || revealed ? (
        <>
          {connected ? (
            <p className="status">
              <span className="led" aria-hidden="true" />
              Claude Code is connected to dearkarl.
            </p>
          ) : (
            <p className="status bad">
              <span className="led" aria-hidden="true" />
              Not connected yet — the prompt's first step checks that, and
              stops if dearkarl isn't reachable.
            </p>
          )}
          <p className="small">
            Now paste this prompt into Claude Code. It sets up a small hook, so
            every session starts by telling you what arrived, and checks again
            every {CHECK_EVERY_MINUTES} minutes while you work. Claude shows you
            the hook before saving it; the check only lists file names and
            opens nothing unless you ask.
          </p>
          <p className="small">
            The hook is a short script you can read first:{" "}
            <a href={CHECK_SCRIPT_URL} target="_blank" rel="noopener">
              dearkarl-check.sh ↗
            </a>
          </p>
          <div className="copyrow">
            <pre className="mono prompt">{AUTO_CHECK_PROMPT}</pre>
            <CopyButton text={AUTO_CHECK_PROMPT} label="Copy prompt" />
          </div>
        </>
      ) : (
        <div className="notice waiting">
          <p className="status bad">
            <span className="led" aria-hidden="true" />
            {connected === null
              ? "Checking whether Claude Code is connected…"
              : "Waiting for Claude Code to connect…"}
          </p>
          {props.waitingHint ?? null}
          <p className="small" style={{ marginBottom: 10 }}>
            Paste the line into your terminal, then start a new Claude Code
            session. As soon as it reaches dearkarl this page notices by
            itself and shows the next step: a prompt that has Claude check for
            new mail on its own.
          </p>
          <button
            className="btn ghost btn-sm"
            type="button"
            onClick={() => check(true)}
            disabled={checking}
          >
            {checking ? "Checking…" : "Check now"}
          </button>{" "}
          <button
            className="linkbtn small"
            type="button"
            onClick={() => setRevealed(true)}
            style={{ marginLeft: 8 }}
          >
            Reveal anyway
          </button>
          {checkedOnce && !checking && connected === false && (
            <span className="small" style={{ marginLeft: 10 }}>
              Not yet. In Claude Code, <code>/mcp</code> should list{" "}
              <code>dearkarl</code> as connected.
            </span>
          )}
        </div>
      )}
    </section>
  );
}
