import { type ColumnDef, createColumnHelper } from "@tanstack/react-table";

import {
  renderWithProviders,
  screen,
  waitFor,
} from "~/renderer/__test-setup__/render";

import Table from "./Table";
import TableHeader from "./TableHeader";

// ─── Test data & columns ───────────────────────────────────────────────────

type Person = { name: string; age: number };

const columnHelper = createColumnHelper<Person>();

const columns: ColumnDef<Person, any>[] = [
  columnHelper.accessor("name", {
    header: "Name",
    cell: (info) => info.getValue(),
  }),
  columnHelper.accessor("age", {
    header: "Age",
    cell: (info) => info.getValue(),
  }),
];

const testData: Person[] = [
  { name: "Alice", age: 30 },
  { name: "Bob", age: 25 },
  { name: "Charlie", age: 35 },
];

function generateData(count: number): Person[] {
  return Array.from({ length: count }, (_, i) => ({
    name: `Person ${i + 1}`,
    age: 20 + i,
  }));
}

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Get all text-content strings from <tbody> rows (first column). */
function getFirstColumnValues(): string[] {
  const tbody = document.querySelector("tbody");
  if (!tbody) return [];
  const rows = tbody.querySelectorAll("tr");
  return Array.from(rows).map(
    (row) => row.querySelectorAll("td")[0]?.textContent ?? "",
  );
}

function getSecondColumnValues(): string[] {
  const tbody = document.querySelector("tbody");
  if (!tbody) return [];
  const rows = tbody.querySelectorAll("tr");
  return Array.from(rows).map(
    (row) => row.querySelectorAll("td")[1]?.textContent ?? "",
  );
}

// ─── 1. Rendering basics ──────────────────────────────────────────────────

describe("Table – rendering basics", () => {
  it("renders table with correct headers and row data", () => {
    renderWithProviders(<Table data={testData} columns={columns} />);

    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Age")).toBeInTheDocument();

    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("30")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("25")).toBeInTheDocument();
    expect(screen.getByText("Charlie")).toBeInTheDocument();
    expect(screen.getByText("35")).toBeInTheDocument();
  });

  it("renders an empty table when data is an empty array", () => {
    renderWithProviders(<Table data={[]} columns={columns} />);

    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Age")).toBeInTheDocument();

    const tbody = document.querySelector("tbody");
    expect(tbody).toBeInTheDocument();
    expect(tbody!.querySelectorAll("tr")).toHaveLength(0);
  });

  it("applies custom className to the <table> element", () => {
    renderWithProviders(
      <Table data={testData} columns={columns} className="my-custom-class" />,
    );

    const table = document.querySelector("table");
    expect(table).toHaveClass("my-custom-class");
  });

  it("applies table-zebra class when zebraStripes is true", () => {
    renderWithProviders(
      <Table data={testData} columns={columns} zebraStripes />,
    );

    const table = document.querySelector("table");
    expect(table).toHaveClass("table-zebra");
  });

  it("does not apply table-zebra class when zebraStripes is false (default)", () => {
    renderWithProviders(<Table data={testData} columns={columns} />);

    const table = document.querySelector("table");
    expect(table).not.toHaveClass("table-zebra");
  });

  it("applies table-xs class when compact is true", () => {
    renderWithProviders(<Table data={testData} columns={columns} compact />);

    const table = document.querySelector("table");
    expect(table).toHaveClass("table-xs");
  });

  it("does not apply table-xs class when compact is false (default)", () => {
    renderWithProviders(<Table data={testData} columns={columns} />);

    const table = document.querySelector("table");
    expect(table).not.toHaveClass("table-xs");
  });

  it("applies hover class to body rows when hoverable is true (default)", () => {
    renderWithProviders(<Table data={testData} columns={columns} />);

    const rows = document.querySelectorAll("tbody tr");
    rows.forEach((row) => {
      expect(row).toHaveClass("hover");
    });
  });

  it("does not apply hover class to body rows when hoverable is false", () => {
    renderWithProviders(
      <Table data={testData} columns={columns} hoverable={false} />,
    );

    const rows = document.querySelectorAll("tbody tr");
    rows.forEach((row) => {
      expect(row).not.toHaveClass("hover");
    });
  });
});

// ─── 2. Uncontrolled sorting ───────────────────────────────────────────────

