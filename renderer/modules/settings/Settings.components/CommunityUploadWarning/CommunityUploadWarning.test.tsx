import type { ComponentProps } from "react";

import type { CommunityDropContextUploadStatus } from "~/main/modules/community-upload/CommunityUpload.dto";
import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";
import type { BoundStore } from "~/renderer/store/store.types";

import CommunityUploadWarning from "./CommunityUploadWarning";

vi.mock("~/renderer/store", async () => {
  const { createStoreMock } = await import(
    "~/renderer/__test-setup__/store-mock"
  );
  return createStoreMock();
});

vi.mock("~/renderer/components", () => ({
  Link: ({
    to,
    search,
    children,
    ...props
  }: ComponentProps<"a"> & { to: string; search?: { tab?: string } }) => (
    <a href={search?.tab ? `${to}?tab=${search.tab}` : to} {...props}>
      {children}
    </a>
  ),
}));

function setupWarning(
  uploadWarning?: CommunityDropContextUploadStatus["uploadWarning"],
  enabled = true,
) {
  vi.mocked(useBoundStore).mockReturnValue({
    settings: { communityUploadsEnabled: enabled },
    communityUpload: {
      dropContextUploadStatus: {
        pendingEvents: 0,
        isUploading: false,
        revision: 1,
        uploadWarning,
      },
    },
  } as unknown as BoundStore);
}

describe("CommunityUploadWarning", () => {
  it("stays hidden when no contributions are blocked", () => {
    setupWarning();
    const { container } = renderWithProviders(<CommunityUploadWarning />);
    expect(container).toBeEmptyDOMElement();
  });

  it("stays hidden when community sharing is disabled", () => {
    setupWarning("verification-required", false);
    renderWithProviders(<CommunityUploadWarning />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("explains how to resume card-count uploads without any pending context", () => {
    setupWarning("verification-required");
    renderWithProviders(<CommunityUploadWarning />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Link the GGG account previously used to verify these contributions",
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Your card history is saved on this device.",
    );
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("explains when queued contributions belong to a different account", () => {
    setupWarning("account-mismatch");
    renderWithProviders(<CommunityUploadWarning />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "These contributions belong to a different GGG account.",
    );
  });

  it("offers a settings link in the app banner", () => {
    setupWarning("verification-required");
    renderWithProviders(<CommunityUploadWarning showSettingsLink />);
    expect(
      screen.getByRole("link", { name: "Settings → Privacy" }),
    ).toHaveAttribute("href", "/settings?tab=privacy");
  });
});
