import clsx from "clsx";
import { Fragment, type ReactNode } from "react";

interface SettingsTabItemProps<TTabId extends string> {
  tab: {
    id: TTabId;
    label: string;
    tone?: "danger";
  };
  activeTab: TTabId;
  onSelect: (tabId: TTabId) => void;
  children: ReactNode;
}

export function SettingsTabItem<TTabId extends string>({
  tab,
  activeTab,
  onSelect,
  children,
}: SettingsTabItemProps<TTabId>) {
  const handleChange = () => {
    onSelect(tab.id);
  };

  return (
    <Fragment>
      <input
        type="radio"
        name="settings_tabs"
        role="tab"
        className={clsx(
          "tab h-10 px-4 font-semibold checked:bg-base-300 checked:text-base-content",
          { "text-error": tab.tone === "danger" },
        )}
        aria-label={tab.label}
        checked={activeTab === tab.id}
        onChange={handleChange}
      />
      <div
        role="tabpanel"
        className="tab-content w-full border-base-300 bg-base-200 p-6"
      >
        {children}
      </div>
    </Fragment>
  );
}
