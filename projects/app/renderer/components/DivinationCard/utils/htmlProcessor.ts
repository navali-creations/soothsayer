import { getColorForClass } from "./colorUtils";

/**
 * Process rewardHtml to inject inline styles for classes
 */
export function processRewardHtml(html: string): string {
  if (!html) return html;

  // Match all class attributes and replace them with inline styles
  return html.replace(/class="([^"]+)"/g, (match, classes) => {
    const classList = classes.split(" ");
    const colors = classList
      .filter((cls: string) => cls.startsWith("-"))
      .map((cls: string) => getColorForClass(cls));

    // Use the first color found, or default
    const color = colors[0] || "rgb(200,200,200)";
    return `style="color: ${color}"`;
  });
}
