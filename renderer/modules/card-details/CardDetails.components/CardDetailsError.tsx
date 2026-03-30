import { PageContainer } from "~/renderer/components";
import { BackButton } from "~/renderer/components/BackButton";

interface CardDetailsErrorProps {
  /** Error message to display, or null to show a generic "Card not found" message. */
  error: string | null;
}

/**
 * Full-page error state for the card details page.
 * Shown when the card slug doesn't match any card or when resolution fails.
 */
const CardDetailsError = ({ error }: CardDetailsErrorProps) => {
  return (
    <PageContainer>
      <PageContainer.Header title="Card Details" />
      <PageContainer.Content>
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <p className="text-xl text-base-content/60">
            {error ?? "Card not found"}
          </p>
          <BackButton
            fallback="/cards"
            label="Back to Cards"
            variant="primary"
            size="md"
          />
        </div>
      </PageContainer.Content>
    </PageContainer>
  );
};

export default CardDetailsError;
