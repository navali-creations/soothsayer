import { useMemo } from "react";

type Block =
  | { type: "heading"; text: string }
  | { type: "image"; src: string; alt: string }
  | { type: "divider" }
  | { type: "paragraph"; text: string };

const IMG_ATTR_REGEX = /(?:src|alt|width|height)\s*=\s*"([^"]*)"/gi;

function parseImageAttributes(line: string): { src: string; alt: string } {
  let src = "";
  let alt = "";

  for (const match of line.matchAll(IMG_ATTR_REGEX)) {
    const attr = match[0].toLowerCase();
    const value = match[1];

    if (attr.startsWith("src")) {
      src = value;
    } else if (attr.startsWith("alt")) {
      alt = value;
    }
  }

  return { src, alt };
}

function parseContent(content: string): Block[] {
  const lines = content.split("\n");
  const blocks: Block[] = [];
  let paragraphBuffer: string[] = [];

  const flushParagraph = () => {
    if (paragraphBuffer.length > 0) {
      blocks.push({ type: "paragraph", text: paragraphBuffer.join(" ") });
      paragraphBuffer = [];
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();

    // Blank line — flush any buffered paragraph
    if (!trimmed) {
      flushParagraph();
      continue;
    }

    // #### heading
    if (trimmed.startsWith("####")) {
      flushParagraph();
      const text = trimmed.replace(/^#{4,}\s*/, "");
      if (text) {
        blocks.push({ type: "heading", text });
      }
      continue;
    }

    // <img> tag
    if (trimmed.startsWith("<img")) {
      flushParagraph();
      const { src, alt } = parseImageAttributes(trimmed);
      if (src) {
        blocks.push({ type: "image", src, alt });
      }
      continue;
    }

    // Horizontal rule
    if (/^-{3,}$/.test(trimmed)) {
      flushParagraph();
      blocks.push({ type: "divider" });
      continue;
    }

    // Regular text — buffer for paragraph
    paragraphBuffer.push(trimmed);
  }

  flushParagraph();
  return blocks;
}

const ChangelogContent = ({ content }: { content: string }) => {
  const blocks = useMemo(() => parseContent(content), [content]);

  if (blocks.length === 0) return null;

  return (
    <div className="mt-3 space-y-3">
      {blocks.map((block, idx) => {
        switch (block.type) {
          case "heading":
            return (
              <h4
                key={idx}
                className="text-sm font-semibold text-base-content/90"
              >
                {block.text}
              </h4>
            );
          case "paragraph":
            return (
              <p
                key={idx}
                className="text-sm text-base-content/70 leading-relaxed"
              >
                {block.text}
              </p>
            );
          case "image":
            return (
              <img
                key={idx}
                src={block.src}
                alt={block.alt}
                className="rounded-lg border border-base-content/10 w-full"
                loading="lazy"
              />
            );
          case "divider":
            return <hr key={idx} className="border-base-content/10" />;
          default:
            return null;
        }
      })}
    </div>
  );
};

export default ChangelogContent;
