import { GiCardExchange } from "react-icons/gi";

export const OverlayEmpty = () => {
  return (
    <div className="flex items-center justify-center h-full bg-base-300/0 backdrop-blur-sm">
      <div className="text-center p-6">
        <GiCardExchange className="text-6xl mx-auto mb-4 text-base-content/50" />
        <h2 className="text-xl font-bold mb-2">No Active Session</h2>
        <p className="text-sm text-base-content/70">
          Start a session to see live stats
        </p>
      </div>
    </div>
  );
};
