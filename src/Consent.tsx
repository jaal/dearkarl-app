import React, { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import {
  answerConsent,
  CONSENT_OPEN_EVENT,
  readConsent,
  startAnalytics,
  type ConsentAnswer,
} from "./analytics";

// The dialog has to be answered: no close button, Escape does nothing, and the
// page behind it is inert until then. Both answers look the same, so neither is
// the "easy" one. On /privacy and /terms it is a non-blocking bar instead, so
// the notice can be read before deciding.
const LEGAL = /^\/(privacy|terms|polityka-prywatnosci|regulamin)$/;

export default function Consent(): React.JSX.Element {
  const ref = useRef<HTMLDialogElement>(null);
  const { pathname } = useLocation();
  const legalPage = LEGAL.test(pathname);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const ask = () => {
      if (dialog.open) {
        // Moving between a legal page and another: switch bar <-> modal.
        dialog.close();
      }
      if (legalPage) dialog.show();
      else dialog.showModal?.();
    };
    const answered = readConsent();
    if (answered === "yes") startAnalytics();
    else if (answered === null) ask();

    // An answer is the only way out: Escape is swallowed, and if the browser
    // closes the dialog anyway, it reopens.
    const onCancel = (e: Event) => e.preventDefault();
    const onClose = () => {
      if (readConsent() === null) ask();
    };
    dialog.addEventListener("cancel", onCancel);
    dialog.addEventListener("close", onClose);
    window.addEventListener(CONSENT_OPEN_EVENT, ask);
    return () => {
      dialog.removeEventListener("cancel", onCancel);
      dialog.removeEventListener("close", onClose);
      window.removeEventListener(CONSENT_OPEN_EVENT, ask);
    };
  }, [legalPage]);

  const answer = (a: ConsentAnswer) => {
    const reload = answerConsent(a);
    ref.current?.close();
    if (reload) location.reload();
  };

  return (
    <dialog className="dk consent" ref={ref} aria-labelledby="consent-title">
      <p className="consent-title" id="consent-title">
        Can we count your visit?
      </p>
      <p>
        We use PostHog analytics to see which pages get read and where readers
        come from. If you say yes, it also recognises this browser on your next
        visit, using a cookie. If you say no, nothing is sent and nothing is
        stored on your device. You can change your mind any time under{" "}
        <em>Cookie settings</em>.{" "}
        <a href="/privacy">Details</a>
      </p>
      <div className="consent-btns">
        <button className="btn sm" type="button" onClick={() => answer("yes")}>
          Yes
        </button>
        <button className="btn sm" type="button" onClick={() => answer("no")}>
          No
        </button>
      </div>
    </dialog>
  );
}
