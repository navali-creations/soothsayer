import { FiFolder } from "react-icons/fi";
import { Button, Flex } from "../../../components";
import type { FilePathCategory } from "../Settings.types";

interface FilePathSettingCardProps {
  category: FilePathCategory;
}

const FilePathSettingCard = ({ category }: FilePathSettingCardProps) => {
  return (
    <div className="card bg-base-100 shadow-xl h-full">
      <div className="card-body">
        <h2 className="card-title">{category.title}</h2>
        <p className="text-sm text-base-content/60">{category.description}</p>

        <div className="space-y-4 mt-4">
          {category.settings.map((setting) => (
            <div key={setting.key} className="form-control w-full">
              <label className="label">
                <span className="label-text">{setting.label}</span>
              </label>
              <Flex className="gap-2">
                <input
                  type="text"
                  className="input input-bordered flex-1"
                  value={setting.value || ""}
                  readOnly
                  placeholder={setting.placeholder}
                />
                <Button variant="primary" onClick={setting.onSelect}>
                  <FiFolder />
                </Button>
              </Flex>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default FilePathSettingCard;
