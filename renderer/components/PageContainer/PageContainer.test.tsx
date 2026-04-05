import { vi } from "vitest";

import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";

vi.mock("~/renderer/store", () => {
  const useBoundStore = vi.fn();
  return {
    useBoundStore,
    useCurrentSession: () => useBoundStore().currentSession,
    useSettings: () => useBoundStore().settings,
    usePoeNinja: () => useBoundStore().poeNinja,
    useSessionDetails: () => useBoundStore().sessionDetails,
    useOverlay: () => useBoundStore().overlay,
    useAppMenu: () => useBoundStore().appMenu,
    useSetup: () => useBoundStore().setup,
    useStorage: () => useBoundStore().storage,
    useGameInfo: () => useBoundStore().gameInfo,
    useCards: () => useBoundStore().cards,
    useSessions: () => useBoundStore().sessions,
    useChangelog: () => useBoundStore().changelog,
    useStatistics: () => useBoundStore().statistics,
    useOnboarding: () => useBoundStore().onboarding,
    useUpdater: () => useBoundStore().updater,
    useProfitForecast: () => useBoundStore().profitForecast,
    useProhibitedLibrary: () => useBoundStore().prohibitedLibrary,
    useRarityInsights: () => useBoundStore().rarityInsights,
    useRarityInsightsComparison: () => useBoundStore().rarityInsightsComparison,
    useRootActions: () => {
      const s = useBoundStore();
      return {
        hydrate: s.hydrate,
        startListeners: s.startListeners,
        reset: s.reset,
      };
    },
    useSlice: (key: string) => useBoundStore()?.[key],
  };
});

vi.mock("motion/react", () => ({
  AnimatePresence: ({ children }: any) => <>{children}</>,
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}));

vi.mock("../Flex/Flex", () => ({
  default: ({ children, className, ...props }: any) => (
    <div className={className ? `flex ${className}` : "flex"} {...props}>
      {children}
    </div>
  ),
}));

const mockUseBoundStore = vi.mocked(useBoundStore);

import PageContainer from "./PageContainer";

// ─── Helpers ───────────────────────────────────────────────────────────────

function setupMockStore() {
  mockUseBoundStore.mockReturnValue({
    settings: {
      getSelectedGame: () => "poe2",
    },
  } as any);
}

beforeEach(() => {
  setupMockStore();
});

// ─── 1. PageContainer ─────────────────────────────────────────────────────

describe("PageContainer", () => {
  it("renders children", () => {
    renderWithProviders(
      <PageContainer>
        <p>Hello World</p>
      </PageContainer>,
    );

    expect(screen.getByText("Hello World")).toBeInTheDocument();
  });

  it("applies base layout classes", () => {
    const { container } = renderWithProviders(
      <PageContainer>
        <p>Content</p>
      </PageContainer>,
    );

    // The outermost motion.div should have the base layout classes
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper).toHaveClass("h-full");
    expect(wrapper).toHaveClass("flex");
    expect(wrapper).toHaveClass("flex-col");
    expect(wrapper).toHaveClass("bg-base-300");
    expect(wrapper).toHaveClass("p-6");
    expect(wrapper).toHaveClass("pr-4");
  });

  it("appends custom className to the container", () => {
    const { container } = renderWithProviders(
      <PageContainer className="custom-class">
        <p>Content</p>
      </PageContainer>,
    );

    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.className).toContain("custom-class");
  });
});

// ─── 2. PageContainer.Header ──────────────────────────────────────────────

describe("PageContainer.Header", () => {
  it("renders title", () => {
    renderWithProviders(
      <PageContainer>
        <PageContainer.Header title="My Page" />
      </PageContainer>,
    );

    expect(screen.getByText("My Page")).toBeInTheDocument();
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent("My Page");
  });

  it("renders subtitle when provided", () => {
    renderWithProviders(
      <PageContainer>
        <PageContainer.Header title="Title" subtitle="A subtitle" />
      </PageContainer>,
    );

    expect(screen.getByText("A subtitle")).toBeInTheDocument();
  });

  it("does not render subtitle element when subtitle is not provided", () => {
    renderWithProviders(
      <PageContainer>
        <PageContainer.Header title="Title Only" />
      </PageContainer>,
    );

    expect(screen.getByText("Title Only")).toBeInTheDocument();
    // The subtitle wrapper uses text-base-content/70. Without subtitle,
    // the wrapper div should not be in the DOM at all.
    const subtitleEl = document.querySelector(".text-base-content\\/70");
    expect(subtitleEl).toBeNull();
  });

  it("renders actions when provided", () => {
    renderWithProviders(
      <PageContainer>
        <PageContainer.Header
          title="Title"
          actions={<button>Click me</button>}
        />
      </PageContainer>,
    );

    expect(
      screen.getByRole("button", { name: "Click me" }),
    ).toBeInTheDocument();
  });

  it("does not render actions wrapper when actions is not provided", () => {
    const { container } = renderWithProviders(
      <PageContainer>
        <PageContainer.Header title="No Actions" />
      </PageContainer>,
    );

    // There should be only one motion.div child (the title block),
    // not a second one for actions.
    const justifyBetween = container.querySelector(".justify-between");
    expect(justifyBetween).toBeInTheDocument();

    // The actions motion.div would be the second child of the justify-between flex.
    // With no actions, only the title div should exist.
    const children = justifyBetween!.children;
    expect(children).toHaveLength(1);
  });
});

// ─── 3. PageContainer.Content ─────────────────────────────────────────────

describe("PageContainer.Content", () => {
  it("renders children", () => {
    renderWithProviders(
      <PageContainer>
        <PageContainer.Content>
          <div>Inner content</div>
        </PageContainer.Content>
      </PageContainer>,
    );

    expect(screen.getByText("Inner content")).toBeInTheDocument();
  });

  it("applies base content classes", () => {
    const { container } = renderWithProviders(
      <PageContainer>
        <PageContainer.Content>
          <div>Styled content</div>
        </PageContainer.Content>
      </PageContainer>,
    );

    const contentDiv = container.querySelector(".flex-1");
    expect(contentDiv).toBeInTheDocument();
    expect(contentDiv).toHaveClass("overflow-y-auto");
    expect(contentDiv).toHaveClass("space-y-6");
    expect(contentDiv).toHaveClass("scroll-hint");
  });
});

// ─── 4. Compound component structure ──────────────────────────────────────

describe("PageContainer – compound component structure", () => {
  it("has Header and Content as static properties", () => {
    expect(PageContainer.Header).toBeDefined();
    expect(PageContainer.Content).toBeDefined();
  });

  it("renders Header and Content together", () => {
    renderWithProviders(
      <PageContainer>
        <PageContainer.Header title="Compound" subtitle="Works great" />
        <PageContainer.Content>
          <span>Body text</span>
        </PageContainer.Content>
      </PageContainer>,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Compound" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Works great")).toBeInTheDocument();
    expect(screen.getByText("Body text")).toBeInTheDocument();
  });
});
