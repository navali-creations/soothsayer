/**
 * E2E Test Fixture Data
 *
 * Provides deterministic, well-known test data for Soothsayer E2E tests.
 * This data mirrors the shapes expected by the renderer store slices and
 * IPC return types, so it can be injected via mocked IPC handlers or
 * used to assert against rendered content.
 *
 * @module e2e/fixtures/test-data
 */

// ─── Leagues ──────────────────────────────────────────────────────────────────

export interface TestLeague {
  id: string;
  name: string;
  startDate: string;
  endDate: string | null;
  isActive: boolean;
}

export const LEAGUES: Record<string, TestLeague> = {
  current: {
    id: "settlers-of-kalguur",
    name: "Settlers of Kalguur",
    startDate: "2024-07-26T19:00:00.000Z",
    endDate: null,
    isActive: true,
  },
  previous: {
    id: "necropolis",
    name: "Necropolis",
    startDate: "2024-03-29T20:00:00.000Z",
    endDate: "2024-07-22T19:00:00.000Z",
    isActive: false,
  },
  standard: {
    id: "standard",
    name: "Standard",
    startDate: "2013-01-23T00:00:00.000Z",
    endDate: null,
    isActive: true,
  },
} as const;

export const ALL_LEAGUES: TestLeague[] = Object.values(LEAGUES);

// ─── Game Types ───────────────────────────────────────────────────────────────

export const GAME_TYPES = {
  poe1: "poe1",
  poe2: "poe2",
} as const;

export type GameType = (typeof GAME_TYPES)[keyof typeof GAME_TYPES];

// ─── Divination Cards ─────────────────────────────────────────────────────────

export interface TestDivinationCard {
  id: number;
  name: string;
  slug: string;
  stackSize: number;
  artFilename: string;
  rewardText: string;
  flavourText: string;
  chaosValue: number;
  divineValue: number;
  rarity: string;
  dropSources: string[];
}

export const CARDS: Record<string, TestDivinationCard> = {
  doctor: {
    id: 1,
    name: "The Doctor",
    slug: "the-doctor",
    stackSize: 8,
    artFilename: "TheDoctor.png",
    rewardText: "Headhunter",
    flavourText: "Every doctor has a cure.",
    chaosValue: 1250.0,
    divineValue: 8.5,
    rarity: "extraordinary",
    dropSources: ["The Spider Lair", "Lair of the Hydra"],
  },
  humility: {
    id: 2,
    name: "Humility",
    slug: "humility",
    stackSize: 9,
    artFilename: "Humility.png",
    rewardText: "Tabula Rasa",
    flavourText: "The greatest warriors are born with nothing.",
    chaosValue: 1.5,
    divineValue: 0.01,
    rarity: "common",
    dropSources: ["The Blood Aqueduct", "The Aqueduct"],
  },
  rain: {
    id: 3,
    name: "Rain of Chaos",
    slug: "rain-of-chaos",
    stackSize: 8,
    artFilename: "RainOfChaos.png",
    rewardText: "Chaos Orb",
    flavourText: "What the gods give, they take away.",
    chaosValue: 0.5,
    divineValue: 0.003,
    rarity: "common",
    dropSources: ["Global"],
  },
  house: {
    id: 4,
    name: "House of Mirrors",
    slug: "house-of-mirrors",
    stackSize: 1,
    artFilename: "HouseOfMirrors.png",
    rewardText: "Mirror of Kalandra",
    flavourText: "In the mirror, all is possible.",
    chaosValue: 25000.0,
    divineValue: 165.0,
    rarity: "extraordinary",
    dropSources: ["Alluring Abyss"],
  },
  nurse: {
    id: 5,
    name: "The Nurse",
    slug: "the-nurse",
    stackSize: 8,
    artFilename: "TheNurse.png",
    rewardText: "The Doctor",
    flavourText: "The nurse cares for the sick.",
    chaosValue: 150.0,
    divineValue: 1.0,
    rarity: "very_rare",
    dropSources: ["Tower Map"],
  },
  wretched: {
    id: 6,
    name: "The Wretched",
    slug: "the-wretched",
    stackSize: 6,
    artFilename: "TheWretched.png",
    rewardText: "Random Belt",
    flavourText: "In desperation, we find strength.",
    chaosValue: 2.0,
    divineValue: 0.013,
    rarity: "uncommon",
    dropSources: ["The Harbour Bridge"],
  },
  enlightened: {
    id: 7,
    name: "The Enlightened",
    slug: "the-enlightened",
    stackSize: 6,
    artFilename: "TheEnlightened.png",
    rewardText: "Enlighten Support",
    flavourText: "Knowledge is power incarnate.",
    chaosValue: 45.0,
    divineValue: 0.3,
    rarity: "rare",
    dropSources: ["Academy Map"],
  },
  carrion: {
    id: 8,
    name: "Carrion Crow",
    slug: "carrion-crow",
    stackSize: 4,
    artFilename: "CarrionCrow.png",
    rewardText: "Life Armour",
    flavourText: "The crow picks clean the bones.",
    chaosValue: 0.2,
    divineValue: 0.001,
    rarity: "common",
    dropSources: ["Global"],
  },
} as const;

