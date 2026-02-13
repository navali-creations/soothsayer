const LoadingAlert = () => {
  return (
    <div className="alert alert-soft alert-info bg-base-200 mb-4">
      <span className="loading loading-spinner loading-sm"></span>
      <span>Fetching latest prices from poe.ninja...</span>
    </div>
  );
};

export default LoadingAlert;
