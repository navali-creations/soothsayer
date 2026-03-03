import { FiExternalLink } from "react-icons/fi";

import { PageContainer } from "~/renderer/components";

const ATTRIBUTIONS = [
  {
    name: "Prohibited Library",
    description:
      "Divination card drop weight data sourced from community-maintained research.",
    url: "https://docs.google.com/spreadsheets/d/1PmGES_e1on6K7O5ghHuoorEjruAVb7dQ5m7PGrW7t80/edit?gid=272334906#gid=272334906",
  },
  {
    name: "poe.ninja",
    description: "Pricing and economy data for Path of Exile items.",
    url: "https://poe.ninja/",
  },
  {
    name: "PoE Wiki",
    description: "Divination card information and images.",
    url: "https://www.poewiki.net/wiki/Divination_card",
  },
] as const;

const AttributionsPage = () => {
  return (
    <PageContainer>
      <PageContainer.Header
        title="Attributions"
        subtitle="Credit to the third-party data sources that make this app possible."
      />
      <PageContainer.Content>
        <div className="flex-1 overflow-y-auto px-2 pb-8">
          <div className="flex flex-col gap-4 max-w-2xl">
            {ATTRIBUTIONS.map((attribution) => (
              <a
                key={attribution.name}
                href={attribution.url}
                target="_blank"
                rel="noopener noreferrer"
                className="card bg-base-200 border border-transparent hover:border-info transition-colors cursor-pointer no-underline"
              >
                <div className="card-body p-5">
                  <div className="flex items-center justify-between">
                    <h3 className="card-title text-base text-base-content">
                      {attribution.name}
                    </h3>
                    <FiExternalLink
                      size={14}
                      className="text-base-content/50 shrink-0"
                    />
                  </div>
                  <p className="text-sm text-base-content/70 m-0">
                    {attribution.description}
                  </p>
                </div>
              </a>
            ))}
          </div>
        </div>
      </PageContainer.Content>
    </PageContainer>
  );
};

export default AttributionsPage;
