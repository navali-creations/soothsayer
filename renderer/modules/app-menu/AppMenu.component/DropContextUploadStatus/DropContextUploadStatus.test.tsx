import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";

import DropContextUploadStatus from "./DropContextUploadStatus";

vi.mock("~/renderer/store", async () => {
  const { createStoreMock } = await import(
    "~/renderer/__test-setup__/store-mock"
  );
  return createStoreMock();
});

vi.mock("react-icons/fi", () => ({
  FiClock: (props: any) => <svg data-testid="clock-icon" {...props} />,
  FiUploadCloud: (props: any) => (
    <svg data-testid="upload-cloud-icon" {...props} />
  ),
}));

const mockUseBoundStore = vi.mocked(useBoundStore);

function setupStatus(pendingEvents: number, isUploading: boolean) {
  mockUseBoundStore.mockReturnValue({
    communityUpload: {
      dropContextUploadStatus: {
        pendingEvents,
        isUploading,
        revision: 1,
      },
    },
  } as any);
}

describe("DropContextUploadStatus", () => {
  it("stays hidden when the outbox is empty", () => {
    setupStatus(0, false);

    const { container } = renderWithProviders(<DropContextUploadStatus />);

    expect(container.innerHTML).toBe("");
  });

  it("shows upload progress with a formatted remaining count", () => {
    setupStatus(4_500, true);

    renderWithProviders(<DropContextUploadStatus />);

    expect(
      screen.getByText("Uploading card history: 4,500 remaining"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("upload-cloud-icon")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
  });

  it("shows queued context that is waiting for a retry", () => {
    setupStatus(250, false);

    renderWithProviders(<DropContextUploadStatus />);

    expect(
      screen.getByText("Card history upload queued: 250 remaining"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("clock-icon")).toBeInTheDocument();
  });
});
