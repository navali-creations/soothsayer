interface SetupHeaderProps {
  title?: string;
  description?: string;
}

const SetupHeader = ({
  title = "Welcome to Soothsayer",
  description = "Let's get you set up in just a few steps",
}: SetupHeaderProps) => {
  return (
    <div className="mb-8">
      <h1 className="text-3xl font-bold text-base-content mb-2">{title}</h1>
      <p className="text-base-content/60">{description}</p>
    </div>
  );
};

export default SetupHeader;
