import { useBoundStore } from "~/renderer/store";

export const OverlaySidebar = () => {
  const {
    overlay: { isLeftHalf },
  } = useBoundStore();

  return (
    <div className="flex items-start justify-center bg-gradient-to-b from-base-300 from-50% to-transparent cursor-default select-none">
      <span
        className="pt-1 text-sm font-semibold tracking-wider whitespace-nowrap text-base-content/50"
        style={{
          writingMode: isLeftHalf ? "sideways-lr" : "vertical-rl",
          textOrientation: "sideways",
        }}
      >
        soothsayer
      </span>
    </div>
  );
};
