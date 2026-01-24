import type { Setting } from "../Settings.types";

interface SettingFieldProps {
  setting: Setting;
}

const SettingField = ({ setting }: SettingFieldProps) => {
  if (setting.hidden) return null;

  if (setting.type === "select") {
    return (
      <div className="form-control">
        <label className="label">
          <span className="label-text">{setting.label}</span>
        </label>
        <select
          className="select select-bordered w-full"
          value={setting.value}
          onChange={(e) => setting.onChange(e.target.value as any)}
        >
          {setting.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (setting.type === "toggle") {
    return (
      <div className="form-control">
        <label className="label cursor-pointer justify-start gap-4">
          <span className="label-text flex-1">{setting.label}</span>
          <input
            type="checkbox"
            className="toggle toggle-primary"
            checked={setting.value}
            onChange={(e) => setting.onChange(e.target.checked)}
          />
        </label>
      </div>
    );
  }

  if (setting.type === "text") {
    return (
      <div className="form-control">
        <label className="label">
          <span className="label-text">{setting.label}</span>
        </label>
        <input
          type="text"
          className="input input-bordered w-full"
          value={setting.value}
          placeholder={setting.placeholder}
          onChange={(e) => setting.onChange(e.target.value)}
        />
      </div>
    );
  }

  return null;
};

export default SettingField;
