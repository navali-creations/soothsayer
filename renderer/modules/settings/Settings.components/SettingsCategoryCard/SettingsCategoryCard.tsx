import type { SettingsCategory } from "../../Settings.types";
import SettingField from "../SettingField/SettingField";

interface SettingsCategoryCardProps {
  category: SettingsCategory;
}

const SettingsCategoryCard = ({ category }: SettingsCategoryCardProps) => {
  return (
    <section className="space-y-3">
      <p className="sr-only">{category.description}</p>

      <div className="divide-y divide-base-content/10">
        {category.settings.map((setting) => (
          <SettingField key={setting.key} setting={setting} />
        ))}
      </div>
    </section>
  );
};

export default SettingsCategoryCard;
