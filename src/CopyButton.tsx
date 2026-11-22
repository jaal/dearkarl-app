import React, { useState } from "react";

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

/** Copies `text`; shows a tick for a moment after it worked. `inline` sits
    in a line of text instead of the corner of a copy box. */
export function CopyButton(props: {
  text: string;
  label?: string;
  inline?: boolean;
}): React.JSX.Element {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(props.text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard may be unavailable; the text stays selectable.
    }
  };

  return (
    <button
      className={props.inline ? "copybtn copybtn-inline" : "copybtn"}
      type="button"
      aria-label={copied ? "Copied" : (props.label ?? "Copy")}
      title={copied ? "Copied" : (props.label ?? "Copy")}
      data-copied={copied ? "1" : undefined}
      onClick={copy}
    >
      <CopySheetsIcon />
      <CopyTickIcon />
    </button>
  );
}
