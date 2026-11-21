import React from "react";
import Base from "./Base";
import usePageMeta from "./usePageMeta";
import useSignedIn from "./useSignedIn";
import { SITE, refs, plain } from "./site";

// One list feeds both the visible questions and the FAQPage schema, so the
// structured data can never claim an answer the page does not show.
const FAQ = [
  {
    q: "What is dearkarl?",
    a: `<p>${SITE.description}</p>
        <p>We can run it for you: sign in with Google and you get your own address in a
        minute, free while it is new. It is also open source, so you can run it yourself on
        your own Cloudflare account.</p>`,
  },
  {
    q: "Isn't this just the Gmail connector?",
    a: `<p>No, and the difference is the whole point. The Gmail connector needs access to your
        <em>entire mailbox</em>, and it searches — it pulls whatever it thinks is relevant.</p>
        <p>Karl only ever sees what you deliberately forwarded. It is a curated channel, not a
        search over your private mail, and it works with any provider, not just Gmail.</p>`,
  },
  {
    q: "What can Karl actually see?",
    a: `<p>One folder in your Drive — the one he created. He cannot see the rest of your
        Drive, cannot list it, and cannot open a file he did not write. The permission is
        Google's <code>drive.file</code> scope; you can look it up.</p>
        <p>He never asks for your mailbox, and no permission we request could read one.</p>`,
  },
  {
    q: "Where does my mail actually live?",
    a: `<p>In <b>your own Google Drive</b>, as plain markdown files. Our server receives the
        message, turns it into a text file, and writes it straight into the folder it made for
        you — holding it in memory for a few seconds on the way and never writing it to a disk
        of ours.</p>
        <p>If Karl cannot write to your Drive, he tells you by email instead of keeping the
        message. There is no queue on our side: that is the trade for us keeping nothing.</p>`,
  },
  {
    q: "What happens if I leave?",
    a: `<p>You keep everything. The notes are plain text files in your own Drive — no format
        of ours, no account of ours needed to read them. Turn off forwarding and it stops;
        nothing reaches back into what was already written.</p>
        <p>You can also delete your account from your account page. Your address stops
        working, Karl loses access to your Drive, and we remove what we hold. The files stay
        in your Drive.</p>`,
  },
  {
    q: "Does this page track me?",
    a: `<p>No. There are no analytics, no tracking or ad cookies, and nothing loads from
        anyone else — not even the fonts. The only cookie is the one that keeps you signed in,
        and it exists only after you sign in.</p>`,
  },
  {
    q: 'Why "Karl"?',
    a: `<p>Because it tells you how to use it: <em>just email it to Karl.</em></p>
        <p>Karl is the mailman. He always delivers — and he never reads your post and never
        keeps a copy. The only mail he writes is short notes: to you, that a message is saved,
        and to a stranger, that your address is not theirs to write to.</p>
        <p>That is not a personality we gave him. It is the architecture.</p>`,
  },
];

const graph = [
  {
    "@type": "SoftwareApplication",
    "@id": `${SITE.url}/#app`,
    name: SITE.name,
    url: SITE.url,
    description: SITE.description,
    applicationCategory: "ProductivityApplication",
    operatingSystem: "Any (email); Claude Code on macOS, Linux or Windows",
    license: "https://opensource.org/licenses/MIT",
    codeRepository: SITE.repo,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      description: "Self-hosted, open source",
    },
    publisher: { "@id": refs.org },
  },
  {
    "@type": "FAQPage",
    "@id": `${SITE.url}/#faq`,
    mainEntity: FAQ.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: plain(f.a) },
    })),
  },
];

function StepIcon({ kind }: { kind: string }): React.JSX.Element {
  switch (kind) {
    case "ochre":
      return (
        <svg className="ico f-ochre" viewBox="0 0 32 32" aria-hidden="true">
          <circle className="f" cx="11" cy="16" r="6" />
          <circle cx="11" cy="16" r="2" />
          <path d="M17 16h11M24 16v4M27 16v3" />
        </svg>
      );
    case "clay":
      return (
        <svg className="ico f-clay" viewBox="0 0 32 32" aria-hidden="true">
          <rect className="f" x="4" y="8" width="24" height="17" rx="1.5" />
          <path d="m4.5 9 11.5 9 11.5-9" />
        </svg>
      );
    case "sage":
      return (
        <svg className="ico f-sage" viewBox="0 0 32 32" aria-hidden="true">
          <rect className="f" x="4" y="6" width="24" height="20" rx="1.5" />
          <path d="M4 11h24M9 16l3 2.5L9 21M15 21h6" />
        </svg>
      );
    default:
      return (
        <svg className="ico f-slate" viewBox="0 0 32 32" aria-hidden="true">
          <path className="f" d="M4 15 28 5l-6 22-7-8z" />
          <path d="m15 19 13-14M15 19v7l3.5-4" />
        </svg>
      );
  }
}

