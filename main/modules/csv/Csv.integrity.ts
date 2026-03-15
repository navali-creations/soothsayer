import {
  CsvIntegrityCheck,
  CsvIntegrityStatus,
  type IntegrityCheckDetail,
  type IntegrityCheckResult,
  type IntegrityStatus,
} from "./Csv.dto";
import type { CsvRepository } from "./Csv.repository";

/**
 * CsvIntegrityChecker
 *
 * Runs read-only integrity checks against the database to detect
 * potential data inconsistencies or tampering. Results are persisted
 * in the csv_export_snapshots table but are NOT surfaced to the user.
 *
 * Checks are categorized as:
 * - "soft" (warn): Expected relationships that may have legitimate reasons
 *   for mismatch (e.g., sessions may not cover all of history)
 * - "hard" (fail): Invariants that should never be violated under normal
 *   operation (e.g., counts should never decrease)
 */
export class CsvIntegrityChecker {
  constructor(private repository: CsvRepository) {}

  /**
   * Run all integrity checks for a given game and scope.
   * Returns an aggregate result with the worst status across all checks.
   */
  async runChecks(
    game: string,
    scope: string,
    currentCounts: Record<string, number>
  ): Promise<IntegrityCheckResult> {
    const details: IntegrityCheckDetail[] = [];

    // Run all checks in parallel where possible
    const [
      sessionCardsCheck,
      globalCounterCheck,
      leagueSumCheck,
      snapshotCheck,
    ] = await Promise.all([
      this.checkAllTimeVsSessionCards(game),
      this.checkAllTimeVsGlobalCounter(game),
      this.checkAllTimeVsLeagueSum(game),
      this.checkSnapshotNonDecreasing(game, scope, currentCounts),
    ]);

    details.push(sessionCardsCheck);
    details.push(globalCounterCheck);
    details.push(leagueSumCheck);
    details.push(snapshotCheck);

    // Aggregate: worst status wins (fail > warn > pass)
    const status = this.aggregateStatus(details);

    return { status, details };
  }

  // ============================================================================
  // Individual Checks
  // ============================================================================