describe("Table – uncontrolled sorting", () => {
  it("sorts ascending on first header click", async () => {
    const { user } = renderWithProviders(
      <Table data={testData} columns={columns} />,
    );

    // Initial order: Alice, Bob, Charlie
    expect(getFirstColumnValues()).toEqual(["Alice", "Bob", "Charlie"]);

    await user.click(screen.getByText("Name"));

    // Ascending: Alice, Bob, Charlie (alphabetical – same order)
    expect(getFirstColumnValues()).toEqual(["Alice", "Bob", "Charlie"]);
  });

  it("sorts descending on second header click", async () => {
    const { user } = renderWithProviders(
      <Table data={testData} columns={columns} />,
    );

    // Click Name header twice: asc → desc
    await user.click(screen.getByText("Name"));
    await user.click(screen.getByText("Name"));

    expect(getFirstColumnValues()).toEqual(["Charlie", "Bob", "Alice"]);
  });

  it("removes sort on third header click (returns to original order)", async () => {
    const { user } = renderWithProviders(
      <Table data={testData} columns={columns} />,
    );

    // Three clicks: asc → desc → none
    await user.click(screen.getByText("Name"));
    await user.click(screen.getByText("Name"));
    await user.click(screen.getByText("Name"));

    expect(getFirstColumnValues()).toEqual(["Alice", "Bob", "Charlie"]);
  });

  it("sorts by age column numerically", async () => {
    const { user } = renderWithProviders(
      <Table data={testData} columns={columns} />,
    );

    // TanStack sorts number columns desc-first by default (sortDescFirst: true)
    // First click → descending
    await user.click(screen.getByText("Age"));
    expect(getSecondColumnValues()).toEqual(["35", "30", "25"]);

    // Second click → ascending
    await user.click(screen.getByText("Age"));
    expect(getSecondColumnValues()).toEqual(["25", "30", "35"]);
  });

  it("shows both dimmed sort icons when column is unsorted", () => {
    renderWithProviders(<Table data={testData} columns={columns} />);

    // Each sortable header should have both up and down icons in the unsorted state.
    // The unsorted state renders a container div with both FiChevronUp and FiChevronDown
    // inside a div with opacity-50.
    const dimmedContainers = document.querySelectorAll(".opacity-50");
    // There should be one per sortable column header
    expect(dimmedContainers.length).toBeGreaterThanOrEqual(2);
  });

  it("shows only FiChevronUp when sorted ascending", async () => {
    const { user } = renderWithProviders(
      <Table data={testData} columns={columns} />,
    );

    // Click Name header to sort ascending
    await user.click(screen.getByText("Name"));

    // The Name column's header group: the sorted column should not have the dimmed container
    const headers = document.querySelectorAll("thead th");
    const nameHeader = headers[0];

    // Should have a single sort icon span, no dimmed container
    const dimmed = nameHeader.querySelector(".opacity-50");
    expect(dimmed).toBeNull();

    // Should have an SVG element (the up chevron)
    const sortIconSpan = nameHeader.querySelector(".inline-flex");
    expect(sortIconSpan).toBeInTheDocument();
    expect(sortIconSpan!.querySelector("svg")).toBeInTheDocument();
  });

  it("respects initialSorting prop", () => {
    renderWithProviders(
      <Table
        data={testData}
        columns={columns}
        initialSorting={[{ id: "age", desc: true }]}
      />,
    );

    // Should be sorted by age descending
    expect(getSecondColumnValues()).toEqual(["35", "30", "25"]);
  });
});

// ─── 3. Controlled sorting ────────────────────────────────────────────────

describe("Table – controlled sorting", () => {
  it("uses controlled sorting state and calls onSortingChange on click", async () => {
    const onSortingChange = vi.fn();

    const { user } = renderWithProviders(
      <Table
        data={testData}
        columns={columns}
        sorting={[]}
        onSortingChange={onSortingChange}
      />,
    );

    await user.click(screen.getByText("Name"));

    expect(onSortingChange).toHaveBeenCalledTimes(1);
    // TanStack calls the updater function which resolves to a sorting state
    const result = onSortingChange.mock.calls[0][0];
    expect(result).toEqual([{ id: "name", desc: false }]);
  });

  it("renders according to controlled sorting state", () => {
    renderWithProviders(
      <Table
        data={testData}
        columns={columns}
        sorting={[{ id: "age", desc: true }]}
        onSortingChange={vi.fn()}
      />,
    );

    expect(getSecondColumnValues()).toEqual(["35", "30", "25"]);
  });

  it("does not use internal state when controlled", async () => {
    const onSortingChange = vi.fn();

    const { user } = renderWithProviders(
      <Table
        data={testData}
        columns={columns}
        sorting={[]}
        onSortingChange={onSortingChange}
      />,
    );

    // Click to attempt sort — since sorting is controlled as [], order shouldn't change
    await user.click(screen.getByText("Name"));

    // Original order stays because controlled sorting is still []
    expect(getFirstColumnValues()).toEqual(["Alice", "Bob", "Charlie"]);
  });
});

