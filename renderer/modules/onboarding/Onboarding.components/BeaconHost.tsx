import { Beacons } from "@repere/react";
import { useLocation } from "@tanstack/react-router";

import { useOnboardingState } from "~/renderer/store";

import { onboardingConfig } from "../onboarding-config/onboarding-config";

type BeaconHostProps = {
  enabled: boolean;
};

const BeaconHost = ({ enabled }: BeaconHostProps) => {
  const location = useLocation();
  const { beaconHostRefreshKey } = useOnboardingState();

  return (
    <Beacons
      key={beaconHostRefreshKey}
      config={onboardingConfig}
      currentPath={location.pathname}
      enabled={enabled}
    />
  );
};

export default BeaconHost;
