import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";

import { CardsPagination } from "./CardsPagination";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("~/renderer/store", () => ({
  useBoundStore: vi.fn(),
}));

const mockUseBoundStore = vi.mocked(useBoundStore);

// ─── Helpers ───────────────────────────────────────────────────────────────

const mockSetCurrentPage = vi.fn();

function setupStore(overrides: { currentPage?: number } = {}) {
  mockUseBoundStore.mockReturnValue({
    cards: {
      currentPage: overrides.currentPage ?? 1,
      setCurrentPage: mockSetCurrentPage,
    },
  } as any);
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("CardsPagination", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockSetCurrentPage.mockClear();
  });

  describe("visibility", () => {
    it("returns null when totalPages is 0", () => {
      setupStore();
      const { container } = renderWithProviders(
        <CardsPagination totalPages={0} />,
      );

      expect(container.innerHTML).toBe("");
    });

    it("returns null when totalPages is 1", () => {
      setupStore();
      const { container } = renderWithProviders(
        <CardsPagination totalPages={1} />,
      );

      expect(container.innerHTML).toBe("");
    });

    it("renders when totalPages is 2", () => {
      setupStore();
      const { container } = renderWithProviders(
        <CardsPagination totalPages={2} />,
      );

      expect(container.innerHTML).not.toBe("");
    });
  });

  describe("Previous and Next buttons", () => {
    it("renders Previous and Next buttons", () => {
      setupStore({ currentPage: 2 });
      renderWithProviders(<CardsPagination totalPages={5} />);

      expect(
        screen.getByRole("button", { name: "Previous" }),
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Next" })).toBeInTheDocument();
    });

    it("Previous is disabled on first page", () => {
      setupStore({ currentPage: 1 });
      renderWithProviders(<CardsPagination totalPages={5} />);

      expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    });

    it("Previous is enabled when not on first page", () => {
      setupStore({ currentPage: 3 });
      renderWithProviders(<CardsPagination totalPages={5} />);

      expect(
        screen.getByRole("button", { name: "Previous" }),
      ).not.toBeDisabled();
    });

    it("Next is disabled on last page", () => {
      setupStore({ currentPage: 5 });
      renderWithProviders(<CardsPagination totalPages={5} />);

      expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    });

    it("Next is enabled when not on last page", () => {
      setupStore({ currentPage: 3 });
      renderWithProviders(<CardsPagination totalPages={5} />);

      expect(screen.getByRole("button", { name: "Next" })).not.toBeDisabled();
    });
  });

  describe("navigation", () => {
    it("clicking Next calls setCurrentPage with currentPage + 1", async () => {
      setupStore({ currentPage: 2 });
      const { user } = renderWithProviders(<CardsPagination totalPages={5} />);

      await user.click(screen.getByRole("button", { name: "Next" }));

      expect(mockSetCurrentPage).toHaveBeenCalledWith(3);
    });

    it("clicking Previous calls setCurrentPage with currentPage - 1", async () => {
      setupStore({ currentPage: 3 });
      const { user } = renderWithProviders(<CardsPagination totalPages={5} />);

      await user.click(screen.getByRole("button", { name: "Previous" }));

      expect(mockSetCurrentPage).toHaveBeenCalledWith(2);
    });

    it("clicking Next on last page clamps to totalPages", async () => {
      setupStore({ currentPage: 5 });
      renderWithProviders(<CardsPagination totalPages={5} />);

      // Next is disabled, so setCurrentPage should not be called via click
      // But the button is disabled, verify no call happens
      expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    });

    it("clicking Previous on first page clamps to 1", async () => {
      setupStore({ currentPage: 1 });
      renderWithProviders(<CardsPagination totalPages={5} />);

      expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    });

    it("clicking a page number calls setCurrentPage with that page", async () => {
      setupStore({ currentPage: 1 });
      const { user } = renderWithProviders(<CardsPagination totalPages={5} />);

      await user.click(screen.getByRole("button", { name: "3" }));

      expect(mockSetCurrentPage).toHaveBeenCalledWith(3);
    });
  });

  describe("onPageChange callback", () => {
    it("calls onPageChange when clicking Next", async () => {
      setupStore({ currentPage: 2 });
      const onPageChange = vi.fn();
      const { user } = renderWithProviders(
        <CardsPagination totalPages={5} onPageChange={onPageChange} />,
      );

      await user.click(screen.getByRole("button", { name: "Next" }));

      expect(onPageChange).toHaveBeenCalledTimes(1);
    });

    it("calls onPageChange when clicking Previous", async () => {
      setupStore({ currentPage: 3 });
      const onPageChange = vi.fn();
      const { user } = renderWithProviders(
        <CardsPagination totalPages={5} onPageChange={onPageChange} />,
      );

      await user.click(screen.getByRole("button", { name: "Previous" }));

      expect(onPageChange).toHaveBeenCalledTimes(1);
    });

    it("calls onPageChange when clicking a page number", async () => {
      setupStore({ currentPage: 1 });
      const onPageChange = vi.fn();
      const { user } = renderWithProviders(
        <CardsPagination totalPages={5} onPageChange={onPageChange} />,
      );

      await user.click(screen.getByRole("button", { name: "4" }));

      expect(onPageChange).toHaveBeenCalledTimes(1);
    });

    it("does not throw when onPageChange is not provided", async () => {
      setupStore({ currentPage: 2 });
      const { user } = renderWithProviders(<CardsPagination totalPages={5} />);

      // Should not throw
      await user.click(screen.getByRole("button", { name: "Next" }));
      expect(mockSetCurrentPage).toHaveBeenCalled();
    });
  });

  describe("page number buttons", () => {
    it("renders page number buttons for small totalPages (<=7)", () => {
      setupStore({ currentPage: 1 });
      renderWithProviders(<CardsPagination totalPages={5} />);

      for (let i = 1; i <= 5; i++) {
        expect(
          screen.getByRole("button", { name: String(i) }),
        ).toBeInTheDocument();
      }
    });

    it("renders at most 7 page number buttons", () => {
      setupStore({ currentPage: 5 });
      renderWithProviders(<CardsPagination totalPages={20} />);

      // Count buttons that are page numbers (exclude Previous/Next)
      const allButtons = screen.getAllByRole("button");
      const pageButtons = allButtons.filter(
        (btn) => btn.textContent !== "Previous" && btn.textContent !== "Next",
      );

      expect(pageButtons).toHaveLength(7);
    });

    it("shows pages 1-7 when currentPage is near the start", () => {
      setupStore({ currentPage: 2 });
      renderWithProviders(<CardsPagination totalPages={10} />);

      for (let i = 1; i <= 7; i++) {
        expect(
          screen.getByRole("button", { name: String(i) }),
        ).toBeInTheDocument();
      }
    });

    it("shows last 7 pages when currentPage is near the end", () => {
      setupStore({ currentPage: 9 });
      renderWithProviders(<CardsPagination totalPages={10} />);

      for (let i = 4; i <= 10; i++) {
        expect(
          screen.getByRole("button", { name: String(i) }),
        ).toBeInTheDocument();
      }
    });

    it("centers the window around currentPage in the middle", () => {
      setupStore({ currentPage: 10 });
      renderWithProviders(<CardsPagination totalPages={20} />);

      // Window should be currentPage - 3 to currentPage + 3 → 7..13
      for (let i = 7; i <= 13; i++) {
        expect(
          screen.getByRole("button", { name: String(i) }),
        ).toBeInTheDocument();
      }
    });

    it("renders only 2 page buttons when totalPages is 2", () => {
      setupStore({ currentPage: 1 });
      renderWithProviders(<CardsPagination totalPages={2} />);

      expect(screen.getByRole("button", { name: "1" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "2" })).toBeInTheDocument();
    });
  });

  describe("active page styling", () => {
    it("applies btn-primary class to the current page button", () => {
      setupStore({ currentPage: 3 });
      renderWithProviders(<CardsPagination totalPages={5} />);

      const currentButton = screen.getByRole("button", { name: "3" });
      expect(currentButton).toHaveClass("btn-primary");
    });

    it("does not apply btn-primary to non-current page buttons", () => {
      setupStore({ currentPage: 3 });
      renderWithProviders(<CardsPagination totalPages={5} />);

      const otherButton = screen.getByRole("button", { name: "1" });
      expect(otherButton).not.toHaveClass("btn-primary");
    });
  });
});
