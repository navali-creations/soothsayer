import type {
  DetailedDivinationCardStats,
  GameType,
} from "~/types/data-stores";

export const PRICING_SAVE_DELAY_MS = 150;

/** Keep large transport-only data out of reactive session state. */
export function toReactiveSession(
  session: DetailedDivinationCardStats | null,
): DetailedDivinationCardStats | null {
  if (!session) return null;
  const { timeline: _timeline, priceSnapshot, ...rest } = session;
  return {
    ...rest,
    ...(priceSnapshot
      ? { priceSnapshot: { ...priceSnapshot, cardPrices: {} } }
      : {}),
  };
}

/** Coalesce pending edits per game and settle errors only for the latest request. */
export function createPricingSaveQueue<T>(
  save: (game: GameType, value: T) => Promise<{ success: boolean }>,
  onSettled: (game: GameType, failed: boolean) => void,
) {
  type Batch = { value: T; revision: number; resolve: Array<() => void> };
  type Job = {
    revision: number;
    failed: Pick<Batch, "value"> | null;
    pending: Batch | null;
    running: Promise<void> | null;
    timer: ReturnType<typeof setTimeout> | null;
  };
  const jobs: Record<GameType, Job> = {
    poe1: {
      revision: 0,
      failed: null,
      pending: null,
      running: null,
      timer: null,
    },
    poe2: {
      revision: 0,
      failed: null,
      pending: null,
      running: null,
      timer: null,
    },
  };

  const flush = async (
    game: GameType,
    { retryFailed = false }: { retryFailed?: boolean } = {},
  ): Promise<boolean> => {
    const job = jobs[game];
    if (job.timer !== null) clearTimeout(job.timer);
    job.timer = null;
    if (retryFailed && job.failed && !job.running && !job.pending) {
      job.pending = {
        value: job.failed.value,
        revision: ++job.revision,
        resolve: [],
      };
    }
    while (job.running || job.pending) {
      if (job.running) {
        await job.running;
        continue;
      }
      const batch = job.pending!;
      job.pending = null;
      const persist = async () => {
        let failed = false;
        try {
          failed = !(await save(game, batch.value)).success;
        } catch {
          failed = true;
        }
        if (job.revision === batch.revision) {
          job.failed = failed ? { value: batch.value } : null;
          onSettled(game, failed);
        }
      };
      job.running = persist().finally(() => {
        job.running = null;
        for (const resolve of batch.resolve) resolve();
      });
      await job.running;
    }
    return job.failed === null;
  };

  const enqueue = (game: GameType, value: T): Promise<void> => {
    const job = jobs[game];
    job.revision += 1;
    return new Promise((resolve) => {
      job.pending = {
        value,
        revision: job.revision,
        resolve: [...(job.pending?.resolve ?? []), resolve],
      };
      if (job.timer !== null) clearTimeout(job.timer);
      job.timer = setTimeout(() => void flush(game), PRICING_SAVE_DELAY_MS);
    });
  };
  return { enqueue, flush };
}