  /**
   * Soft check: Sum of session card counts for a game should be ≤ all-time total.
   *
   * Sessions may not cover all of history (e.g., user started tracking mid-league),
   * so session total being less than all-time is expected. But session total being
   * greater than all-time would indicate a data inconsistency.
   *
   * Always compares against the unscoped all-time totals from the `cards` table
   * rather than the scope-filtered `currentCounts`, because session cards span
   * all leagues while a scoped export may only cover a single league.
   */
  private async checkAllTimeVsSessionCards(
    game: string
  ): Promise<IntegrityCheckDetail> {
    try {
      const [sessionCardSums, allTimeTotal] = await Promise.all([
        this.repository.getSessionCardsSumByGame(game),
        this.repository.getAllTimeTotalCount(game),
      ]);

      const sessionTotal = Object.values(sessionCardSums).reduce(
        (sum, c) => sum + c,
        0
      );

      if (sessionTotal > allTimeTotal) {
        return {
          check: CsvIntegrityCheck.AllTimeVsSessionCards,
          status: CsvIntegrityStatus.Warn,
          message: `Session cards total (${sessionTotal}) exceeds all-time total (${allTimeTotal})`,
          expected: allTimeTotal,
          actual: sessionTotal,
        };
      }

      return {
        check: CsvIntegrityCheck.AllTimeVsSessionCards,
        status: CsvIntegrityStatus.Pass,
        message: `Session cards total (${sessionTotal}) ≤ all-time total (${allTimeTotal})`,
        expected: allTimeTotal,
        actual: sessionTotal,
      };
    } catch (error) {
      return {
        check: CsvIntegrityCheck.AllTimeVsSessionCards,
        status: CsvIntegrityStatus.Warn,
        message: `Check failed: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Soft check: All-time total count should approximately match the global
   * totalStackedDecksOpened counter.
   *
   * The global counter tracks every deck opened across all games, while
   * all-time counts are per-game. A significant mismatch may indicate
   * data corruption or manual tampering.
   *
   * Note: globalCounter is cross-game so we only warn if all-time > global
   * (which should be impossible).
   */
  private async checkAllTimeVsGlobalCounter(
    game: string
  ): Promise<IntegrityCheckDetail> {
    try {
      const globalTotal = await this.repository.getGlobalTotalDecksOpened();
      const allTimeTotal = await this.repository.getAllTimeTotalCount(game);

      if (allTimeTotal > globalTotal) {
        return {
          check: CsvIntegrityCheck.AllTimeVsGlobalCounter,
          status: CsvIntegrityStatus.Warn,
          message: `All-time total for ${game} (${allTimeTotal}) exceeds global counter (${globalTotal})`,
          expected: globalTotal,
          actual: allTimeTotal,
        };
      }

      return {
        check: CsvIntegrityCheck.AllTimeVsGlobalCounter,
        status: CsvIntegrityStatus.Pass,
        message: `All-time total for ${game} (${allTimeTotal}) ≤ global counter (${globalTotal})`,
        expected: globalTotal,
        actual: allTimeTotal,
      };
    } catch (error) {
      return {
        check: CsvIntegrityCheck.AllTimeVsGlobalCounter,
        status: CsvIntegrityStatus.Warn,
        message: `Check failed: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Soft check: Each card's all-time count should be ≥ the sum of its
   * league-scoped counts, since league data is a subset of all-time.
   *
   * If any card has a league sum exceeding its all-time count, it suggests
   * the all-time count was tampered with or data was not properly aggregated.
   */
  private async checkAllTimeVsLeagueSum(
    game: string
  ): Promise<IntegrityCheckDetail> {
    try {
      const allTimeCounts = await this.repository.getAllTimeCardCounts(game);
      const leagueCounts = await this.repository.getLeagueCardCounts(game);

      const violations: string[] = [];

      for (const [cardName, leagueTotal] of Object.entries(leagueCounts)) {
        const allTimeCount = allTimeCounts[cardName] ?? 0;
        if (leagueTotal > allTimeCount) {
          violations.push(
            `${cardName}: league sum ${leagueTotal} > all-time ${allTimeCount}`
          );
        }
      }

      if (violations.length > 0) {
        return {
          check: CsvIntegrityCheck.AllTimeVsLeagueSum,
          status: CsvIntegrityStatus.Warn,
          message: `${
            violations.length
          } card(s) have league sums exceeding all-time counts: ${violations
            .slice(0, 5)
            .join("; ")}${
            violations.length > 5 ? ` (and ${violations.length - 5} more)` : ""
          }`,
          expected: 0,
          actual: violations.length,
        };
      }

      return {
        check: CsvIntegrityCheck.AllTimeVsLeagueSum,
        status: CsvIntegrityStatus.Pass,
        message: "All card all-time counts ≥ league sums",
      };
    } catch (error) {
      return {
        check: CsvIntegrityCheck.AllTimeVsLeagueSum,
        status: CsvIntegrityStatus.Warn,
        message: `Check failed: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Hard check: If a prior snapshot exists for this game+scope, current
   * counts should be ≥ snapshot counts for every card.
   *
   * Card counts should never decrease (cards can only be added, not removed).
   * A decrease strongly suggests manual data tampering.
   *
   * If no prior snapshot exists, this check passes automatically.
   */
  private async checkSnapshotNonDecreasing(
    game: string,
    scope: string,
    currentCounts: Record<string, number>
  ): Promise<IntegrityCheckDetail> {
    try {
      const snapshotRows = await this.repository.getSnapshot(game, scope);

      // No prior snapshot — nothing to compare against
      if (snapshotRows.length === 0) {
        return {
          check: CsvIntegrityCheck.SnapshotNonDecreasing,
          status: CsvIntegrityStatus.Pass,
          message: "No prior snapshot — first export for this scope",
        };
      }

      const violations: string[] = [];

      for (const row of snapshotRows) {
        const currentCount = currentCounts[row.cardName] ?? 0;
        if (currentCount < row.count) {
          violations.push(
            `${row.cardName}: was ${row.count}, now ${currentCount}`
          );
        }
      }

      if (violations.length > 0) {
        return {
          check: CsvIntegrityCheck.SnapshotNonDecreasing,
          status: CsvIntegrityStatus.Fail,
          message: `${
            violations.length
          } card(s) decreased since last snapshot: ${violations
            .slice(0, 5)
            .join("; ")}${
            violations.length > 5 ? ` (and ${violations.length - 5} more)` : ""
          }`,
          expected: 0,
          actual: violations.length,
        };
      }

      return {
        check: CsvIntegrityCheck.SnapshotNonDecreasing,
        status: CsvIntegrityStatus.Pass,
        message: "All card counts are non-decreasing since last snapshot",
      };
    } catch (error) {
      return {
        check: CsvIntegrityCheck.SnapshotNonDecreasing,
        status: CsvIntegrityStatus.Warn,
        message: `Check failed: ${(error as Error).message}`,
      };
    }
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  /**
   * Compute the worst status across all check details.
   * Priority: fail > warn > pass
   */
  private aggregateStatus(details: IntegrityCheckDetail[]): IntegrityStatus {
    if (details.some((d) => d.status === CsvIntegrityStatus.Fail))
      return CsvIntegrityStatus.Fail;
    if (details.some((d) => d.status === CsvIntegrityStatus.Warn))
      return CsvIntegrityStatus.Warn;
    return CsvIntegrityStatus.Pass;
  }
}
