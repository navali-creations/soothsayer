import { useNavigate } from "@tanstack/react-router";

import { PageContainer } from "~/renderer/components";

interface CardDetailsErrorProps {
  /** Error message to display, or null to show a generic "Card not found" message. */
  error: string | null;
}

/**
 * Full-page error state for the card details page.
 * Shown when the card slug doesn't match any card or when resolution fails.
 */
const CardDetailsError = ({ error }: CardDetailsErrorProps) => {
  const navigate = useNavigate();

  return (
    <PageContainer>
      <PageContainer.Header title="Card Details" />
      <PageContainer.Content>
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <p className="text-xl text-base-content/60">
            {error ?? "Card not found"}
          </p>
          <button
            className="btn btn-primary"
            onClick={() => navigate({ to: "/cards" })}
          >
            Back to Cards
          </button>
        </div>
      </PageContainer.Content>
    </PageContainer>
  );
};

export default CardDetailsError;
