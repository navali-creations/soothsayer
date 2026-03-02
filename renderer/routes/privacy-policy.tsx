import { createFileRoute } from "@tanstack/react-router";

import { PrivacyPolicyPage } from "../modules/privacy-policy";

export const Route = createFileRoute("/privacy-policy")({
  component: PrivacyPolicyPage,
});