// ─── 4. Sorting disabled ──────────────────────────────────────────────────

describe("Table – sorting disabled", () => {
  it("does not sort when enableSorting is false", async () => {
    const { user } = renderWithProviders(
      <Table data={testData} columns={columns} enableSorting={false} />,
    );

    await user.click(screen.getByText("Name"));

    // Order should remain the same
    expect(getFirstColumnValues()).toEqual(["Alice", "Bob", "Charlie"]);
  });

  it("still renders sort icons when enableSorting is false (sorting model removed, not per-column)", () => {
    // Note: The Table component only removes getSortedRowModel when enableSorting
    // is false — it does not pass enableSorting to useReactTable, so TanStack
    // still considers columns sortable (getCanSort() returns true). The sort
    // icons render but sorting has no practical effect because there is no
    // sorted row model.
    renderWithProviders(
      <Table data={testData} columns={columns} enableSorting={false} />,
    );

    const sortIcons = document.querySelectorAll("thead .inline-flex");
    expect(sortIcons.length).toBeGreaterThan(0);
  });

  it("still applies cursor-pointer to headers when enableSorting is false (no per-column disable)", () => {
    // Same reason as above: getCanSort() still returns true because
    // enableSorting is not forwarded to useReactTable options.
    renderWithProviders(
      <Table data={testData} columns={columns} enableSorting={false} />,
    );

    const headers = document.querySelectorAll("thead th");
    headers.forEach((header) => {
      expect(header).toHaveClass("cursor-pointer");
    });
  });
});

// ─── 5. Global filter ─────────────────────────────────────────────────────

describe("Table – global filter", () => {
  it("filters rows based on globalFilter string", () => {
    renderWithProviders(
      <Table data={testData} columns={columns} globalFilter="Ali" />,
    );

    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.queryByText("Bob")).not.toBeInTheDocument();
    expect(screen.queryByText("Charlie")).not.toBeInTheDocument();
  });

  it("shows all rows when globalFilter is an empty string", () => {
    renderWithProviders(
      <Table data={testData} columns={columns} globalFilter="" />,
    );

    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("Charlie")).toBeInTheDocument();
  });

  it("does not filter when globalFilter is undefined", () => {
    renderWithProviders(<Table data={testData} columns={columns} />);

    expect(getFirstColumnValues()).toEqual(["Alice", "Bob", "Charlie"]);
  });

  it("uses custom globalFilterFn when provided", () => {
    // Custom filter: only match rows where name starts with the filter value
    const startsWithFilter = (
      row: any,
      _columnId: string,
      filterValue: string,
    ) => {
      const name = row.getValue("name") as string;
      return name.toLowerCase().startsWith(filterValue.toLowerCase());
    };

    renderWithProviders(
      <Table
        data={testData}
        columns={columns}
        globalFilter="b"
        globalFilterFn={startsWithFilter}
      />,
    );

    // Only Bob starts with "b"
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.queryByText("Alice")).not.toBeInTheDocument();
    expect(screen.queryByText("Charlie")).not.toBeInTheDocument();
  });

  it("updates visible rows when globalFilter changes via rerender", () => {
    const { rerender } = renderWithProviders(
      <Table data={testData} columns={columns} globalFilter="Alice" />,
    );

    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.queryByText("Bob")).not.toBeInTheDocument();

    rerender(<Table data={testData} columns={columns} globalFilter="Bob" />);

    expect(screen.queryByText("Alice")).not.toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });
});

// ─── 6. Pagination ────────────────────────────────────────────────────────

