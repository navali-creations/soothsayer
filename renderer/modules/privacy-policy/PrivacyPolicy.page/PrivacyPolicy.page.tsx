import { useEffect, useState } from "react";

import { MarkdownRenderer, PageContainer } from "~/renderer/components";

const PRIVACY_MD_URL =
  "https://raw.githubusercontent.com/navali-creations/soothsayer/refs/heads/master/PRIVACY.md";

const PrivacyPolicyPage = () => {
  const [content, setContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchPrivacyPolicy = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(PRIVACY_MD_URL);

        if (!response.ok) {
          throw new Error(
            `Failed to fetch privacy policy (${response.status})`,
          );
        }

        const text = await response.text();

        if (!cancelled) {
          setContent(text);
          setIsLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError((err as Error).message);
          setIsLoading(false);
        }
      }
    };

    fetchPrivacyPolicy();

    return () => {
      cancelled = true;
    };
  }, []);

  if (isLoading) {
    return (
      <PageContainer>
        <PageContainer.Header title="Privacy Policy" subtitle="Loading..." />
        <PageContainer.Content>
          <div className="flex items-center justify-center h-full">
            <span className="loading loading-spinner loading-lg text-primary" />
          </div>
        </PageContainer.Content>
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer>
        <PageContainer.Header title="Privacy Policy" subtitle="Error" />
        <PageContainer.Content>
          <div className="flex items-center justify-center h-full">
            <div className="alert alert-error max-w-md">
              <span>{error}</span>
            </div>
          </div>
        </PageContainer.Content>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageContainer.Header
        title="Privacy Policy"
        subtitle="How Soothsayer handles your data"
      />
      <PageContainer.Content>
        <div className="flex-1 overflow-y-auto px-2 pb-8">
          <MarkdownRenderer>{content ?? ""}</MarkdownRenderer>
        </div>
      </PageContainer.Content>
    </PageContainer>
  );
};

export default PrivacyPolicyPage;
