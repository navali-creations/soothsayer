import { render, screen } from "@testing-library/react";

// ─── Mocks (must be declared before imports) ───────────────────────────────

vi.mock("~/renderer/components", () => ({
  TableHeader: ({ children, tooltip, className }: any) => (
    <div
      data-testid="table-header"
      data-tooltip={tooltip}
      className={className}
    >
      {children}
    </div>
  ),
}));

vi.mock("react-icons/fi", () => ({
  FiEye: (props: any) => <span data-testid="fi-eye" {...props} />,
}));

vi.mock("~/renderer/store", () => ({
  useBoundStore: vi.fn(),
}));

vi.mock("~/renderer/components/CardNameLink/CardNameLink", () => ({
  default: ({ cardName }: any) => (
    <span data-testid="card-name-link">{cardName}</span>
  ),
}));

vi.mock("~/renderer/components/DivinationCard/DivinationCard", () => ({
  default: ({ card }: any) => (
    <div data-testid="divination-card">{card.name}</div>
  ),
}));

vi.mock("~/renderer/hooks/usePopover/usePopover", () => ({
  usePopover: () => ({
    triggerRef: { current: null },
    popoverRef: { current: null },
  }),
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
  Link: ({ children, ...props }: any) => <a {...props}>{children}</a>,
  createLink: () => (props: any) => <a {...props} />,
}));

// ─── Imports (after mocks) ─────────────────────────────────────────────────

import { createPFCardNameColumn } from "./PFCardNameColumn/createPFCardNameColumn";
import { createPFChanceColumn } from "./PFChanceColumn/createPFChanceColumn";
import { createPFExcludeColumn } from "./PFExcludeColumn/createPFExcludeColumn";
import { createPFPlAllDropsColumn } from "./PFPlAllDropsColumn/createPFPlAllDropsColumn";
import { createPFPlCardOnlyColumn } from "./PFPlCardOnlyColumn/createPFPlCardOnlyColumn";
import { createPFPriceColumn } from "./PFPriceColumn/createPFPriceColumn";
import { createPFStatusColumn } from "./PFStatusColumn/createPFStatusColumn";

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("createPFExcludeColumn", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates a column with id 'exclude'", () => {
    const column = createPFExcludeColumn();
    expect(column.id).toBe("exclude");
  });

  it("has size 50 with min and max locked to 50", () => {
    const column = createPFExcludeColumn();
    expect(column.size).toBe(50);
    expect(column.minSize).toBe(50);
    expect(column.maxSize).toBe(50);
  });

  it("has sorting disabled", () => {
    const column = createPFExcludeColumn();
    expect(column.enableSorting).toBe(false);
  });

  it("has global filter disabled", () => {
    const column = createPFExcludeColumn();
    expect(column.enableGlobalFilter).toBe(false);
  });

  it("renders header with eye icon and tooltip", () => {
    const column = createPFExcludeColumn();
    const HeaderComponent = column.header as any;
    render(<HeaderComponent />);
    expect(screen.getByTestId("table-header")).toHaveAttribute(
      "data-tooltip",
      "Include/exclude card from EV calculations",
    );
    expect(screen.getByTestId("fi-eye")).toBeInTheDocument();
  });

  it("renders header with correct className", () => {
    const column = createPFExcludeColumn();
    const HeaderComponent = column.header as any;
    render(<HeaderComponent />);
    expect(screen.getByTestId("table-header")).toHaveAttribute(
      "class",
      "flex w-full justify-center pl-1",
    );
  });
});

describe("createPFStatusColumn", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates a column with id 'status'", () => {
    const column = createPFStatusColumn();
    expect(column.id).toBe("status");
  });

  it("has size 30 with min and max locked to 30", () => {
    const column = createPFStatusColumn();
    expect(column.size).toBe(30);
    expect(column.minSize).toBe(30);
    expect(column.maxSize).toBe(30);
  });

  it("has sorting disabled", () => {
    const column = createPFStatusColumn();
    expect(column.enableSorting).toBe(false);
  });

  it("has global filter disabled", () => {
    const column = createPFStatusColumn();
    expect(column.enableGlobalFilter).toBe(false);
  });

  it("has an empty string header", () => {
    const column = createPFStatusColumn();
    expect(column.header).toBe("");
  });
});