describe("Table – pagination", () => {
  const paginatedData = generateData(25); // 25 items, pageSize 10 → 3 pages

  it("shows pagination controls when enablePagination is true", () => {
    renderWithProviders(
      <Table
        data={paginatedData}
        columns={columns}
        enablePagination
        pageSize={10}
      />,
    );

    expect(screen.getByText(/Showing/)).toBeInTheDocument();
    expect(screen.getByText(/Page/)).toBeInTheDocument();
  });

  it("does not show pagination controls when enablePagination is false (default)", () => {
    renderWithProviders(<Table data={paginatedData} columns={columns} />);

    expect(screen.queryByText(/Showing/)).not.toBeInTheDocument();
  });

  it("shows correct 'Showing X to Y of Z results' text on page 1", () => {
    renderWithProviders(
      <Table
        data={paginatedData}
        columns={columns}
        enablePagination
        pageSize={10}
      />,
    );

    expect(
      screen.getByText("Showing 1 to 10 of 25 results"),
    ).toBeInTheDocument();
  });

  it("shows correct page count text", () => {
    renderWithProviders(
      <Table
        data={paginatedData}
        columns={columns}
        enablePagination
        pageSize={10}
      />,
    );

    expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
  });

  it("renders only pageSize rows on the first page", () => {
    renderWithProviders(
      <Table
        data={paginatedData}
        columns={columns}
        enablePagination
        pageSize={10}
      />,
    );

    const rows = document.querySelectorAll("tbody tr");
    expect(rows).toHaveLength(10);
  });

  it("navigates to the next page and updates results text", async () => {
    const { user } = renderWithProviders(
      <Table
        data={paginatedData}
        columns={columns}
        enablePagination
        pageSize={10}
      />,
    );

    // Find the next page button — it's the 3rd button in the pagination
    const paginationButtons = document.querySelectorAll(
      ".flex.items-center.justify-between button",
    );
    // buttons[0] = first, [1] = prev, [2] = next, [3] = last
    await user.click(paginationButtons[2]);

    expect(screen.getByText("Page 2 of 3")).toBeInTheDocument();
    expect(
      screen.getByText("Showing 11 to 20 of 25 results"),
    ).toBeInTheDocument();
  });

  it("navigates to the last page with the last button", async () => {
    const { user } = renderWithProviders(
      <Table
        data={paginatedData}
        columns={columns}
        enablePagination
        pageSize={10}
      />,
    );

    const paginationButtons = document.querySelectorAll(
      ".flex.items-center.justify-between button",
    );
    // Last button (>>)
    await user.click(paginationButtons[3]);

    expect(screen.getByText("Page 3 of 3")).toBeInTheDocument();
    expect(
      screen.getByText("Showing 21 to 25 of 25 results"),
    ).toBeInTheDocument();

    // Should render only 5 rows on the last page
    const rows = document.querySelectorAll("tbody tr");
    expect(rows).toHaveLength(5);
  });

  it("navigates back with the previous button", async () => {
    const { user } = renderWithProviders(
      <Table
        data={paginatedData}
        columns={columns}
        enablePagination
        pageSize={10}
      />,
    );

    const paginationButtons = document.querySelectorAll(
      ".flex.items-center.justify-between button",
    );

    // Go to page 2 first
    await user.click(paginationButtons[2]); // next
    expect(screen.getByText("Page 2 of 3")).toBeInTheDocument();

    // Go back to page 1
    await user.click(paginationButtons[1]); // prev
    expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
  });

  it("navigates to first page with the first button", async () => {
    const { user } = renderWithProviders(
      <Table
        data={paginatedData}
        columns={columns}
        enablePagination
        pageSize={10}
      />,
    );

    const paginationButtons = document.querySelectorAll(
      ".flex.items-center.justify-between button",
    );

    // Go to last page
    await user.click(paginationButtons[3]); // last
    expect(screen.getByText("Page 3 of 3")).toBeInTheDocument();

    // Go to first page
    await user.click(paginationButtons[0]); // first
    expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
  });

  it("disables first and previous buttons on the first page", () => {
    renderWithProviders(
      <Table
        data={paginatedData}
        columns={columns}
        enablePagination
        pageSize={10}
      />,
    );

    const paginationButtons = document.querySelectorAll(
      ".flex.items-center.justify-between button",
    );

    expect(paginationButtons[0]).toBeDisabled(); // first
    expect(paginationButtons[1]).toBeDisabled(); // prev
    expect(paginationButtons[2]).not.toBeDisabled(); // next
    expect(paginationButtons[3]).not.toBeDisabled(); // last
  });

  it("disables next and last buttons on the last page", async () => {
    const { user } = renderWithProviders(
      <Table
        data={paginatedData}
        columns={columns}
        enablePagination
        pageSize={10}
      />,
    );

    const paginationButtons = document.querySelectorAll(
      ".flex.items-center.justify-between button",
    );

    // Navigate to last page
    await user.click(paginationButtons[3]); // last

    // Re-query after state change
    const updatedButtons = document.querySelectorAll(
      ".flex.items-center.justify-between button",
    );

    expect(updatedButtons[0]).not.toBeDisabled(); // first
    expect(updatedButtons[1]).not.toBeDisabled(); // prev
    expect(updatedButtons[2]).toBeDisabled(); // next
    expect(updatedButtons[3]).toBeDisabled(); // last
  });
});

