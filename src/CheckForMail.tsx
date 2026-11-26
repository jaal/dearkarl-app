import React, { useState } from "react";
import { AutoCheck } from "./AutoCheck";
import { STEP_COUNT, Steps } from "./Steps";

/**
 * Onboarding step 4: once Claude Code has reached /mcp with the line from
 * step 3, hand over the prompt that has it check for new mail by itself.
 * Optional, so it can be skipped; the account page offers it again.
 */
function CheckForMail(props: { onDone: () => void }): React.JSX.Element {
  const [shown, setShown] = useState(false);

  return (
    <>
      <Steps current={4} />

      <div className="card narrow">
        <p className="eyebrow">Step {STEP_COUNT} of {STEP_COUNT} · optional</p>
        <h1>Let Claude check for new mail</h1>
        <p className="lede">
          One more paste, and Claude tells you what arrived each time you start
          working, without you asking.
        </p>

        <AutoCheck heading={null} onShownChange={setShown} />

        <div className="btn-row">
          {shown ? (
            <button className="btn" data-attr="checkmail-done" onClick={props.onDone}>
              Done
            </button>
          ) : (
            <button className="btn ghost" data-attr="checkmail-skip" onClick={props.onDone}>
              Skip for now
            </button>
          )}
        </div>

        <div className="later-note">
          <b>You can come back to this.</b> The same prompt is on your account
          page, under Connect Claude.
        </div>
      </div>
    </>
  );
}

export default CheckForMail;
