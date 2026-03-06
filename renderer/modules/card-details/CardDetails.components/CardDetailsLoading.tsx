import { PageContainer } from "~/renderer/components";

/**
 * Full-page loading state for the card details page.
 * Shown while the card is being resolved from the URL slug.
 */
const CardDetailsLoading = () => {
  return (
    <PageContainer>
      <PageContainer.Header title="Card Details" />
      <PageContainer.Content>
        <div className="flex items-center justify-center h-64">
          <span className="loading loading-spinner loading-lg" />
        </div>
      </PageContainer.Content>
    </PageContainer>
  );
};

export default CardDetailsLoading;