export default function Home(): React.JSX.Element {
  const cta = useSignedIn() ? "Go to my account" : "Create your free address";
  usePageMeta({
    title: "dearkarl — email anything to your AI",
    description:
      "Forward an email to your own secret address, and your next Claude session opens knowing it arrived. Your AI never sees your mailbox.",
    graph,
  });

  return (
    <Base
      title="dearkarl — email anything to your AI"
      description="Forward an email to your own secret address, and your next Claude session opens knowing it arrived. Your AI never sees your mailbox."
    >
      <div className="hero">
        <h1>Email anything to your AI.</h1>
        <p className="lede">
          Forward an article, a note you dictated, a receipt — and your next
          Claude session opens knowing it arrived. Your AI never sees your
          mailbox. Only what you send it.
        </p>
        <div className="hero-cta">
          <a className="btn" href="/app">
            {cta}
          </a>
          <a className="cta-note" href="#faq">
            Have privacy questions or doubts? Read the answers ↓
          </a>
        </div>
      </div>

      <div className="lead-card">
        <h2>What happens when you sign up</h2>
        <ol className="prereq steps-list">
          <li>
            <b>Sign in with Google.</b> You approve one folder in your Drive,
            nothing else.
          </li>
          <li>
            <b>You get your address</b>, like{" "}
            <code>claude-olek-x7k2m9@in.dearkarl.com</code>.
          </li>
          <li>
            <b>You paste one line into Claude Code.</b> It connects Karl over
            MCP with your own token.
          </li>
          <li>
            <b>You forward something.</b> Your next Claude session sees it.
          </li>
        </ol>
        <a className="btn" href="/app">
          {cta}
        </a>
      </div>

      <div className="alt-card">
        <h3>Prefer to run it yourself? It works today.</h3>
        <p className="small">
          The whole pipe runs on your own accounts — free, unlimited, forever.
          No server of ours sits in the path, so there is nothing of ours to
          trust. You need a domain on Cloudflare (about $10 a year), a GitHub
          account, and about fifteen minutes with Claude Code.
        </p>
        <a className="btn ghost sm" href="https://github.com/jaal/dearkarl">
          Self-host it free →
        </a>
      </div>

      <section className="lp-sec" id="how">
        <h2>
          <span className="g" aria-hidden="true">
            ✺
          </span>
          How it works
        </h2>
        <p className="lede">
          Four steps. You do the first three once, then it runs.
        </p>
        <ol className="walk">
          <li>
            <StepIcon kind="ochre" />
            <h4>Sign in with Google</h4>
            <p>
              One approval. Karl makes a folder in your Drive and can see that
              folder and nothing else — not the rest of your Drive, and never
              your mailbox.
            </p>
          </li>
          <li>
            <StepIcon kind="clay" />
            <h4>Karl hands you an address</h4>
            <p>
              Something like <code>claude-olek-x7k2m9@in.dearkarl.com</code>. It is
              yours and it is secret. Only mail from addresses you have named
              gets through; anything else is turned away, not saved.
            </p>
          </li>
          <li>
            <StepIcon kind="sage" />
            <h4>Connect Claude Code over MCP</h4>
            <p>
              Karl is an MCP server. You run one <code>claude mcp add</code>{" "}
              command with a personal token we generate for you, and Claude Code
              can list and read the files in your Karl folder — nothing else.
              Nothing is downloaded, and you can revoke the token on your
              account page at any time.
            </p>
          </li>
          <li>
            <StepIcon kind="slate" />
            <h4>Forward anything, from anywhere</h4>
            <p>
              An article on your phone, a note you dictated walking home, a
              receipt. It becomes a text file in your Drive folder within
              seconds, and your next Claude session opens knowing it arrived.
            </p>
          </li>
        </ol>
      </section>

      <section className="lp-sec" id="faq">
        <h2>
          <span className="g" aria-hidden="true">
            ◆
          </span>
          Questions
        </h2>
        <div className="faq">
          {FAQ.map((f) => (
            <details key={f.q}>
              <summary>{f.q}</summary>
              <div className="a" dangerouslySetInnerHTML={{ __html: f.a }} />
            </details>
          ))}
        </div>
      </section>

    </Base>
  );
}