// ─── 7. Page-index clamping ───────────────────────────────────────────────

describe("Table – page-index clamping", () => {
  it("clamps to the last valid page when data shrinks", async () => {
    const bigData = generateData(25); // 3 pages with pageSize=10

    const { user, rerender } = renderWithProviders(
      <Table data={bigData} columns={columns} enablePagination pageSize={10} />,
    );

    // Navigate to page 3
    const paginationButtons = document.querySelectorAll(
      ".flex.items-center.justify-between button",
    );
    await user.click(paginationButtons[3]); // last
    expect(screen.getByText("Page 3 of 3")).toBeInTheDocument();

    // Now shrink data so there's only 1 page
    const smallData = generateData(5);
    rerender(
      <Table
        data={smallData}
        columns={columns}
        enablePagination
        pageSize={10}
      />,
    );

    // Should clamp to page 1 (the only valid page)
    await waitFor(() => {
      expect(screen.getByText("Page 1 of 1")).toBeInTheDocument();
    });

    expect(screen.getByText("Showing 1 to 5 of 5 results")).toBeInTheDocument();
  });

  it("clamps to page 2 when data shrinks from 3 pages to 2 pages while on page 3", async () => {
    const data30 = generateData(30); // 3 pages

    const { user, rerender } = renderWithProviders(
      <Table data={data30} columns={columns} enablePagination pageSize={10} />,
    );

    // Navigate to page 3
    const paginationButtons = document.querySelectorAll(
      ".flex.items-center.justify-between button",
    );
    await user.click(paginationButtons[3]); // last
    expect(screen.getByText("Page 3 of 3")).toBeInTheDocument();

    // Shrink to 15 items → 2 pages
    const data15 = generateData(15);
    rerender(
      <Table data={data15} columns={columns} enablePagination pageSize={10} />,
    );

    await waitFor(() => {
      expect(screen.getByText("Page 2 of 2")).toBeInTheDocument();
    });
  });
});

// ─── 8. Sticky header ─────────────────────────────────────────────────────

describe("Table – stickyHeader", () => {
  it("applies sticky classes to header cells when stickyHeader is true", () => {
    renderWithProviders(
      <Table data={testData} columns={columns} stickyHeader />,
    );

    const headerCells = document.querySelectorAll("thead th");
    headerCells.forEach((th) => {
      expect(th).toHaveClass("sticky");
      expect(th).toHaveClass("top-0");
      expect(th).toHaveClass("z-10");
      expect(th).toHaveClass("bg-base-100");
    });
  });

  it("does not apply sticky classes when stickyHeader is false (default)", () => {
    renderWithProviders(<Table data={testData} columns={columns} />);

    const headerCells = document.querySelectorAll("thead th");
    headerCells.forEach((th) => {
      expect(th).not.toHaveClass("sticky");
    });
  });

  it("removes overflow-x-auto wrapper when stickyHeader is true", () => {
    renderWithProviders(
      <Table data={testData} columns={columns} stickyHeader />,
    );

    const wrapper = document.querySelector(".overflow-x-auto");
    expect(wrapper).toBeNull();
  });

  it("has overflow-x-auto wrapper when stickyHeader is false (default)", () => {
    renderWithProviders(<Table data={testData} columns={columns} />);

    const wrapper = document.querySelector(".overflow-x-auto");
    expect(wrapper).toBeInTheDocument();
  });

  it("applies sticky bottom bar styles to pagination when stickyHeader is true", () => {
    renderWithProviders(
      <Table
        data={generateData(25)}
        columns={columns}
        enablePagination
        pageSize={10}
        stickyHeader
      />,
    );

    const paginationBar = document.querySelector(".sticky.bottom-0");
    expect(paginationBar).toBeInTheDocument();
  });
});

// ─── 9. rowClassName ──────────────────────────────────────────────────────

