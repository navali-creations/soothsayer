interface CardNameProps {
  name: string;
}

/**
 * Displays the card name in the ribbon area
 */
export function CardName({ name }: CardNameProps) {
  return (
    <div className="absolute z-30 top-2.5 flex justify-center w-full">
      <span className="text-gray-900 font-fontin text-[20px] max-w-[215px]">
        {name}
      </span>
    </div>
  );
}