describe("createPFCardNameColumn", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const emptyMap = new Map();

  it("creates a column with id 'cardName'", () => {
    const column = createPFCardNameColumn(emptyMap as any);
    expect(column.id).toBe("cardName");
  });

  it("has header 'Card Name'", () => {
    const column = createPFCardNameColumn(emptyMap as any);
    expect(column.header).toBe("Card Name");
  });

  it("has size 200 and minSize 150", () => {
    const column = createPFCardNameColumn(emptyMap as any);
    expect(column.size).toBe(200);
    expect(column.minSize).toBe(150);
  });

  it("has meta.alignStart set to true", () => {
    const column = createPFCardNameColumn(emptyMap as any);
    expect(column.meta).toEqual({ alignStart: true });
  });

  it("has global filter enabled", () => {
    const column = createPFCardNameColumn(emptyMap as any);
    expect(column.enableGlobalFilter).toBe(true);
  });

  it("uses 'cardName' as the accessor key", () => {
    const column = createPFCardNameColumn(emptyMap as any);
    expect(column.accessorKey).toBe("cardName");
  });
});

describe("createPFPriceColumn", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates a column with id 'divineValue'", () => {
    const column = createPFPriceColumn();
    expect(column.id).toBe("divineValue");
  });

  it("has header 'Price'", () => {
    const column = createPFPriceColumn();
    expect(column.header).toBe("Price");
  });

  it("has size 100", () => {
    const column = createPFPriceColumn();
    expect(column.size).toBe(100);
  });

  it("has global filter disabled", () => {
    const column = createPFPriceColumn();
    expect(column.enableGlobalFilter).toBe(false);
  });

  it("uses 'divineValue' as the accessor key", () => {
    const column = createPFPriceColumn();
    expect(column.accessorKey).toBe("divineValue");
  });
});

describe("createPFChanceColumn", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates a column with id 'chanceInBatch'", () => {
    const column = createPFChanceColumn();
    expect(column.id).toBe("chanceInBatch");
  });

  it("has header '% Chance'", () => {
    const column = createPFChanceColumn();
    expect(column.header).toBe("% Chance");
  });

  it("has size 100", () => {
    const column = createPFChanceColumn();
    expect(column.size).toBe(100);
  });

  it("has global filter disabled", () => {
    const column = createPFChanceColumn();
    expect(column.enableGlobalFilter).toBe(false);
  });

  it("uses 'chanceInBatch' as the accessor key", () => {
    const column = createPFChanceColumn();
    expect(column.accessorKey).toBe("chanceInBatch");
  });
});

describe("createPFPlCardOnlyColumn", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates a column with id 'plA'", () => {
    const column = createPFPlCardOnlyColumn();
    expect(column.id).toBe("plA");
  });

  it("has size 120", () => {
    const column = createPFPlCardOnlyColumn();
    expect(column.size).toBe(120);
  });

  it("has global filter disabled", () => {
    const column = createPFPlCardOnlyColumn();
    expect(column.enableGlobalFilter).toBe(false);
  });

  it("uses 'plA' as the accessor key", () => {
    const column = createPFPlCardOnlyColumn();
    expect(column.accessorKey).toBe("plA");
  });

  it("renders header with data-onboarding attribute and correct text", () => {
    const column = createPFPlCardOnlyColumn();
    const HeaderComponent = column.header as any;
    render(<HeaderComponent />);
    const span = screen.getByText("P&L (card only)");
    expect(span).toBeInTheDocument();
    expect(span).toHaveAttribute("data-onboarding", "pf-pl-card-only");
  });
});

describe("createPFPlAllDropsColumn", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates a column with id 'plB'", () => {
    const column = createPFPlAllDropsColumn();
    expect(column.id).toBe("plB");
  });

  it("has size 120", () => {
    const column = createPFPlAllDropsColumn();
    expect(column.size).toBe(120);
  });

  it("has global filter disabled", () => {
    const column = createPFPlAllDropsColumn();
    expect(column.enableGlobalFilter).toBe(false);
  });

  it("uses 'plB' as the accessor key", () => {
    const column = createPFPlAllDropsColumn();
    expect(column.accessorKey).toBe("plB");
  });

  it("renders header with data-onboarding attribute and correct text", () => {
    const column = createPFPlAllDropsColumn();
    const HeaderComponent = column.header as any;
    render(<HeaderComponent />);
    const span = screen.getByText("P&L (all drops)");
    expect(span).toBeInTheDocument();
    expect(span).toHaveAttribute("data-onboarding", "pf-pl-all-drops");
  });
});
