import clsx from "clsx";

import { Link } from "~/renderer/components";
import { cardNameToSlug } from "~/renderer/utils";

interface CardNameLinkProps {
  cardName: string;
  className?: string;
}

/**
 * Base styles always applied to every CardNameLink:
 *
 *   truncate font-fontin hover:text-primary transition-colors underline decoration-dotted
 *
 * Pass `className` to add extra classes on top (e.g. `font-semibold`).
 * To opt out of a base style, pass its Tailwind "undo" (e.g. `no-underline`).
 */
const BASE_CLASS =
  "truncate font-fontin hover:text-primary transition-colors underline decoration-dotted";

const CardNameLink = ({ cardName, className }: CardNameLinkProps) => {
  return (
    <Link
      to="/cards/$cardSlug"
      params={{ cardSlug: cardNameToSlug(cardName) }}
      className={clsx(BASE_CLASS, className)}
    >
      {cardName}
    </Link>
  );
};

export default CardNameLink;
