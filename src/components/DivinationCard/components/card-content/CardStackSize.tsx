interface CardStackSizeProps {
  count: number;
  stackSize: number;
}

/**
 * Displays the stack size counter
 */
export function CardStackSize({ count, stackSize }: CardStackSizeProps) {
  return (
    <div className="absolute z-30 top-[218px] left-[31px] w-[52px] h-[30px] flex items-center justify-center">
      <span className="text-white font-fontin text-[19px]">
        {count}/{stackSize}
      </span>
    </div>
  );
}
