const DEFAULT_RENDERER_PORT = 5173;

export function getE2ERendererPort(): number {
  const rawPort =
    process.env.SOOTHSAYER_E2E_RENDERER_PORT ?? String(DEFAULT_RENDERER_PORT);

  if (!/^\d+$/.test(rawPort)) {
    throw new Error(
      `SOOTHSAYER_E2E_RENDERER_PORT must be an integer, got "${rawPort}".`,
    );
  }

  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(
      `SOOTHSAYER_E2E_RENDERER_PORT must be between 1 and 65535, got "${rawPort}".`,
    );
  }

  return port;
}
