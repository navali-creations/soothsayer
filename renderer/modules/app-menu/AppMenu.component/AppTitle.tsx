import { Flex } from "~/renderer/components";

import pkgJson from "../../../../package.json" with { type: "json" };

const AppTitle = () => {
  return (
    <Flex className="gap-2">
      <p className="font-bold select-none">soothsayer</p>
      <div className="badge badge-soft badge-sm mt-0.5">v{pkgJson.version}</div>
    </Flex>
  );
};

export default AppTitle;
