// PostHog analytics behind a consent dialog (decisions/0012 in the lab),
// ported unchanged from the old dearkarl.com (src/components/Analytics.astro).
//
// Nothing runs before "Yes": PostHog is not even initialised, so no event
// leaves the page and nothing is read from or written to the device except the
// answer itself (localStorage.dk_consent). After "Yes": a first-party cookie +
// localStorage visitor ID, 365 days, and visit/tab IDs in sessionStorage. "No"
// after a "Yes" deletes that ID; the privacy notice (§5) promises it.
//
// Off for good, in code and in the PostHog project: session replay, surveys,
// heatmaps, scroll depth, identify(). Turning any of them on needs a new
// amendment, not a commit.
//
// Events go to /k/ on this origin (worker/index.ts forwards them to PostHog's
// EU cloud), so the CSP stays script-src 'self' / connect-src 'self'.
import posthog from "posthog-js";

// The project key is public by design: it can send events, not read them.
const TOKEN = "phc_CMCqANN993C6xKYbSVk6nCCS8e6pRU8fG33VFUE8xrZA";
export const CONSENT_KEY = "dk_consent";
/** Fired by the footer's "Cookie settings" to ask again. */
export const CONSENT_OPEN_EVENT = "dk:consent-open";

// Storage can be blocked (private modes, strict settings); never let that
// break the page. If it is, the dialog simply asks again next time.
const read = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const write = (k: string, v: string | null) => {
  try {
    if (v === null) localStorage.removeItem(k);
    else localStorage.setItem(k, v);
  } catch {
    /* blocked storage: ask again next time */
  }
};

export type ConsentAnswer = "yes" | "no";

export function readConsent(): ConsentAnswer | null {
  const v = read(CONSENT_KEY);
  return v === "yes" || v === "no" ? v : null;
}

// Olek's own browsers: ?internal tags every event, ?internal=off stops it.
// Same convention as his other sites; the project filters is_internal out.
function internalBrowser(): boolean {
  const q = new URLSearchParams(location.search);
  if (q.has("internal")) write("ph_internal", q.get("internal") === "off" ? null : "1");
  return read("ph_internal") === "1";
}

// Only query parameters worth reading are kept in the URLs PostHog stores;
// anything else (an OAuth code, an address, a token) a link might carry is
// dropped.
const KEEP = /^utm_|^ref$/;
function cleanUrl(url: unknown) {
  if (typeof url !== "string" || !url.includes("?")) return url;
  try {
    const u = new URL(url);
    for (const key of [...u.searchParams.keys()]) if (!KEEP.test(key)) u.searchParams.delete(key);
    return u.toString();
  } catch {
    return url;
  }
}

let started = false;
export function startAnalytics(): void {
  if (started) return;
  started = true;
  const internal = internalBrowser();
  posthog.init(TOKEN, {
    api_host: "/k",
    ui_host: "https://eu.posthog.com",
    persistence: "localStorage+cookie",
    person_profiles: "identified_only",
    // A single-page app: count each route change as a page view.
    capture_pageview: "history_change",
    disable_session_recording: true,
    disable_surveys: true,
    disable_scroll_properties: true,
    capture_heatmaps: false,
    // before_send, not register(): it also catches the initial $pageview.
    before_send: (event) => {
      if (!event) return event;
      const p = event.properties;
      for (const k of ["$current_url", "$referrer", "$session_entry_url", "$session_entry_referrer"]) {
        if (k in p) p[k] = cleanUrl(p[k]);
      }
      if (internal) p.is_internal = true;
      return event;
    },
  });
}

// Delete everything a "Yes" stored: PostHog's cookie (set on the parent
// domain by default, so try both) and every ph_<token>_* key in localStorage
// and sessionStorage (visitor ID, visit and tab IDs).
function forget() {
  const prefix = `ph_${TOKEN}_`;
  for (const store of [localStorage, sessionStorage]) {
    try {
      for (const key of Object.keys(store)) if (key.startsWith(prefix)) store.removeItem(key);
    } catch {
      /* blocked storage holds nothing to delete */
    }
  }
  for (const domain of ["", `; domain=.${location.hostname.replace(/^www\./, "")}`]) {
    document.cookie = `${prefix}posthog=; Max-Age=0; path=/${domain}`;
  }
}

/** Store the answer and act on it. Returns true when the page must reload
    (a withdrawn "Yes": no PostHog instance may stay alive). */
export function answerConsent(answer: ConsentAnswer): boolean {
  const before = readConsent();
  write(CONSENT_KEY, answer);
  if (answer === "yes") {
    startAnalytics();
    return false;
  }
  if (before === "yes") {
    // Stop PostHog writing (it saves again on unload otherwise), then wipe.
    if (started) posthog.set_config({ disable_persistence: true });
    forget();
    return true;
  }
  return false;
}
