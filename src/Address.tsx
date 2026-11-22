import React from "react";
import { CopyButton } from "./CopyButton";
import { formatKarlAddress } from "./karlAddress";

function Address(props: {
  karlEmail: string;
  userEmail: string;
  onNext: () => void;
}): React.JSX.Element {
  const karlAddress = formatKarlAddress(props.karlEmail);


  return (
    <>
      <nav className="steps" aria-label="Progress">
        <ol>
          <li className="done">
            <span className="n">1</span>
            <span>Sign in</span>
          </li>
          <li className="sep" aria-hidden="true" />
          <li className="on">
            <span className="n">2</span>
            <span>Your address</span>
          </li>
          <li className="sep" aria-hidden="true" />
          <li>
            <span className="n">3</span>
            <span>Connect Claude Code</span>
          </li>
        </ol>
      </nav>

      <div className="card narrow">
        <p className="eyebrow">Step 2 of 3</p>
        <h1>This is your address</h1>

        <div className="copyrow">
          <code className="mono address">{karlAddress}</code>
          <CopyButton text={karlAddress} />
        </div>
        <p className="small">
          One click selects the whole line; the icon copies it.
        </p>

        <p>
          Forward anything here. An article, a note you dictated on the way home,
          a receipt. It shows up as a text file in your Drive folder within
          seconds.
        </p>

        <div className="warn">
          <p>
            <b>Keep it to yourself.</b> Only mail from your own addresses gets
            through — anything else is turned away, not saved. That is on by
            default, not a setting.
          </p>
        </div>

        <div className="notice" style={{ marginTop: 18 }}>
          <p style={{ marginBottom: ".6em" }}>
            <b>
              Forward from <code>{props.userEmail}</code>.
            </b>
          </p>
          <p className="small" style={{ marginBottom: 0 }}>
            That is the address you signed in with. Mail from anywhere else is
            turned away before it reaches your Drive.
          </p>
        </div>

        <div className="btn-row" style={{ marginTop: 22 }}>
          <button className="btn" onClick={props.onNext}>
            Next: connect Claude Code
          </button>
        </div>
      </div>
    </>
  );
}

export default Address;
