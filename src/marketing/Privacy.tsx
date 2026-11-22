import React from "react";
import LegalDoc from "./LegalDoc";
import { privacyEn, privacyPl } from "./privacyBody";

export default function Privacy(): React.JSX.Element {
  return (
    <LegalDoc
      metaTitle="Polityka prywatności / Privacy notice — dearkarl"
      description="Jakie dane przetwarza dearkarl i po co. What data dearkarl processes, and why."
      pl={{ title: "Polityka prywatności", body: privacyPl }}
      en={{ title: "Privacy notice & imprint", body: privacyEn }}
    />
  );
}
