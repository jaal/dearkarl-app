import React from "react";
import LegalDoc from "./LegalDoc";
import { termsEn, termsPl } from "./termsBody";

export default function Terms(): React.JSX.Element {
  return (
    <LegalDoc
      metaTitle="Regulamin / Terms of service — dearkarl"
      description="Zasady korzystania z dearkarl. The terms for using dearkarl."
      pl={{ title: "Regulamin", body: termsPl }}
      en={{ title: "Terms of Service", body: termsEn }}
    />
  );
}
