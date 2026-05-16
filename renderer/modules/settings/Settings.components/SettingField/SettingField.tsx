import type { ChangeEvent } from "react";

import type { Setting } from "../../Settings.types";

interface SettingFieldProps {
  setting: Setting;
}

const SettingField = ({ setting }: SettingFieldProps) => {
  if (setting.hidden) return null;

  if (setting.type === "select") {
    const handleSelectChange = (event: ChangeEvent<HTMLSelectElement>) => {
      setting.onChange(event.target.value);
    };

    return (
      <div className="grid gap-3 py-3 md:grid-cols-[1fr_minmax(12rem,16rem)] md:items-center">
        <label className="text-sm font-medium text-base-content/70">
          {setting.label}
        </label>
        <select
          className="select select-bordered select-sm w-full"
          value={setting.value}
          onChange={handleSelectChange}
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
    const handleToggleChange = (event: ChangeEvent<HTMLInputElement>) => {
      setting.onChange(event.target.checked);
    };

    return (
      <div className="py-3">
        <label className="flex cursor-pointer items-center justify-between gap-4">
          <span className="text-sm font-medium text-base-content/70">
            {setting.label}
          </span>
          <input
            type="checkbox"
            className="toggle toggle-sm toggle-primary"
            checked={setting.value}
            onChange={handleToggleChange}
          />
        </label>
      </div>
    );
  }

  if (setting.type === "text") {
    const handleTextChange = (event: ChangeEvent<HTMLInputElement>) => {
      setting.onChange(event.target.value);
    };

    return (
      <div className="grid gap-3 py-3 md:grid-cols-[1fr_minmax(12rem,16rem)] md:items-center">
        <label className="text-sm font-medium text-base-content/70">
          {setting.label}
        </label>
        <input
          type="text"
          className="input input-bordered input-sm w-full"
          value={setting.value}
          placeholder={setting.placeholder}
          onChange={handleTextChange}
        />
      </div>
    );
  }

  if (setting.type === "slider") {
    const handleSliderChange = (event: ChangeEvent<HTMLInputElement>) => {
      setting.onChange(parseFloat(event.target.value));
    };

    const displayValue = setting.formatValue
      ? setting.formatValue(setting.value)
      : `${Math.round(setting.value * 100)}%`;

    return (
      <div className="py-3">
        <label className="mb-2 flex items-center justify-between gap-3">
          <span className="text-sm font-medium text-base-content/70">
            {setting.label}
          </span>
          <span className="font-mono text-xs text-base-content/60">
            {displayValue}
          </span>
        </label>
        <input
          type="range"
          className="range range-primary range-xs"
          min={setting.min}
          max={setting.max}
          step={setting.step}
          value={setting.value}
          onChange={handleSliderChange}
        />
      </div>
    );
  }

  return null;
};

export default SettingField;
