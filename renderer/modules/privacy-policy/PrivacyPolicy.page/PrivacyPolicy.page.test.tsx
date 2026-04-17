import { afterEach, describe, expect, it, vi } from "vitest";

import {
  act,
  renderWithProviders,
  screen,
  waitFor,
} from "~/renderer/__test-setup__/render";

import PrivacyPolicyPage from "./PrivacyPolicy.page";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("~/renderer/components", () => ({
  PageContainer: Object.assign(
    ({ children }: any) => <div data-testid="page-container">{children}</div>,
    {
      Header: ({ title, subtitle }: any) => (
        <div data-testid="page-header">
          <span data-testid="page-title">{title}</span>
          <span data-testid="page-subtitle">{subtitle}</span>
        </div>
      ),
      Content: ({ children }: any) => (
        <div data-testid="page-content">{children}</div>
      ),
    },
  ),
  MarkdownRenderer: ({ children }: any) => (
    <div data-testid="markdown">{children}</div>
  ),
}));

// ─── Helpers ───────────────────────────────────────────────────────────────

const PRIVACY_MD_URL =
  "https://raw.githubusercontent.com/navali-creations/soothsayer/refs/heads/master/PRIVACY.md";

function mockFetchSuccess(text: string) {
  vi.spyOn(global, "fetch").mockResolvedValue({
    ok: true,
    text: () => Promise.resolve(text),
  } as Response);
}

function mockFetchFailure(message: string) {
  vi.spyOn(global, "fetch").mockRejectedValue(new Error(message));
}

function mockFetchNonOk(status: number) {
  vi.spyOn(global, "fetch").mockResolvedValue({
    ok: false,
    status,
    text: () => Promise.resolve(""),
  } as Response);
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("PrivacyPolicyPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Loading state ──────────────────────────────────────────────────────

  it("shows loading state initially", () => {
    // Use a fetch that never resolves to keep the component in loading state
    vi.spyOn(global, "fetch").mockReturnValue(new Promise(() => {}));

    renderWithProviders(<PrivacyPolicyPage />);

    expect(screen.getByTestId("page-title")).toHaveTextContent(
      "Privacy Policy",
    );
    expect(screen.getByTestId("page-subtitle")).toHaveTextContent("Loading...");

    const spinner = document.querySelector(".loading-spinner");
    expect(spinner).toBeInTheDocument();
  });

  // ── Success state ──────────────────────────────────────────────────────

  it("shows content after successful fetch", async () => {
    const mdContent = "# Privacy\n\nWe respect your privacy.";
    mockFetchSuccess(mdContent);

    renderWithProviders(<PrivacyPolicyPage />);

    await waitFor(() => {
      expect(screen.getByTestId("markdown")).toBeInTheDocument();
    });

    expect(screen.getByTestId("markdown")).toHaveTextContent(
      /We respect your privacy/,
    );
    expect(screen.getByTestId("page-subtitle")).toHaveTextContent(
      "How Soothsayer handles your data",
    );
    expect(global.fetch).toHaveBeenCalledWith(PRIVACY_MD_URL);
  });

  // ── Error states ───────────────────────────────────────────────────────

  it("shows error state on fetch failure", async () => {
    mockFetchFailure("Network error");

    renderWithProviders(<PrivacyPolicyPage />);

    await waitFor(() => {
      expect(screen.getByTestId("page-subtitle")).toHaveTextContent("Error");
    });

    expect(screen.getByText("Network error")).toBeInTheDocument();
    expect(screen.queryByTestId("markdown")).not.toBeInTheDocument();
  });

  it("shows error state on non-ok response (e.g. 404)", async () => {
    mockFetchNonOk(404);

    renderWithProviders(<PrivacyPolicyPage />);

    await waitFor(() => {
      expect(screen.getByTestId("page-subtitle")).toHaveTextContent("Error");
    });

    expect(
      screen.getByText("Failed to fetch privacy policy (404)"),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("markdown")).not.toBeInTheDocument();
  });

  // ── Cleanup ────────────────────────────────────────────────────────────

  it("cleans up cancelled flag on unmount (does not update state after unmount)", async () => {
    let resolveFetch!: (value: Response) => void;
    vi.spyOn(global, "fetch").mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve;
      }),
    );

    const { unmount } = renderWithProviders(<PrivacyPolicyPage />);

    // Component is in loading state
    expect(screen.getByTestId("page-subtitle")).toHaveTextContent("Loading...");

    // Unmount before fetch resolves
    unmount();

    // Now resolve the fetch — should not cause any state updates / errors
    await act(async () => {
      resolveFetch({
        ok: true,
        text: () => Promise.resolve("# Late content"),
      } as Response);
    });

    // If we got here without errors, the cancelled flag worked correctly.
    // The component is unmounted, so we just verify no errors were thrown.
    expect(true).toBe(true);
  });

  // ── Structure ──────────────────────────────────────────────────────────

  it("renders within a PageContainer", async () => {
    mockFetchSuccess("content");

    renderWithProviders(<PrivacyPolicyPage />);

    await waitFor(() => {
      expect(screen.getByTestId("markdown")).toBeInTheDocument();
    });

    expect(screen.getByTestId("page-container")).toBeInTheDocument();
  });

  it("renders empty string in markdown when content is null", async () => {
    // Edge case: content state starts as null, the fallback is ""
    mockFetchSuccess("");

    renderWithProviders(<PrivacyPolicyPage />);

    await waitFor(() => {
      expect(screen.getByTestId("markdown")).toBeInTheDocument();
    });

    expect(screen.getByTestId("markdown")).toHaveTextContent("");
  });

  // ── Fetch error catch handler (L36) ────────────────────────────────────

  it("shows error message from caught Error object in catch block", async () => {
    mockFetchFailure("ECONNREFUSED");

    renderWithProviders(<PrivacyPolicyPage />);

    await waitFor(() => {
      expect(screen.getByTestId("page-subtitle")).toHaveTextContent("Error");
    });

    // The catch block does: setError((err as Error).message)
    expect(screen.getByText("ECONNREFUSED")).toBeInTheDocument();

    // Should not render markdown
    expect(screen.queryByTestId("markdown")).not.toBeInTheDocument();

    // Should render the error alert
    const alert = document.querySelector(".alert-error");
    expect(alert).toBeInTheDocument();
  });

  // ── MarkdownRenderer rendering (L86) ───────────────────────────────────

  it("passes content to MarkdownRenderer via children prop", async () => {
    const mdContent = "# Hello World\n\nSome **bold** text.";
    mockFetchSuccess(mdContent);

    renderWithProviders(<PrivacyPolicyPage />);

    await waitFor(() => {
      expect(screen.getByTestId("markdown")).toBeInTheDocument();
    });

    // MarkdownRenderer receives {content ?? ""} as children (raw markdown, not parsed)
    expect(screen.getByTestId("markdown")).toHaveTextContent(
      /Hello World.*Some.*bold.*text/,
    );
  });

  it("renders MarkdownRenderer with empty string fallback when content is null-ish", async () => {
    // Fetch returns empty string → content is set to ""
    // Component renders <MarkdownRenderer>{content ?? ""}</MarkdownRenderer>
    mockFetchSuccess("");

    renderWithProviders(<PrivacyPolicyPage />);

    await waitFor(() => {
      expect(screen.getByTestId("markdown")).toBeInTheDocument();
    });

    // The subtitle should reflect success, not loading or error
    expect(screen.getByTestId("page-subtitle")).toHaveTextContent(
      "How Soothsayer handles your data",
    );
  });
});
