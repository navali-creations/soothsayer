import { describe, expect, it } from "vitest";

import { getColorForClass } from "./colorUtils";

describe("getColorForClass", () => {
  it("returns currency color for -currency", () => {
    expect(getColorForClass("-currency")).toBe("rgb(170,158,130)");
  });

  it("returns unique color for -unique", () => {
    expect(getColorForClass("-unique")).toBe("rgb(175,96,37)");
  });

  it("returns corrupted color for -corrupted", () => {
    expect(getColorForClass("-corrupted")).toBe("rgb(210,0,0)");
  });

  it("returns white color for -white", () => {
    expect(getColorForClass("-white")).toBe("rgb(200,200,200)");
  });

  it("returns magic color for -magic", () => {
    expect(getColorForClass("-magic")).toBe("rgb(136,136,255)");
  });

  it("returns default color for -default", () => {
    expect(getColorForClass("-default")).toBe("rgb(127,127,127)");
  });

  it("returns rare color for -rare", () => {
    expect(getColorForClass("-rare")).toBe("rgb(255,255,119)");
  });

  it("returns gem color for -gem", () => {
    expect(getColorForClass("-gem")).toBe("rgb(27,162,155)");
  });

  it("returns enchanted color for -enchanted", () => {
    expect(getColorForClass("-enchanted")).toBe("rgb(184,218,242)");
  });

  it("returns divination color for -divination", () => {
    expect(getColorForClass("-divination")).toBe("rgb(14,186,255)");
  });

  it("returns augmented color for -augmented", () => {
    expect(getColorForClass("-augmented")).toBe("rgb(136,136,255)");
  });

  it("returns normal color for -normal", () => {
    expect(getColorForClass("-normal")).toBe("rgb(200,200,200)");
  });

  describe("default fallback", () => {
    it("returns default color for an unknown class", () => {
      expect(getColorForClass("-unknown")).toBe("rgb(200,200,200)");
    });

    it("returns default color for an empty string", () => {
      expect(getColorForClass("")).toBe("rgb(200,200,200)");
    });

    it("returns default color for a class without a leading dash", () => {
      expect(getColorForClass("currency")).toBe("rgb(200,200,200)");
    });

    it("returns default color for an arbitrary string", () => {
      expect(getColorForClass("some-random-class")).toBe("rgb(200,200,200)");
    });
  });
});
