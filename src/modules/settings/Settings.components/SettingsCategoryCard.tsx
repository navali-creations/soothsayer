import type { SettingsCategory } from "../Settings.types";
import SettingField from "./SettingField";

interface SettingsCategoryCardProps {
  category: SettingsCategory;
}

const SettingsCategoryCard = ({ category }: SettingsCategoryCardProps) => {
  return (
    <div className="card bg-base-100 shadow-xl  h-full">
      <div className="card-body">
        <h2 className="card-title">{category.title}</h2>
        <p className="text-sm text-base-content/60">{category.description}</p>

        <div className="space-y-4 mt-4">
          {category.settings.map((setting) => (
            <SettingField key={setting.key} setting={setting} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default SettingsCategoryCard;
