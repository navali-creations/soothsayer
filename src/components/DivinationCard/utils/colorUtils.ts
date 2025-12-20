/**
 * Maps POE class names to their corresponding color values
 */
export function getColorForClass(className: string): string {
  switch (className) {
    case "-currency":
      return "rgb(170,158,130)";
    case "-unique":
      return "rgb(175,96,37)";
    case "-corrupted":
      return "rgb(210,0,0)";
    case "-white":
      return "rgb(200,200,200)";
    case "-magic":
      return "rgb(136,136,255)";
    case "-default":
      return "rgb(127,127,127)";
    case "-rare":
      return "rgb(255,255,119)";
    case "-gem":
      return "rgb(27,162,155)";
    case "-enchanted":
      return "rgb(184,218,242)";
    case "-divination":
      return "rgb(14,186,255)";
    case "-augmented":
      return "rgb(136,136,255)";
    case "-normal":
      return "rgb(200,200,200)";
    default:
      return "rgb(200,200,200)"; // Default white color
  }
}