export const ALL_CARDS: TestDivinationCard[] = Object.values(CARDS);

/**
 * A smaller card set for quick tests that don't need the full catalog.
 */
export const SAMPLE_CARDS: TestDivinationCard[] = [
  CARDS.doctor,
  CARDS.humility,
  CARDS.rain,
];

// ─── Sessions ─────────────────────────────────────────────────────────────────

export interface TestSessionCard {
  cardId: number;
  cardName: string;
  count: number;
  chaosValue: number;
}

export interface TestSession {
  id: string;
  leagueId: string;
  startedAt: string;
  endedAt: string | null;
  isActive: boolean;
  totalChaosValue: number;
  cardDrops: TestSessionCard[];
  snapshotCount: number;
}

export const SESSIONS: Record<string, TestSession> = {
  active: {
    id: "session-active-001",
    leagueId: LEAGUES.current.id,
    startedAt: new Date().toISOString(),
    endedAt: null,
    isActive: true,
    totalChaosValue: 1403.0,
    snapshotCount: 3,
    cardDrops: [
      { cardId: 1, cardName: "The Doctor", count: 1, chaosValue: 1250.0 },
      { cardId: 2, cardName: "Humility", count: 5, chaosValue: 7.5 },
      { cardId: 3, cardName: "Rain of Chaos", count: 12, chaosValue: 6.0 },
      { cardId: 8, cardName: "Carrion Crow", count: 35, chaosValue: 7.0 },
      { cardId: 7, cardName: "The Enlightened", count: 3, chaosValue: 135.0 },
    ],
  },
  completed: {
    id: "session-completed-001",
    leagueId: LEAGUES.current.id,
    startedAt: "2024-08-01T10:00:00.000Z",
    endedAt: "2024-08-01T14:30:00.000Z",
    isActive: false,
    totalChaosValue: 320.5,
    snapshotCount: 5,
    cardDrops: [
      { cardId: 2, cardName: "Humility", count: 15, chaosValue: 22.5 },
      { cardId: 3, cardName: "Rain of Chaos", count: 40, chaosValue: 20.0 },
      { cardId: 6, cardName: "The Wretched", count: 8, chaosValue: 16.0 },
      { cardId: 7, cardName: "The Enlightened", count: 5, chaosValue: 225.0 },
      { cardId: 8, cardName: "Carrion Crow", count: 74, chaosValue: 14.8 },
    ],
  },
  oldLeague: {
    id: "session-old-001",
    leagueId: LEAGUES.previous.id,
    startedAt: "2024-05-15T08:00:00.000Z",
    endedAt: "2024-05-15T12:00:00.000Z",
    isActive: false,
    totalChaosValue: 50.0,
    snapshotCount: 2,
    cardDrops: [
      { cardId: 3, cardName: "Rain of Chaos", count: 100, chaosValue: 50.0 },
    ],
  },
} as const;

export const ALL_SESSIONS: TestSession[] = Object.values(SESSIONS);

// ─── Setup Wizard ─────────────────────────────────────────────────────────────

/**
 * Setup state representing a fresh install (no setup completed).
 */
export const FRESH_SETUP_STATE = {
  isComplete: false,
  currentStep: 0,
  selectedGame: null,
  selectedLeague: null,
  clientPath: null,
  telemetryConsent: null,
  validationError: null,
} as const;

/**
 * Setup state representing a completed setup.
 */
export const COMPLETED_SETUP_STATE = {
  isComplete: true,
  currentStep: 4,
  selectedGame: GAME_TYPES.poe1,
  selectedLeague: LEAGUES.current.id,
  clientPath:
    "C:\\Program Files (x86)\\Steam\\steamapps\\common\\Path of Exile\\logs\\Client.txt",
  telemetryConsent: true,
  validationError: null,
} as const;

/**
 * A valid client log file path for testing setup validation.
 */
export const VALID_CLIENT_PATH =
  "C:\\Program Files (x86)\\Steam\\steamapps\\common\\Path of Exile\\logs\\Client.txt";

/**
 * An invalid client log file path for testing validation errors.
 */
export const INVALID_CLIENT_PATH = "C:\\nonexistent\\Client.txt";

// ─── Settings ─────────────────────────────────────────────────────────────────

