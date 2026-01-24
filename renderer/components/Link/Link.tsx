import { createLink, type LinkComponent } from "@tanstack/react-router";
import clsx from "clsx";
import React from "react";

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

interface BaseLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  asButton?: boolean;
  variant?: ButtonVariant;
  size?: ButtonSize;
  outline?: boolean;
  wide?: boolean;
  block?: boolean;
  circle?: boolean;
  square?: boolean;
  glass?: boolean;
  active?: boolean;
}

const BaseLinkComponent = React.forwardRef<HTMLAnchorElement, BaseLinkProps>(
  (
    {
      children,
      asButton = false,
      variant,
      size,
      outline = false,
      wide = false,
      block = false,
      circle = false,
      square = false,
      glass = false,
      active = false,
      className,
      ...props
    },
    ref,
  ) => {
    const classes = asButton
      ? clsx(
          "no-drag",
          "btn",
          variant && `btn-${variant}`,
          size && `btn-${size}`,
          {
            "btn-outline": outline,
            "btn-wide": wide,
            "btn-block": block,
            "btn-circle": circle,
            "btn-square": square,
            glass: glass,
            "btn-active": active,
          },
          className,
        )
      : className;

    return (
      <a ref={ref} {...props} className={classes}>
        {children}
      </a>
    );
  },
);

BaseLinkComponent.displayName = "BaseLinkComponent";

const CreatedLinkComponent = createLink(BaseLinkComponent);

export const Link: LinkComponent<typeof BaseLinkComponent> = (props) => {
  return <CreatedLinkComponent preload="intent" {...props} />;
};

export default Link;
