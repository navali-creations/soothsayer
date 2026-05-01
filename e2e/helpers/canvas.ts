import type { Locator, Page } from "@playwright/test";

import { expect } from "./electron-test";

interface CanvasRenderState {
  cssHeight: number;
  cssWidth: number;
  backingHeight: number;
  backingWidth: number;
  hasPixels: boolean;
}

async function getCanvasRenderState(canvas: Locator) {
  return canvas.evaluate((node): CanvasRenderState => {
    const canvas = node as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    const backingWidth = canvas.width;
    const backingHeight = canvas.height;
    let hasPixels = false;

    try {
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (ctx && backingWidth > 0 && backingHeight > 0) {
        const { data } = ctx.getImageData(0, 0, backingWidth, backingHeight);
        for (let i = 0; i < data.length; i += 4) {
          if (
            data[i] !== 0 ||
            data[i + 1] !== 0 ||
            data[i + 2] !== 0 ||
            data[i + 3] !== 0
          ) {
            hasPixels = true;
            break;
          }
        }
      }
    } catch {
      hasPixels = false;
    }

    return {
      cssHeight: rect.height,
      cssWidth: rect.width,
      backingHeight,
      backingWidth,
      hasPixels,
    };
  });
}

export async function expectCanvasChartRendered(
  canvas: Locator,
  label: string,
) {
  await expect(canvas, `${label} canvas should be visible`).toBeVisible({
    timeout: 5_000,
  });

  await expect
    .poll(
      async () => {
        const state = await getCanvasRenderState(canvas).catch(() => null);
        return Boolean(
          state &&
            state.cssWidth > 0 &&
            state.cssHeight > 0 &&
            state.backingWidth > 0 &&
            state.backingHeight > 0 &&
            state.hasPixels,
        );
      },
      {
        message: `${label} canvas should have dimensions and painted pixels`,
        timeout: 5_000,
        intervals: [100, 250, 500],
      },
    )
    .toBe(true);

  const box = await canvas.boundingBox();
  expect(box, `${label} canvas should have a bounding box`).toBeTruthy();
  expect(
    box!.width,
    `${label} canvas should have non-zero width`,
  ).toBeGreaterThan(0);
  expect(
    box!.height,
    `${label} canvas should have non-zero height`,
  ).toBeGreaterThan(0);
}

export async function readCanvasNumberAttribute(
  canvas: Locator,
  attribute: string,
) {
  const value = await canvas.getAttribute(attribute);
  expect(value, `${attribute} should be present on canvas`).not.toBeNull();

  const parsed = Number(value);
  expect(
    Number.isFinite(parsed),
    `${attribute} should be a finite number`,
  ).toBe(true);

  return parsed;
}

export async function readIndexBrushSpan(canvas: Locator) {
  const startIndex = await readCanvasNumberAttribute(
    canvas,
    "data-brush-start-index",
  );
  const endIndex = await readCanvasNumberAttribute(
    canvas,
    "data-brush-end-index",
  );

  return endIndex - startIndex;
}

export async function readTimeBrushSpan(canvas: Locator) {
  const startTime = await readCanvasNumberAttribute(
    canvas,
    "data-brush-start-time",
  );
  const endTime = await readCanvasNumberAttribute(
    canvas,
    "data-brush-end-time",
  );

  return endTime - startTime;
}

async function dragCanvasPoint(
  page: Page,
  canvas: Locator,
  x: number,
  y: number,
  deltaX: number,
) {
  await canvas.scrollIntoViewIfNeeded();
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + deltaX, y, { steps: 8 });
  await page.mouse.up();
}

export async function dragIndexBrushThumb(
  page: Page,
  canvas: Locator,
  {
    deltaX,
    leftPadding,
    rightPadding,
    thumb,
    yFromBottom = 17,
  }: {
    deltaX: number;
    leftPadding: number;
    rightPadding: number;
    thumb: "left" | "right";
    yFromBottom?: number;
  },
) {
  const box = await canvas.boundingBox();
  expect(
    box,
    "Canvas should have a bounding box before brush drag",
  ).toBeTruthy();

  const startIndex = await readCanvasNumberAttribute(
    canvas,
    "data-brush-start-index",
  );
  const endIndex = await readCanvasNumberAttribute(
    canvas,
    "data-brush-end-index",
  );
  const pointCount = await readCanvasNumberAttribute(
    canvas,
    "data-chart-point-count",
  );
  const brushWidth = Math.max(1, box!.width - leftPadding - rightPadding);
  const index = thumb === "left" ? startIndex : endIndex;
  const ratio = pointCount > 1 ? index / (pointCount - 1) : 0;
  const x = box!.x + leftPadding + ratio * brushWidth;
  const y = box!.y + Math.max(1, box!.height - yFromBottom);

  await dragCanvasPoint(page, canvas, x, y, deltaX);
}

export async function wheelCanvas(canvas: Locator, deltaY: number) {
  const box = await canvas.boundingBox();
  expect(
    box,
    "Canvas should have a bounding box before wheel zoom",
  ).toBeTruthy();

  await canvas.scrollIntoViewIfNeeded();
  await canvas.dispatchEvent("wheel", {
    bubbles: true,
    cancelable: true,
    clientX: box!.x + box!.width / 2,
    clientY: box!.y + box!.height / 2,
    deltaY,
  });
}

export async function dragFullRangeBrushThumb(
  page: Page,
  canvas: Locator,
  {
    deltaX,
    leftPadding,
    rightPadding,
    thumb,
    yFromBottom = 17,
  }: {
    deltaX: number;
    leftPadding: number;
    rightPadding: number;
    thumb: "left" | "right";
    yFromBottom?: number;
  },
) {
  const box = await canvas.boundingBox();
  expect(
    box,
    "Canvas should have a bounding box before brush drag",
  ).toBeTruthy();

  const x =
    box!.x + (thumb === "left" ? leftPadding : box!.width - rightPadding);
  const y = box!.y + Math.max(1, box!.height - yFromBottom);

  await dragCanvasPoint(page, canvas, x, y, deltaX);
}
