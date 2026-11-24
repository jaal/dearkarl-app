import React from "react";

const STEPS = ["Sign in", "Your address", "Connect Claude Code", "Check for mail"];
export const STEP_COUNT = STEPS.length;

/** The onboarding progress bar; `current` is 1-based. */
export function Steps(props: { current: number }): React.JSX.Element {
  return (
    <nav className="steps" aria-label="Progress">
      <ol>
        {STEPS.map((label, i) => {
          const n = i + 1;
          const cls = n < props.current ? "done" : n === props.current ? "on" : undefined;
          return (
            <React.Fragment key={label}>
              {i > 0 && <li className="sep" aria-hidden="true" />}
              <li
                className={cls}
                aria-current={n === props.current ? "step" : undefined}
              >
                <span className="n">{n}</span>
                <span>{label}</span>
              </li>
            </React.Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
