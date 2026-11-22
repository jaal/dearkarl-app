import { useEffect, useState } from "react";
import { ApiPaths, isSessionStatus } from "../../shared/api";

// One request per page load, shared by every component that asks.
let pending: Promise<boolean> | null = null;

function fetchSignedIn(): Promise<boolean> {
  pending ??= fetch(ApiPaths.session, { credentials: "same-origin" })
    .then((r) => (r.ok ? r.json() : null))
    .then((body) => isSessionStatus(body) && body.signedIn)
    .catch(() => false);
  return pending;
}

/** True once we know this browser has a dearkarl session. Starts false, so a
    signed-out visitor never sees "My account" flash. */
export default function useSignedIn(): boolean {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    let live = true;
    fetchSignedIn().then((v) => live && setSignedIn(v));
    return () => {
      live = false;
    };
  }, []);
  return signedIn;
}

/** For tests: forget the cached answer. */
export function resetSignedIn(): void {
  pending = null;
}
