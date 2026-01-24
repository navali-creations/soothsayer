import clsx from "clsx";
import type { ChangeEvent, InputHTMLAttributes } from "react";
import { FiSearch } from "react-icons/fi";

interface SearchProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "size"> {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  size?: "xs" | "sm" | "md" | "lg";
}

const Search = ({
  value,
  onChange,
  placeholder = "Search...",
  className,
  size = "md",
  ...props
}: SearchProps) => {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange?.(e.target.value);
  };

  return (
    <label
      className={clsx(
        "input input-bordered flex items-center gap-2",
        {
          "input-xs": size === "xs",
          "input-sm": size === "sm",
          "input-md": size === "md",
          "input-lg": size === "lg",
        },
        className,
      )}
    >
      <FiSearch className="opacity-70" />
      <input
        type="text"
        className="grow"
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        {...props}
      />
    </label>
  );
};

export default Search;
