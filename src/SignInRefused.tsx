import React from "react";
import { Steps } from "./Steps";

/** The self-hosting guide; the home page links the same place. */
const SELF_HOST_URL = "https://github.com/jaal/dearkarl";

/** `driveUnticked`: they approved sign-in but left Google's Drive checkbox
    empty, so there is still nowhere for their mail to go. */
function SignInRefused(props: {
  onRetry: () => void;
  driveUnticked?: boolean;
}): React.JSX.Element {
  return (
    <>
      <Steps current={1} />

      <div className="card narrow">
        {props.driveUnticked ? (
          <>
            <h1>Drive access wasn't ticked</h1>
            <p className="lede">No account was made, and nothing was stored.</p>
            <p>
              Google shows Drive access as a separate checkbox, and it was left
              empty. Try again and tick it: Karl only sees the files it creates
              in its own folder.
            </p>
          </>
        ) : (
          <>
            <h1>You didn't approve it</h1>
            <p className="lede">No account was made, and nothing was stored.</p>
          </>
        )}
        <p>
          Karl needs to write into a folder somewhere, and Google Drive is the
          only destination we support today. Without that approval there is
          nowhere for your mail to go.
        </p>

        <div className="btn-row">
          <button className="btn" onClick={props.onRetry}>
            Try again
          </button>
          <a className="btn ghost" href={SELF_HOST_URL}>
            Self-host instead
          </a>
        </div>

        <p className="small" style={{ marginTop: 16 }}>
          Self-hosting runs the same pipe on your own infrastructure — free,
          complete, no account with us. It needs a domain and a GitHub account,
          and takes about fifteen minutes.
        </p>
      </div>
    </>
  );
}

export default SignInRefused;