export interface TestSettings {
  key: string;
  value: unknown;
  label: string;
  category: string;
}

export const DEFAULT_SETTINGS: Record<string, TestSettings> = {
  audioEnabled: {
    key: "audio.enabled",
    value: true,
    label: "Sound Effects",
    category: "Audio",
  },
  audioVolume: {
    key: "audio.volume",
    value: 0.5,
    label: "Volume",
    category: "Audio",
  },
  overlayEnabled: {
    key: "overlay.enabled",
    value: true,
    label: "Enable Overlay",
    category: "Overlay",
  },
  priceSource: {
    key: "prices.source",
    value: "poe-ninja",
    label: "Price Source",
    category: "Prices",
  },
  telemetryCrashReporting: {
    key: "telemetry.crashReporting",
    value: true,
    label: "Crash Reporting",
    category: "Telemetry",
  },
  telemetryAnalytics: {
    key: "telemetry.analytics",
    value: true,
    label: "Analytics",
    category: "Telemetry",
  },
} as const;

// ─── Rarity Insights ──────────────────────────────────────────────────────────

export interface TestRaritySource {
  id: string;
  name: string;
  description: string;
}

export const RARITY_SOURCES: TestRaritySource[] = [
  {
    id: "prohibited-library",
    name: "Prohibited Library",
    description: "Community-sourced rarity weights from data mining",
  },
  {
    id: "personal",
    name: "Personal Data",
    description: "Rarity derived from your own drop history",
  },
] as const;

// ─── Profit Forecast ──────────────────────────────────────────────────────────

export interface TestProfitForecastEntry {
  cardName: string;
  expectedValue: number;
  dropRate: number;
  profitPerMap: number;
}

export const PROFIT_FORECAST_DATA: TestProfitForecastEntry[] = [
  {
    cardName: "The Doctor",
    expectedValue: 156.25,
    dropRate: 0.001,
    profitPerMap: 1.25,
  },
  {
    cardName: "House of Mirrors",
    expectedValue: 25.0,
    dropRate: 0.0001,
    profitPerMap: 2.5,
  },
  {
    cardName: "The Nurse",
    expectedValue: 18.75,
    dropRate: 0.005,
    profitPerMap: 0.75,
  },
] as const;

// ─── Client Log Lines ─────────────────────────────────────────────────────────

/**
 * Simulated PoE client.txt log lines for card drop detection.
 * The current session tracking reads these from the log file.
 */
export const CLIENT_LOG_LINES = {
  /** A line indicating a card drop (The Doctor) */
  doctorDrop:
    "2024/08/01 12:00:00 12345678 abc [INFO Client 12345] : You have received: The Doctor divination card",
  /** A line indicating a card drop (Humility) */
  humilityDrop:
    "2024/08/01 12:00:01 12345679 abc [INFO Client 12345] : You have received: Humility divination card",
  /** A zone change line */
  zoneChange:
    "2024/08/01 12:00:05 12345680 abc [INFO Client 12345] : You have entered The Blood Aqueduct.",
  /** A generic log line (not a drop) */
  genericLine:
    "2024/08/01 12:00:10 12345681 abc [INFO Client 12345] : Connecting to instance server",
} as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Creates a deep copy of a test data object so tests can mutate without
 * affecting other tests.
 */
export function cloneFixture<T>(fixture: T): T {
  return JSON.parse(JSON.stringify(fixture));
}

/**
 * Generates a unique session ID for test isolation.
 */
export function generateTestSessionId(prefix = "e2e"): string {
  return `${prefix}-session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Creates a session fixture with overrides.
 */
export function createTestSession(
  overrides: Partial<TestSession> = {},
): TestSession {
  return {
    id: generateTestSessionId(),
    leagueId: LEAGUES.current.id,
    startedAt: new Date().toISOString(),
    endedAt: null,
    isActive: true,
    totalChaosValue: 0,
    snapshotCount: 0,
    cardDrops: [],
    ...overrides,
  };
}

/**
 * Creates a card fixture with overrides.
 */
export function createTestCard(
  overrides: Partial<TestDivinationCard> = {},
): TestDivinationCard {
  const id = overrides.id ?? Math.floor(Math.random() * 10000) + 100;
  const name = overrides.name ?? `Test Card ${id}`;
  return {
    id,
    name,
    slug: name.toLowerCase().replace(/\s+/g, "-"),
    stackSize: 8,
    artFilename: `${name.replace(/\s+/g, "")}.png`,
    rewardText: "Test Reward",
    flavourText: "Test flavour text.",
    chaosValue: 10.0,
    divineValue: 0.07,
    rarity: "uncommon",
    dropSources: ["Test Zone"],
    ...overrides,
  };
}
