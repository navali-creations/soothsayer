import clsx from "clsx";
import {
  type ChangeEvent,
  type InputHTMLAttributes,
  useEffect,
  useRef,
  useState,
} from "react";
import { FiSearch } from "react-icons/fi";

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
  hasIcon?: boolean;
}

const Search = ({
  value: externalValue,
  onChange,
  placeholder = "Search...",
  className,
  size = "md",
  debounceMs,
  hasIcon = true,
  ...props
}: SearchProps) => {
  const isDebounced = debounceMs !== undefined;
  const [internalValue, setInternalValue] = useState(externalValue ?? "");
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
        // Fire onChange at normal priority so the global filter update
        // commits immediately rather than being deferred by React's
        // concurrent scheduler.  Previously this was wrapped in
        // startTransition which made the update low-priority — under CPU
        // contention (CI, heavy useEffect chains on the Rarity Insights
        // page) React would defer the commit indefinitely, causing the
        // table's globalFilter prop to stay stale while the search input
        // already showed the new value.
        onChange?.(newValue);
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
      {hasIcon && <FiSearch className="opacity-70" />}
      <input
        type="search"
        className="grow"
        placeholder={placeholder}
        value={isDebounced ? internalValue : externalValue}
        onChange={handleChange}
        {...props}
      />
    </label>
  );
};

export default Search;
