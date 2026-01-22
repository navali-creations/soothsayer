import clsx from "clsx";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant =
  | "primary"
  | "secondary"
  | "accent"
  | "ghost"
  | "link"
  | "info"
  | "success"
  | "warning"
  | "error";

type ButtonSize = "lg" | "md" | "sm" | "xs";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children?: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  outline?: boolean;
  wide?: boolean;
  block?: boolean;
  circle?: boolean;
  square?: boolean;
  glass?: boolean;
  loading?: boolean;
  disabled?: boolean;
  active?: boolean;
  soft?: boolean;
  className?: string;
}

const Button = ({
  children,
  variant,
  size,
  outline = false,
  wide = false,
  block = false,
  circle = false,
  square = false,
  glass = false,
  loading = false,
  disabled = false,
  active = false,
  soft = false,
  className,
  ...props
}: ButtonProps) => {
  return (
    <button
      className={clsx(
        "no-drag",
        "btn",
        variant && `btn-${variant}`,
        size && `btn-${size}`,
        {
          "btn-outline": outline,
          "btn-soft": soft,
          "btn-wide": wide,
          "btn-block": block,
          "btn-circle": circle,
          "btn-square": square,
          glass: glass,
          loading: loading,
          "btn-active": active,
        },
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;
