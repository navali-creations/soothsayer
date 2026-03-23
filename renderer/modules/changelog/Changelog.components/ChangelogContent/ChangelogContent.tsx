import { MarkdownRenderer } from "~/renderer/components";

const ChangelogContent = ({ content }: { content: string }) => {
  if (!content.trim()) return null;

  return <MarkdownRenderer className="mt-3">{content}</MarkdownRenderer>;
};

export default ChangelogContent;
