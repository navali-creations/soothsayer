import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import MarkdownRenderer from "../Markdown";

describe("MarkdownRenderer", () => {
  // ─── Wrapper ───────────────────────────────────────────────────────────────

  it("renders a wrapper div", () => {
    const { container } = render(
      <MarkdownRenderer>{"Hello"}</MarkdownRenderer>,
    );
    expect(container.firstElementChild?.tagName).toBe("DIV");
  });

  it("applies className to wrapper div", () => {
    const { container } = render(
      <MarkdownRenderer className="my-custom-class">
        {"Hello"}
      </MarkdownRenderer>,
    );
    expect(container.firstElementChild).toHaveClass("my-custom-class");
  });

  // ─── Headings ──────────────────────────────────────────────────────────────

  it("renders h1 with correct classes", () => {
    render(<MarkdownRenderer>{"# Heading 1"}</MarkdownRenderer>);
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1).toHaveTextContent("Heading 1");
    expect(h1).toHaveClass(
      "text-lg",
      "font-bold",
      "text-base-content",
      "mt-4",
      "mb-2",
    );
  });

  it("renders h2 with correct classes", () => {
    render(<MarkdownRenderer>{"## Heading 2"}</MarkdownRenderer>);
    const h2 = screen.getByRole("heading", { level: 2 });
    expect(h2).toHaveTextContent("Heading 2");
    expect(h2).toHaveClass("text-base", "font-semibold", "mt-3", "mb-2");
  });

  it("renders h3 with correct classes", () => {
    render(<MarkdownRenderer>{"### Heading 3"}</MarkdownRenderer>);
    const h3 = screen.getByRole("heading", { level: 3 });
    expect(h3).toHaveTextContent("Heading 3");
    expect(h3).toHaveClass("text-sm", "font-semibold", "mt-3");
  });

  it("renders h4 with correct classes", () => {
    render(<MarkdownRenderer>{"#### Heading 4"}</MarkdownRenderer>);
    const h4 = screen.getByRole("heading", { level: 4 });
    expect(h4).toHaveTextContent("Heading 4");
    expect(h4).toHaveClass("text-sm", "font-semibold", "mt-2", "mb-1");
  });

  // ─── Paragraphs ────────────────────────────────────────────────────────────

  it("renders paragraphs with correct class", () => {
    render(<MarkdownRenderer>{"Some paragraph text"}</MarkdownRenderer>);
    const p = screen.getByText("Some paragraph text");
    expect(p.tagName).toBe("P");
    expect(p).toHaveClass("text-sm", "leading-relaxed", "mb-2");
  });

  // ─── Links ─────────────────────────────────────────────────────────────────

  it("renders links with target=_blank and rel=noopener noreferrer", () => {
    render(
      <MarkdownRenderer>{"[Example](https://example.com)"}</MarkdownRenderer>,
    );
    const link = screen.getByRole("link", { name: "Example" });
    expect(link).toHaveAttribute("href", "https://example.com");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link).toHaveClass("text-primary");
  });

  // ─── Lists ─────────────────────────────────────────────────────────────────

  it("renders unordered lists", () => {
    const md = "- Item A\n- Item B";
    render(<MarkdownRenderer>{md}</MarkdownRenderer>);
    const ul = screen.getByRole("list");
    expect(ul.tagName).toBe("UL");
    expect(ul).toHaveClass("space-y-1.5", "ml-1", "mb-2");
  });

  it("renders ordered lists with list-decimal class", () => {
    const md = "1. First\n2. Second";
    render(<MarkdownRenderer>{md}</MarkdownRenderer>);
    const ol = screen.getByRole("list");
    expect(ol.tagName).toBe("OL");
    expect(ol).toHaveClass("list-decimal", "list-inside");
  });

  it("renders list items with bullet span", () => {
    const md = "- Bullet item";
    render(<MarkdownRenderer>{md}</MarkdownRenderer>);
    const li = screen.getByRole("listitem");
    expect(li).toHaveClass("flex", "items-start", "gap-2");
    // The custom li renders a bullet span
    const bulletSpan = li.querySelector("span.text-primary");
    expect(bulletSpan).toBeInTheDocument();
    expect(bulletSpan).toHaveTextContent("•");
  });

  // ─── Images ────────────────────────────────────────────────────────────────

  it("renders images with lazy loading and rounded class", () => {
    render(
      <MarkdownRenderer>
        {"![alt text](https://example.com/img.png)"}
      </MarkdownRenderer>,
    );
    const img = screen.getByRole("img", { name: "alt text" });
    expect(img).toHaveAttribute("loading", "lazy");
    expect(img).toHaveClass("rounded-lg");
    expect(img).toHaveAttribute("src", "https://example.com/img.png");
  });

  it("renders images with width attribute setting max-width style", () => {
    render(
      <MarkdownRenderer>
        {'<img src="https://example.com/img.png" alt="sized" width="200" />'}
      </MarkdownRenderer>,
    );
    const img = screen.getByRole("img", { name: "sized" });
    expect(img).toHaveAttribute("loading", "lazy");
    expect(img.style.maxWidth).toBe("min(200px, 100%)");
  });

  it("renders images without width attribute defaulting max-width to 100%", () => {
    render(
      <MarkdownRenderer>
        {"![no width](https://example.com/img.png)"}
      </MarkdownRenderer>,
    );
    const img = screen.getByRole("img", { name: "no width" });
    expect(img.style.maxWidth).toBe("100%");
  });

  // ─── Horizontal rule ──────────────────────────────────────────────────────

  it("renders horizontal rules", () => {
    render(<MarkdownRenderer>{"---"}</MarkdownRenderer>);
    const hr = screen.getByRole("separator");
    expect(hr.tagName).toBe("HR");
    expect(hr).toHaveClass("my-3");
  });

  // ─── Inline code ──────────────────────────────────────────────────────────

  it("renders inline code with bg-base-300", () => {
    render(<MarkdownRenderer>{"`inline code`"}</MarkdownRenderer>);
    const code = screen.getByText("inline code");
    expect(code.tagName).toBe("CODE");
    expect(code).toHaveClass(
      "bg-base-300",
      "rounded",
      "px-1.5",
      "py-0.5",
      "text-xs",
      "font-mono",
    );
  });

  // ─── Code block ───────────────────────────────────────────────────────────

  it("renders code blocks with pre and code", () => {
    const md = "```\ncode block content\n```";
    render(<MarkdownRenderer>{md}</MarkdownRenderer>);
    const pre = document.querySelector("pre");
    expect(pre).toBeInTheDocument();
    expect(pre).toHaveClass("bg-base-300", "rounded-lg", "p-3", "font-mono");
    const code = pre?.querySelector("code");
    expect(code).toBeInTheDocument();
    expect(code).toHaveTextContent("code block content");
  });

  // ─── Blockquote ───────────────────────────────────────────────────────────

  it("renders blockquotes with border-l-2", () => {
    render(<MarkdownRenderer>{"> This is a quote"}</MarkdownRenderer>);
    const blockquote = screen
      .getByText("This is a quote")
      .closest("blockquote");
    expect(blockquote).toBeInTheDocument();
    expect(blockquote).toHaveClass("border-l-2", "pl-3", "italic", "my-2");
  });

  // ─── Bold / Italic ────────────────────────────────────────────────────────

  it("renders bold text with strong", () => {
    render(<MarkdownRenderer>{"**bold text**"}</MarkdownRenderer>);
    const strong = screen.getByText("bold text");
    expect(strong.tagName).toBe("STRONG");
    expect(strong).toHaveClass("font-semibold");
  });

  it("renders italic text with em", () => {
    render(<MarkdownRenderer>{"*italic text*"}</MarkdownRenderer>);
    const em = screen.getByText("italic text");
    expect(em.tagName).toBe("EM");
    expect(em).toHaveClass("italic");
  });

  // ─── Tables (GFM) ─────────────────────────────────────────────────────────

  it("renders GFM tables with proper structure and classes", () => {
    const md = "| Name | Value |\n|---|---|\n| A | 1 |";
    render(<MarkdownRenderer>{md}</MarkdownRenderer>);

    const table = document.querySelector("table");
    expect(table).toBeInTheDocument();
    expect(table).toHaveClass("table", "w-full", "text-sm");

    const thead = table?.querySelector("thead");
    expect(thead).toBeInTheDocument();
    expect(thead).toHaveClass("bg-base-200");

    const tbody = table?.querySelector("tbody");
    expect(tbody).toBeInTheDocument();

    const headerCells = table?.querySelectorAll("th");
    expect(headerCells).toHaveLength(2);
    expect(headerCells?.[0]).toHaveTextContent("Name");
    expect(headerCells?.[0]).toHaveClass(
      "px-3",
      "py-2",
      "text-left",
      "text-xs",
      "font-semibold",
      "uppercase",
    );
    expect(headerCells?.[1]).toHaveTextContent("Value");

    const dataCells = table?.querySelectorAll("td");
    expect(dataCells).toHaveLength(2);
    expect(dataCells?.[0]).toHaveTextContent("A");
    expect(dataCells?.[0]).toHaveClass("px-3", "py-2", "text-sm");
    expect(dataCells?.[1]).toHaveTextContent("1");

    const rows = table?.querySelectorAll("tr");
    expect(rows!.length).toBeGreaterThanOrEqual(2);
    expect(rows?.[0]).toHaveClass("border-b");

    // The table is wrapped in an overflow container
    const wrapper = table?.parentElement;
    expect(wrapper).toHaveClass("overflow-x-auto", "my-3");
  });

  // ─── componentOverrides ───────────────────────────────────────────────────

  it("uses componentOverrides to replace a default component", () => {
    const customParagraph = ({ node, ...props }: any) => (
      <p data-testid="custom-p" className="custom-paragraph" {...props} />
    );

    render(
      <MarkdownRenderer componentOverrides={{ p: customParagraph }}>
        {"Override paragraph"}
      </MarkdownRenderer>,
    );

    const p = screen.getByTestId("custom-p");
    expect(p).toHaveTextContent("Override paragraph");
    expect(p).toHaveClass("custom-paragraph");
    // Should NOT have the default classes
    expect(p).not.toHaveClass("leading-relaxed");
  });

  it("uses default components when componentOverrides is not provided", () => {
    render(<MarkdownRenderer>{"Default paragraph"}</MarkdownRenderer>);
    const p = screen.getByText("Default paragraph");
    expect(p.tagName).toBe("P");
    expect(p).toHaveClass("text-sm", "leading-relaxed", "mb-2");
  });
});