describe("Table – rowClassName", () => {
  it("applies a static string rowClassName to all body rows", () => {
    renderWithProviders(
      <Table data={testData} columns={columns} rowClassName="highlight-row" />,
    );

    const rows = document.querySelectorAll("tbody tr");
    expect(rows).toHaveLength(3);
    rows.forEach((row) => {
      expect(row).toHaveClass("highlight-row");
    });
  });

  it("applies a function-based rowClassName to each row individually", () => {
    const rowClassFn = (row: any) => {
      const age = row.original.age as number;
      return age >= 30 ? "senior" : "junior";
    };

    renderWithProviders(
      <Table data={testData} columns={columns} rowClassName={rowClassFn} />,
    );

    const rows = document.querySelectorAll("tbody tr");

    // Alice (30) → senior
    expect(rows[0]).toHaveClass("senior");
    // Bob (25) → junior
    expect(rows[1]).toHaveClass("junior");
    // Charlie (35) → senior
    expect(rows[2]).toHaveClass("senior");
  });

  it("always applies the group class to body rows regardless of rowClassName", () => {
    renderWithProviders(
      <Table data={testData} columns={columns} rowClassName="custom-class" />,
    );

    const rows = document.querySelectorAll("tbody tr");
    rows.forEach((row) => {
      expect(row).toHaveClass("group");
      expect(row).toHaveClass("custom-class");
    });
  });
});

// ─── 10. TableHeader with tooltip ─────────────────────────────────────────

describe("TableHeader – with tooltip", () => {
  it("renders tooltip wrapper with DaisyUI tooltip classes", () => {
    renderWithProviders(
      <TableHeader tooltip="Some help text">Column Name</TableHeader>,
    );

    const wrapper = screen.getByText("Column Name").closest(".tooltip");
    expect(wrapper).toBeInTheDocument();
    expect(wrapper).toHaveClass("tooltip");
    expect(wrapper).toHaveClass("tooltip-left");
    expect(wrapper).toHaveClass("tooltip-primary");
  });

  it("sets data-tip attribute to the tooltip value", () => {
    renderWithProviders(
      <TableHeader tooltip="Helpful tooltip">Header Text</TableHeader>,
    );

    const wrapper = screen.getByText("Header Text").closest("[data-tip]");
    expect(wrapper).toBeInTheDocument();
    expect(wrapper).toHaveAttribute("data-tip", "Helpful tooltip");
  });

  it("renders a <sup>?</sup> indicator", () => {
    renderWithProviders(
      <TableHeader tooltip="Tooltip text">My Header</TableHeader>,
    );

    const sup = document.querySelector("sup");
    expect(sup).toBeInTheDocument();
    expect(sup!.textContent).toBe("?");
  });

  it("renders children content", () => {
    renderWithProviders(<TableHeader tooltip="Help">Column Title</TableHeader>);

    expect(screen.getByText("Column Title")).toBeInTheDocument();
  });

  it("applies custom className to tooltip wrapper", () => {
    renderWithProviders(
      <TableHeader tooltip="Tip" className="extra-class">
        Header
      </TableHeader>,
    );

    const wrapper = screen.getByText("Header").closest(".tooltip");
    expect(wrapper).toHaveClass("extra-class");
  });

  it("renders children and ? inside a flex container with gap and items-center", () => {
    renderWithProviders(<TableHeader tooltip="Info">Flex Header</TableHeader>);

    // The flex container wrapping children and <sup>?</sup>
    const flexContainer = screen.getByText("Flex Header").closest(".flex");
    expect(flexContainer).toBeInTheDocument();
    expect(flexContainer).toHaveClass("gap-1");
    expect(flexContainer).toHaveClass("items-center");
  });

  it("renders with border-dotted class on the flex container", () => {
    renderWithProviders(
      <TableHeader tooltip="Info">Dotted Header</TableHeader>,
    );

    const flexContainer = screen.getByText("Dotted Header").closest(".flex");
    expect(flexContainer).toHaveClass("border-b");
    expect(flexContainer).toHaveClass("border-dotted");
  });
});

// ─── 11. TableHeader without tooltip ──────────────────────────────────────

