import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";

import DropContextConsent from "./DropContextConsent";

vi.mock("~/renderer/store", async () => {
  const { createStoreMock } = await import(
    "~/renderer/__test-setup__/store-mock"
  );
  return createStoreMock();
});

const setConsent = vi.fn();
const fetchConsent = vi.fn();

function setupStore(overrides = {}, uploadsEnabled = true) {
  vi.mocked(useBoundStore).mockReturnValue({
    settings: { communityUploadsEnabled: uploadsEnabled },
    communityUpload: {
      dropContextConsent: null,
      dropContextConsentLoaded: true,
      isSavingDropContextConsent: false,
      dropContextConsentError: null,
      fetchDropContextConsent: fetchConsent,
      setDropContextConsent: setConsent,
      ...overrides,
    },
  } as ReturnType<typeof useBoundStore>);
}

describe("DropContextConsent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupStore();
  });

  it("starts unchecked and explains time, game areas, and history", () => {
    renderWithProviders(<DropContextConsent />);
    expect(
      screen.getByRole("checkbox", {
        name: "Opening Times & Areas",
      }),
    ).not.toBeChecked();
    const disclosure = screen.getByText(/^Share the local minute of day/);
    expect(disclosure).toHaveTextContent("UTC offset");
    expect(disclosure).toHaveTextContent("not your real-world location");
    expect(disclosure).toHaveTextContent("earlier openings");
    expect(
      screen.getByRole("link", { name: "https://wraeclast.cards/" }),
    ).toHaveAttribute("href", "https://wraeclast.cards/");
    expect(
      screen.getByText("These times show time-of-day patterns.").tagName,
    ).toBe("STRONG");
    expect(setConsent).not.toHaveBeenCalled();
    expect(
      screen.queryByText(/You can change this choice in Settings/),
    ).not.toBeInTheDocument();
  });

  it("requires a deliberate toggle to opt in", async () => {
    const { user } = renderWithProviders(<DropContextConsent />);
    await user.click(screen.getByRole("checkbox"));
    expect(setConsent).toHaveBeenCalledWith(true);
  });

  it("lets the user withdraw a previously saved choice", async () => {
    setupStore({ dropContextConsent: true });
    const { user } = renderWithProviders(<DropContextConsent />);
    expect(screen.getByRole("checkbox")).toBeChecked();
    await user.click(screen.getByRole("checkbox"));
    expect(setConsent).toHaveBeenCalledWith(false);
  });

  it.each([
    { dropContextConsentLoaded: false },
    { isSavingDropContextConsent: true },
  ])("disables the checkbox while loading or saving: %j", (overrides) => {
    setupStore(overrides);
    renderWithProviders(<DropContextConsent />);
    expect(screen.getByRole("checkbox")).toBeDisabled();
  });

  it("hides the entire option while community uploads are disabled", () => {
    setupStore({}, false);
    const { container } = renderWithProviders(<DropContextConsent />);
    expect(container).toBeEmptyDOMElement();
  });

  it("hides saved consent too while community uploads are disabled", () => {
    setupStore({ dropContextConsent: true }, false);
    const { container } = renderWithProviders(<DropContextConsent />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows a failed load and offers retry", async () => {
    setupStore({
      dropContextConsentLoaded: false,
      dropContextConsentError: "Could not load sharing preference",
    });
    const { user } = renderWithProviders(<DropContextConsent />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Could not load sharing preference",
    );
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(fetchConsent).toHaveBeenCalledTimes(2);
  });
});
