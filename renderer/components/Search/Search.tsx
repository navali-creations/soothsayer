import clsx from "clsx";
import {
  type ChangeEvent,
  type InputHTMLAttributes,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { FiRefreshCw, FiSearch } from "react-icons/fi";

interface SearchProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "size"> {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  size?: "xs" | "sm" | "md" | "lg";
  /** When set, Search manages its own internal state for instant character
   *  display and debounces the `onChange` callback by this many milliseconds. */
  debounceMs?: number;
}

const Search = ({
  value: externalValue,
  onChange,
  placeholder = "Search...",
  className,
  size = "md",
  debounceMs,
  ...props
}: SearchProps) => {
  const isDebounced = debounceMs !== undefined;
  const [internalValue, setInternalValue] = useState(externalValue ?? "");
  const [isPending, startTransition] = useTransition();
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    return () => clearTimeout(timerRef.current);
  }, []);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;

    if (isDebounced) {
      setInternalValue(newValue);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        startTransition(() => {
          onChange?.(newValue);
        });
      }, debounceMs);
    } else {
      onChange?.(newValue);
    }
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
      {isPending ? (
        <FiRefreshCw className="opacity-70 animate-spin" />
      ) : (
        <FiSearch className="opacity-70" />
      )}
      <input
        type="search"
        className="grow"
        placeholder={placeholder}
        value={isDebounced ? internalValue : externalValue}
        onChange={handleChange}
        disabled={isPending}
        {...props}
      />
    </label>
  );
};

export default Search;