describe("TableHeader – without tooltip", () => {
  it("renders a plain div wrapper without tooltip classes", () => {
    renderWithProviders(<TableHeader>Plain Header</TableHeader>);

    const element = screen.getByText("Plain Header");
    expect(element.tagName).toBe("DIV");
    expect(element).not.toHaveClass("tooltip");
    expect(element).not.toHaveClass("tooltip-left");
    expect(element).not.toHaveClass("tooltip-primary");
  });

  it("does not render a <sup>?</sup> indicator", () => {
    renderWithProviders(<TableHeader>No Tooltip Header</TableHeader>);

    const sup = document.querySelector("sup");
    expect(sup).toBeNull();
  });

  it("does not have a data-tip attribute", () => {
    renderWithProviders(<TableHeader>Simple Header</TableHeader>);

    const element = screen.getByText("Simple Header");
    expect(element).not.toHaveAttribute("data-tip");
  });

  it("renders children content correctly", () => {
    renderWithProviders(<TableHeader>My Content</TableHeader>);

    expect(screen.getByText("My Content")).toBeInTheDocument();
  });

  it("has border-b-transparent class on the plain wrapper", () => {
    renderWithProviders(<TableHeader>Transparent Border</TableHeader>);

    const element = screen.getByText("Transparent Border");
    expect(element).toHaveClass("border-b-transparent");
  });
});

// ─── 12. Integration: TableHeader used inside Table columns ───────────────

describe("Table – with TableHeader in column definitions", () => {
  it("renders TableHeader with tooltip inside table headers", () => {
    const columnsWithHeader: ColumnDef<Person, any>[] = [
      columnHelper.accessor("name", {
        header: () => (
          <TableHeader tooltip="The person's full name">Name</TableHeader>
        ),
        cell: (info) => info.getValue(),
      }),
      columnHelper.accessor("age", {
        header: () => <TableHeader>Age</TableHeader>,
        cell: (info) => info.getValue(),
      }),
    ];

    renderWithProviders(<Table data={testData} columns={columnsWithHeader} />);

    // Name header should have tooltip
    const nameTooltip = screen.getByText("Name").closest("[data-tip]");
    expect(nameTooltip).toHaveAttribute("data-tip", "The person's full name");

    // Age header should be plain
    const ageElement = screen.getByText("Age");
    expect(ageElement.closest("[data-tip]")).toBeNull();

    // Data rows should still render
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("Charlie")).toBeInTheDocument();
  });
});

// ─── 13. Edge cases ──────────────────────────────────────────────────────

