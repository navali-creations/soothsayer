import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";

import DropContextConsentBanner from "./DropContextConsentBanner";

vi.mock("~/renderer/store", async () => {
  const { createStoreMock } = await import(
    "~/renderer/__test-setup__/store-mock"
  );
  return createStoreMock();
});

const setConsent = vi.fn();

function setupStore(
  consent: boolean | null = null,
  loaded = true,
  enabled = true,
) {
  vi.mocked(useBoundStore).mockReturnValue({
    settings: { communityUploadsEnabled: enabled },
    communityUpload: {
      dropContextConsent: consent,
      dropContextConsentLoaded: loaded,
      isSavingDropContextConsent: false,
      fetchDropContextConsent: vi.fn(),
      setDropContextConsent: setConsent,
    },
  } as ReturnType<typeof useBoundStore>);
}

describe("DropContextConsentBanner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupStore();
  });

  it("asks existing card contributors for a separate choice without granting consent", () => {
    renderWithProviders(<DropContextConsentBanner />);
    expect(
      screen.getByRole("region", { name: /Choose whether to share/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Agree", exact: true }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Disagree", exact: true }),
    ).toBeEnabled();
    expect(setConsent).not.toHaveBeenCalled();
    expect(
      screen.getByText(/You can change this choice in Settings/),
    ).toBeInTheDocument();
  });

  it("saves opt-in only after Agree is clicked", async () => {
    const { user } = renderWithProviders(<DropContextConsentBanner />);
    await user.click(
      screen.getByRole("button", { name: "Agree", exact: true }),
    );
    expect(setConsent).toHaveBeenCalledWith(true);
  });

  it("lets the user disagree and keep times and areas private", async () => {
    const { user } = renderWithProviders(<DropContextConsentBanner />);
    await user.click(
      screen.getByRole("button", { name: "Disagree", exact: true }),
    );
    expect(setConsent).toHaveBeenCalledWith(false);
  });

  it.each([true, false])("hides after saving the choice %j", (consent) => {
    setupStore(consent);
    const { container } = renderWithProviders(<DropContextConsentBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it("waits for the saved preference to load", () => {
    setupStore(null, false);
    const { container } = renderWithProviders(<DropContextConsentBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it("does not prompt users who disabled community uploads", () => {
    setupStore(null, true, false);
    const { container } = renderWithProviders(<DropContextConsentBanner />);
    expect(container).toBeEmptyDOMElement();
  });
});
