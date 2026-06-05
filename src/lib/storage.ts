import type { BuildCardData, DiagnosticSessionState } from "../types/rules";

const BUILD_KEY = "fhtc.buildCards.v1";
const SESSION_KEY = "fhtc.diagnosticSession.v1";

const legacyEventMap: Record<string, string> = {
  road: "road_racing",
  street: "street_racing",
  touge: "touge",
};

const legacyPreferenceMap: Record<string, string> = {
  stable: "balanced",
  rotation: "handling",
};

function migrateBuildCard(build: BuildCardData): BuildCardData {
  if (legacyEventMap[build.eventType]) {
    build.eventType = legacyEventMap[build.eventType];
  }
  if (legacyPreferenceMap[build.drivingPreference]) {
    build.drivingPreference = legacyPreferenceMap[build.drivingPreference];
  }
  return build;
}

export function loadBuildCards(): BuildCardData[] {
  const cards = readJson<BuildCardData[]>(BUILD_KEY, []);
  return cards.map(migrateBuildCard);
}

export function saveBuildCards(cards: BuildCardData[]) {
  localStorage.setItem(BUILD_KEY, JSON.stringify(cards));
}

export function loadDiagnosticSession(): DiagnosticSessionState | null {
  return readJson<DiagnosticSessionState | null>(SESSION_KEY, null);
}

export function saveDiagnosticSession(session: DiagnosticSessionState | null) {
  if (!session) {
    localStorage.removeItem(SESSION_KEY);
    return;
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function exportWorkspace(cards: BuildCardData[], session: DiagnosticSessionState | null) {
  return JSON.stringify(
    {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      product: "Forza Horizon Tune Coach",
      buildCards: cards,
      diagnosticSession: session,
    },
    null,
    2,
  );
}

export function parseWorkspaceImport(text: string): {
  buildCards: BuildCardData[];
  diagnosticSession: DiagnosticSessionState | null;
} {
  const parsed = JSON.parse(text) as {
    buildCards?: BuildCardData[];
    diagnosticSession?: DiagnosticSessionState | null;
  };

  return {
    buildCards: Array.isArray(parsed.buildCards) ? parsed.buildCards : [],
    diagnosticSession: parsed.diagnosticSession ?? null,
  };
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