describe("Table – edge cases", () => {
  it("handles a single row of data", () => {
    renderWithProviders(
      <Table data={[{ name: "Solo", age: 42 }]} columns={columns} />,
    );

    expect(screen.getByText("Solo")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();

    const rows = document.querySelectorAll("tbody tr");
    expect(rows).toHaveLength(1);
  });

  it("renders all data without pagination by default", () => {
    const bigData = generateData(50);
    renderWithProviders(<Table data={bigData} columns={columns} />);

    const rows = document.querySelectorAll("tbody tr");
    expect(rows).toHaveLength(50);
  });

  it("applies both compact and zebraStripes classes together", () => {
    renderWithProviders(
      <Table data={testData} columns={columns} compact zebraStripes />,
    );

    const table = document.querySelector("table");
    expect(table).toHaveClass("table-xs");
    expect(table).toHaveClass("table-zebra");
  });

  it("always has the base table and bg-base-100 classes", () => {
    renderWithProviders(<Table data={testData} columns={columns} />);

    const table = document.querySelector("table");
    expect(table).toHaveClass("table");
    expect(table).toHaveClass("bg-base-100");
  });
});

// ─── 14. CardCountCell ────────────────────────────────────────────────────

import CardCountCell from "./cells/CardCountCell";

describe("CardCountCell", () => {
  const createMockCellProps = (value: number) =>
    ({
      getValue: () => value,
      row: { original: { name: "Test Card", count: value } },
    }) as any;

  it("renders the count value inside a badge", () => {
    renderWithProviders(<CardCountCell {...createMockCellProps(5)} />);

    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("applies badge badge-soft classes", () => {
    renderWithProviders(<CardCountCell {...createMockCellProps(12)} />);

    const badge = screen.getByText("12");
    expect(badge).toHaveClass("badge");
    expect(badge).toHaveClass("badge-soft");
  });

  it("renders zero count", () => {
    renderWithProviders(<CardCountCell {...createMockCellProps(0)} />);

    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("renders large count values", () => {
    renderWithProviders(<CardCountCell {...createMockCellProps(9999)} />);

    expect(screen.getByText("9999")).toBeInTheDocument();
  });
});

// ─── 15. CardRatioCell ────────────────────────────────────────────────────

import CardRatioCell from "./cells/CardRatioCell";

describe("CardRatioCell", () => {
  const createMockCellProps = (value: number) =>
    ({
      getValue: () => value,
      row: { original: { name: "Test Card", count: 5 } },
    }) as any;

  it("renders the ratio formatted to seven decimal places with a percent sign", () => {
    renderWithProviders(<CardRatioCell {...createMockCellProps(12.345)} />);

    expect(screen.getByText("12.3450000%")).toBeInTheDocument();
  });

  it("applies badge badge-soft classes", () => {
    renderWithProviders(<CardRatioCell {...createMockCellProps(50)} />);

    const badge = screen.getByText("50.0000000%");
    expect(badge).toHaveClass("badge");
    expect(badge).toHaveClass("badge-soft");
  });

  it("renders zero ratio as 0%", () => {
    renderWithProviders(<CardRatioCell {...createMockCellProps(0)} />);

    expect(screen.getByText("0%")).toBeInTheDocument();
  });

  it("renders small fractional ratios correctly", () => {
    renderWithProviders(<CardRatioCell {...createMockCellProps(0.1)} />);

    expect(screen.getByText("0.1000000%")).toBeInTheDocument();
  });

  it("renders 100% ratio", () => {
    renderWithProviders(<CardRatioCell {...createMockCellProps(100)} />);

    expect(screen.getByText("100.0000000%")).toBeInTheDocument();
  });
});

// ─── 16. createCardCountColumn ────────────────────────────────────────────

import { createCardCountColumn } from "./columns/createCardCountColumn";

describe("createCardCountColumn", () => {
  it("creates a column with id 'count'", () => {
    const column = createCardCountColumn();

    expect(column.id).toBe("count");
  });

  it("renders header text 'Count'", () => {
    const column = createCardCountColumn();
    const Header = column.header as any;

    renderWithProviders(<Header />);

    expect(screen.getByText("Count")).toBeInTheDocument();
  });
});

// ─── 17. createCardNameColumn ─────────────────────────────────────────────

import { createCardNameColumn } from "./columns/createCardNameColumn";

describe("createCardNameColumn", () => {
  it("creates a column with id 'name'", () => {
    const column = createCardNameColumn();

    expect(column.id).toBe("name");
  });

  it("renders header text 'Card Name'", () => {
    const column = createCardNameColumn();
    const Header = column.header as any;

    renderWithProviders(<Header />);

    expect(screen.getByText("Card Name")).toBeInTheDocument();
  });
});

// ─── 18. createCardRatioColumn ────────────────────────────────────────────

import { createCardRatioColumn } from "./columns/createCardRatioColumn";

describe("createCardRatioColumn", () => {
  it("creates a column with id 'ratio'", () => {
    const column = createCardRatioColumn(100);

    expect(column.id).toBe("ratio");
  });

  it("renders header text 'Ratio'", () => {
    const column = createCardRatioColumn(100);
    const Header = column.header as any;

    renderWithProviders(<Header />);

    expect(screen.getByText("Ratio")).toBeInTheDocument();
  });

  it("renders header with a tooltip indicator", () => {
    const column = createCardRatioColumn(100);
    const Header = column.header as any;

    renderWithProviders(<Header />);

    const sup = document.querySelector("sup");
    expect(sup).toBeInTheDocument();
    expect(sup).toHaveTextContent("?");
  });

  it("renders header with tooltip data-tip attribute", () => {
    const column = createCardRatioColumn(100);
    const Header = column.header as any;

    renderWithProviders(<Header />);

    const tooltipEl = document.querySelector("[data-tip]");
    expect(tooltipEl).toBeInTheDocument();
    expect(tooltipEl?.getAttribute("data-tip")).toBe(
      "How often you've found this card compared to all other cards",
    );
  });

  it("has an accessorFn that computes (count / totalCount) * 100", () => {
    const column = createCardRatioColumn(200);
    const accessorFn = (column as any).accessorFn;

    expect(accessorFn).toBeDefined();
    expect(accessorFn({ name: "Test", count: 50 })).toBe(25);
  });

  it("returns 0 when totalCount is 0", () => {
    const column = createCardRatioColumn(0);
    const accessorFn = (column as any).accessorFn;

    expect(accessorFn({ name: "Test", count: 10 })).toBe(0);
  });

  it("computes correct ratio for various counts", () => {
    const column = createCardRatioColumn(400);
    const accessorFn = (column as any).accessorFn;

    expect(accessorFn({ name: "A", count: 4 })).toBe(1);
    expect(accessorFn({ name: "B", count: 100 })).toBe(25);
    expect(accessorFn({ name: "C", count: 400 })).toBe(100);
  });
});
