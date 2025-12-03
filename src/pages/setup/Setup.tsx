import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { usePoeLeagues } from "../../hooks";

const SetupPage = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [poe1ClientTxtPath, setPoe1ClientTxtPath] = useState<string>("");
  const [poe2ClientTxtPath, setPoe2ClientTxtPath] = useState<string>("");
  const [verificationCode, setVerificationCode] = useState<string>("");
  const [userInput, setUserInput] = useState<string>("");
  const [isVerified, setIsVerified] = useState(false);
  const [isWatching, setIsWatching] = useState(false);

  const { leagues, selectedLeague, setSelectedLeague, isLoadingLeagues } =
    usePoeLeagues();

  // Generate random 6-character verification code
  useEffect(() => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setVerificationCode(code);
  }, []);

  const handlePoe1FileSelect = async () => {
    try {
      const filePath = await window.electron.selectFile({
        title: "Select Path of Exile 1 Client.txt",
        filters: [{ name: "Text Files", extensions: ["txt"] }],
        properties: ["openFile"],
      });

      if (filePath) {
        setPoe1ClientTxtPath(filePath);
      }
    } catch (error) {
      console.error("Error selecting file:", error);
      alert("Failed to select file. Please try again.");
    }
  };

  const handlePoe2FileSelect = async () => {
    try {
      const filePath = await window.electron.selectFile({
        title: "Select Path of Exile 2 Client.txt",
        filters: [{ name: "Text Files", extensions: ["txt"] }],
        properties: ["openFile"],
      });

      if (filePath) {
        setPoe2ClientTxtPath(filePath);
      }
    } catch (error) {
      console.error("Error selecting file:", error);
      alert("Failed to select file. Please try again.");
    }
  };

  const handleNextStep = () => {
    if (currentStep === 1) {
      setIsWatching(true);
    }
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      if (currentStep === 2) {
        setIsWatching(false);
        setIsVerified(false);
      }
    }
  };

  const handleVerify = () => {
    if (userInput.toUpperCase() === verificationCode) {
      setIsVerified(true);
      handleNextStep();
    } else {
      alert("Verification code does not match. Please try again.");
    }
  };

  const handleComplete = async () => {
    try {
      // Save the client.txt paths using the new API
      await window.electron.clientTxtPaths.set({
        poe1: poe1ClientTxtPath || undefined,
        poe2: poe2ClientTxtPath || undefined,
      });

      // Navigate to main view using TanStack Router
      navigate({ to: "/" });
    } catch (error) {
      console.error("Error saving configuration:", error);
      alert("Failed to save configuration. Please try again.");
    }
  };

  const hasAtLeastOnePath = poe1ClientTxtPath || poe2ClientTxtPath;

  return (
    <div className="min-h-screen bg-base-200 flex items-center justify-center p-4">
      <div className="card w-full max-w-2xl bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title text-3xl mb-6 justify-center">
            Soothsayer Setup
          </h2>

          {/* Steps Indicator */}
          <ul className="steps steps-horizontal w-full mb-8">
            <li className={`step ${currentStep >= 0 ? "step-primary" : ""}`}>
              League
            </li>
            <li className={`step ${currentStep >= 1 ? "step-primary" : ""}`}>
              Files
            </li>
            <li className={`step ${currentStep >= 2 ? "step-primary" : ""}`}>
              Verify
            </li>
            <li className={`step ${currentStep >= 3 ? "step-primary" : ""}`}>
              Complete
            </li>
          </ul>

          {/* Step Content */}
          <div className="min-h-[300px]">
            {/* Step 0: League Selection */}
            {currentStep === 0 && (
              <div className="space-y-4">
                <h3 className="text-xl font-semibold">Select Your League</h3>
                <p className="text-base-content/70">
                  Choose the Path of Exile league you're currently playing. This
                  will be used to fetch accurate pricing data for divination
                  cards.
                </p>

                {isLoadingLeagues ? (
                  <div className="flex items-center justify-center py-12">
                    <span className="loading loading-spinner loading-lg"></span>
                  </div>
                ) : (
                  <div className="form-control w-full">
                    <label className="label">
                      <span className="label-text">Active League</span>
                    </label>
                    <select
                      className="select select-bordered select-primary w-full"
                      value={selectedLeague}
                      onChange={(e) => setSelectedLeague(e.target.value)}
                    >
                      {leagues.map((league) => (
                        <option key={league.id} value={league.id}>
                          {league.name}
                          {league.endAt &&
                            ` (ends ${new Date(league.endAt).toLocaleDateString()})`}
                        </option>
                      ))}
                    </select>
                    <label className="label">
                      <span className="label-text-alt">
                        You can change this later in settings
                      </span>
                    </label>
                  </div>
                )}

                {selectedLeague && (
                  <div className="alert alert-info">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      className="stroke-current shrink-0 w-6 h-6"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      ></path>
                    </svg>
                    <div className="flex flex-col">
                      <span className="font-semibold">
                        Selected: {selectedLeague}
                      </span>
                      <span className="text-sm">
                        Divination card prices will be fetched for this league
                      </span>
                    </div>
                  </div>
                )}

                <div className="card-actions justify-end mt-6">
                  <button
                    className="btn btn-primary"
                    onClick={handleNextStep}
                    disabled={!selectedLeague || isLoadingLeagues}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}

            {/* Step 1: File Selection */}
            {currentStep === 1 && (
              <div className="space-y-4">
                <h3 className="text-xl font-semibold">
                  Select Client.txt Files
                </h3>
                <p className="text-base-content/70">
                  Select the Client.txt file(s) for the Path of Exile version(s)
                  you play.
                  <strong> At least one path is required.</strong> You can
                  configure both now or edit paths later in settings.
                </p>

                {/* PoE 1 */}
                <div className="form-control w-full">
                  <label className="label">
                    <span className="label-text">
                      Path of Exile 1 - Client.txt (Optional)
                    </span>
                  </label>
                  <div className="join w-full">
                    <input
                      type="text"
                      className="input input-bordered input-primary join-item flex-1"
                      value={poe1ClientTxtPath}
                      readOnly
                      placeholder="No file selected"
                    />
                    <button
                      className="btn btn-primary join-item"
                      onClick={handlePoe1FileSelect}
                    >
                      Browse
                    </button>
                  </div>
                  {poe1ClientTxtPath && (
                    <label className="label">
                      <span className="label-text-alt text-success">
                        ✓ PoE1 file selected
                      </span>
                    </label>
                  )}
                </div>

                {/* PoE 2 */}
                <div className="form-control w-full">
                  <label className="label">
                    <span className="label-text">
                      Path of Exile 2 - Client.txt (Optional)
                    </span>
                  </label>
                  <div className="join w-full">
                    <input
                      type="text"
                      className="input input-bordered input-primary join-item flex-1"
                      value={poe2ClientTxtPath}
                      readOnly
                      placeholder="No file selected"
                    />
                    <button
                      className="btn btn-primary join-item"
                      onClick={handlePoe2FileSelect}
                    >
                      Browse
                    </button>
                  </div>
                  {poe2ClientTxtPath && (
                    <label className="label">
                      <span className="label-text-alt text-success">
                        ✓ PoE2 file selected
                      </span>
                    </label>
                  )}
                </div>

                <div className="alert">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    className="stroke-info shrink-0 w-6 h-6"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    ></path>
                  </svg>
                  <div className="text-sm">
                    <p className="font-semibold">Typical locations:</p>
                    <ul className="list-disc list-inside mt-1 space-y-1">
                      <li>
                        <strong>PoE1 Steam:</strong> C:\Program Files
                        (x86)\Steam\steamapps\common\Path of
                        Exile\logs\Client.txt
                      </li>
                      <li>
                        <strong>PoE1 Standalone:</strong> C:\Program Files
                        (x86)\Grinding Gear Games\Path of Exile\logs\Client.txt
                      </li>
                      <li>
                        <strong>PoE2:</strong> Check your PoE2 installation
                        directory\logs\Client.txt
                      </li>
                    </ul>
                  </div>
                </div>

                {!hasAtLeastOnePath && (
                  <div className="alert alert-warning">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="stroke-current shrink-0 h-6 w-6"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      />
                    </svg>
                    <span>
                      Please select at least one Client.txt file to continue
                    </span>
                  </div>
                )}

                <div className="card-actions justify-between mt-6">
                  <button className="btn btn-ghost" onClick={handlePrevStep}>
                    Back
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={handleNextStep}
                    disabled={!hasAtLeastOnePath}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Verification */}
            {currentStep === 2 && (
              <div className="space-y-4">
                <h3 className="text-xl font-semibold">
                  Verify client.txt Access
                </h3>
                <p className="text-base-content/70">
                  To verify that we can access your client.txt file, please type
                  the following code into the Path of Exile in-game chat and
                  press Enter:
                </p>
                <div className="alert alert-info">
                  <div className="flex flex-col items-center w-full gap-2">
                    <span className="font-mono text-2xl font-bold tracking-widest">
                      {verificationCode}
                    </span>
                    <span className="text-sm">
                      Type this in Path of Exile chat and press Enter
                    </span>
                  </div>
                </div>

                {isWatching && !isVerified && (
                  <div className="alert">
                    <div className="flex items-center gap-2">
                      <span className="loading loading-spinner loading-sm"></span>
                      <span>
                        Watching for verification code in client.txt...
                      </span>
                    </div>
                  </div>
                )}

                {isVerified && (
                  <div className="alert alert-success">
                    <div className="flex items-center gap-2">
                      <svg
                        className="w-6 h-6"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      <span>Verification successful!</span>
                    </div>
                  </div>
                )}

                <div className="form-control w-full">
                  <label className="label">
                    <span className="label-text">
                      Or manually enter the verification code:
                    </span>
                  </label>
                  <input
                    type="text"
                    placeholder="Enter code here"
                    className="input input-bordered input-primary w-full"
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value.toUpperCase())}
                    maxLength={6}
                    disabled={isVerified}
                  />
                </div>
                <div className="card-actions justify-between mt-6">
                  <button className="btn btn-ghost" onClick={handlePrevStep}>
                    Back
                  </button>
                  {isVerified ? (
                    <button
                      className="btn btn-primary"
                      onClick={handleNextStep}
                    >
                      Continue
                    </button>
                  ) : (
                    <button
                      className="btn btn-primary"
                      onClick={handleVerify}
                      disabled={userInput.length !== 6}
                    >
                      Verify Manually
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Step 3: Complete */}
            {currentStep === 3 && (
              <div className="space-y-4 text-center">
                <div className="flex justify-center">
                  <svg
                    className="w-24 h-24 text-success"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <h3 className="text-2xl font-semibold">Setup Complete!</h3>
                <p className="text-base-content/70">
                  Your Soothsayer setup is complete. You can now start using the
                  application to enhance your Path of Exile experience.
                </p>

                <div className="stats stats-vertical shadow">
                  <div className="stat">
                    <div className="stat-title">Selected League</div>
                    <div className="stat-value text-lg">{selectedLeague}</div>
                  </div>

                  {poe1ClientTxtPath && (
                    <div className="stat">
                      <div className="stat-title">PoE1 Client.txt Path</div>
                      <div className="stat-value text-sm break-all">
                        {poe1ClientTxtPath}
                      </div>
                    </div>
                  )}

                  {poe2ClientTxtPath && (
                    <div className="stat">
                      <div className="stat-title">PoE2 Client.txt Path</div>
                      <div className="stat-value text-sm break-all">
                        {poe2ClientTxtPath}
                      </div>
                    </div>
                  )}
                </div>

                <div className="alert alert-info">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    className="stroke-current shrink-0 w-6 h-6"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    ></path>
                  </svg>
                  <span className="text-sm">
                    You can change these paths later in the Settings page
                  </span>
                </div>

                <div className="card-actions justify-center mt-6">
                  <button
                    className="btn btn-primary btn-wide"
                    onClick={handleComplete}
                  >
                    Go to Main View
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SetupPage;
