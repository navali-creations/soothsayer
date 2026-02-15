import { FiLoader } from "react-icons/fi";

const ComparisonEmptyState = () => {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center space-y-2">
        <FiLoader className="w-12 h-12 mx-auto text-base-content/30" />
        <h3 className="text-lg font-semibold text-base-content/70">
          Select filters to compare
        </h3>
        <p className="text-sm text-base-content/50 max-w-sm">
          Choose one or more filters from the sidebar to see how they categorize
          divination card rarities.
        </p>
      </div>
    </div>
  );
};

export default ComparisonEmptyState;
