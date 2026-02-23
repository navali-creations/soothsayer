import Markdown from "react-markdown";
import rehypeRaw from "rehype-raw";

const components = {
  h1: ({ node, ...props }: any) => (
    <h1 className="text-lg font-bold text-base-content mt-4 mb-2" {...props} />
  ),
  h2: ({ node, ...props }: any) => (
    <h2
      className="text-base font-semibold text-base-content mt-3 mb-2"
      {...props}
    />
  ),
  h3: ({ node, ...props }: any) => (
    <h3
      className="text-sm font-semibold text-base-content/90 mt-3 mb-1.5"
      {...props}
    />
  ),
  h4: ({ node, ...props }: any) => (
    <h4
      className="text-sm font-semibold text-base-content/90 mt-2 mb-1"
      {...props}
    />
  ),
  p: ({ node, ...props }: any) => (
    <p
      className="text-sm text-base-content/80 leading-relaxed mb-2"
      {...props}
    />
  ),
  a: ({ node, ...props }: any) => (
    <a
      className="text-primary hover:underline"
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    />
  ),
  ul: ({ node, ...props }: any) => (
    <ul className="space-y-1.5 ml-1 mb-2" {...props} />
  ),
  ol: ({ node, ...props }: any) => (
    <ol className="space-y-1.5 ml-1 mb-2 list-decimal list-inside" {...props} />
  ),
  li: ({ node, ...props }: any) => (
    <li
      className="flex items-start gap-2 text-sm text-base-content/80"
      {...props}
    >
      <span className="text-primary mt-1 shrink-0">•</span>
      <span>{props.children}</span>
    </li>
  ),
  img: ({ node, ...props }: any) => {
    const width = props.width ? Number(props.width) : undefined;
    return (
      <img
        {...props}
        className="rounded-lg border border-base-content/10 max-w-full h-auto my-2"
        style={{ maxWidth: width ? `min(${width}px, 100%)` : "100%" }}
        loading="lazy"
      />
    );
  },
  hr: ({ node, ...props }: any) => (
    <hr className="border-base-content/10 my-3" {...props} />
  ),
  code: ({ node, inline, ...props }: any) =>
    inline !== false && !props.className ? (
      <code
        className="bg-base-300 text-base-content/90 rounded px-1.5 py-0.5 text-xs font-mono"
        {...props}
      />
    ) : (
      <code
        className="block bg-base-300 text-base-content/90 rounded-lg p-3 text-xs font-mono overflow-x-auto my-2"
        {...props}
      />
    ),
  pre: ({ node, ...props }: any) => (
    <pre
      className="bg-base-300 rounded-lg p-3 text-xs font-mono overflow-x-auto my-2"
      {...props}
    />
  ),
  blockquote: ({ node, ...props }: any) => (
    <blockquote
      className="border-l-2 border-primary/40 pl-3 text-sm text-base-content/60 italic my-2"
      {...props}
    />
  ),
  strong: ({ node, ...props }: any) => (
    <strong className="font-semibold text-base-content/90" {...props} />
  ),
  em: ({ node, ...props }: any) => <em className="italic" {...props} />,
};

interface MarkdownRendererProps {
  children: string;
  className?: string;
  componentOverrides?: Partial<typeof components>;
}

const MarkdownRenderer = ({
  children,
  className,
  componentOverrides,
}: MarkdownRendererProps) => {
  const merged = componentOverrides
    ? { ...components, ...componentOverrides }
    : components;

  return (
    <div className={className}>
      <Markdown rehypePlugins={[rehypeRaw]} components={merged}>
        {children}
      </Markdown>
    </div>
  );
};

export default MarkdownRenderer;
