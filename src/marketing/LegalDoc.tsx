import React, { useEffect } from "react";
import { useLocation } from "react-router-dom";
import Base from "./Base";
import Markdown from "./Markdown";
import usePageMeta from "./usePageMeta";

// A bilingual legal document page (privacy, terms): Polish on top (#pl),
// English below (#en). Mail links point at those anchors.

interface LegalVersion {
  title: string;
  body: string;
}

interface LegalDocProps {
  description: string;
  metaTitle: string;
  pl: LegalVersion;
  en: LegalVersion;
}

export default function LegalDoc(props: LegalDocProps): React.JSX.Element {
  usePageMeta({
    title: props.metaTitle,
    description: props.description,
  });

  // React Router does not scroll to a hash on its own.
  const { hash } = useLocation();
  useEffect(() => {
    if (!hash) return;
    document.getElementById(hash.slice(1))?.scrollIntoView();
  }, [hash]);

  return (
    <Base title={props.metaTitle} description={props.description}>
      <article className="doc">
        <p className="langs">
          <a href="#pl">Polski</a> · <a href="#en">English</a>
        </p>
        <section id="pl" lang="pl">
          <h1>{props.pl.title}</h1>
          <Markdown>{props.pl.body}</Markdown>
        </section>
        <hr />
        <section id="en" lang="en">
          <h1>{props.en.title}</h1>
          <Markdown>{props.en.body}</Markdown>
        </section>
      </article>
    </Base>
  );
}
