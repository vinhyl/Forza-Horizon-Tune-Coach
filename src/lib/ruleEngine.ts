import { rules } from "./ruleData";
import type {
  BaselineTuneStep,
  BuildCardData,
  BuildCapability,
  DependencyRule,
  DiagnosticSessionState,
  FeedbackRule,
  FeedbackType,
  GoalRule,
  ObservationRequest,
  RecommendationStep,
  SymptomRule,
  UpgradePlanStep,
} from "../types/rules";

export function createEmptyBuild(): BuildCardData {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    carName: "",
    currentPI: "",
    targetClass: "A",
    eventType: "road",
    drivetrain: "RWD",
    drivingPreference: "stable",
    installedParts: [],
    observations: {},
    notes: "",
    createdAt: now,
    updatedAt: now,
  };
}

export function inferBuildCapabilities(build?: BuildCardData): BuildCapability[] {
  if (!build) return [];
  const partCapabilities: Record<string, BuildCapability[]> = {
    brakes: ["tunable_brakes"],
    suspension: ["tunable_suspension"],
    antiroll_bars: ["tunable_antiroll_bars"],
    differential: ["tunable_differential"],
    transmission: ["adjustable_gearing"],
    aero_front: ["tunable_front_aero"],
    aero_rear: ["tunable_rear_aero"],
  };
  return Array.from(
    new Set(build.installedParts.flatMap((part) => partCapabilities[part] ?? [])),
  );
}

export function summarizeGoalPlan(rule: GoalRule | undefined, build?: BuildCardData) {
  const capabilities = inferBuildCapabilities(build);
  const capabilitySet = new Set(capabilities);
  const upgradePlan = rule?.upgradePlan ?? [];
  const baselineTunePlan = rule?.baselineTunePlan ?? [];

  const upgradeStatuses = upgradePlan.map((step) => ({
    step,
    installedParts: step.candidateParts.filter((part) => build?.installedParts.includes(part)),
    missingParts: step.candidateParts.filter((part) => !build?.installedParts.includes(part)),
    grantedCapabilities: step.grantsCapabilities ?? [],
    missingQuestions: getNeededObservationRequests(step.askWhenNeeded, build, step.id),
    status: getUpgradeStatus(step, build),
  }));

  const tuneStatuses = baselineTunePlan.map((step) => ({
    step,
    missingCapabilities: (step.requiresCapabilities ?? []).filter((capability) => !capabilitySet.has(capability)),
    missingQuestions: getNeededObservationRequests(step.askWhenNeeded, build, step.id),
  }));

  const nextUpgrade =
    upgradeStatuses.find((item) => item.status !== "complete") ?? upgradeStatuses[upgradeStatuses.length - 1];
  const nextTune =
    tuneStatuses.find((item) => item.missingCapabilities.length === 0) ?? tuneStatuses[0];

  return {
    capabilities,
    upgradeStatuses,
    tuneStatuses,
    nextUpgrade,
    nextTune,
  };
}

export function getMissingCapabilitiesForStep(
  step: RecommendationStep | undefined,
  build?: BuildCardData,
): BuildCapability[] {
  const required = step?.requiresCapabilities ?? inferRequiredCapabilitiesFromParts(step?.relatedParts ?? []);
  const capabilities = new Set(inferBuildCapabilities(build));
  return required.filter((capability) => !capabilities.has(capability));
}

export function createDiagnosticSession(): DiagnosticSessionState {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    followUpAnswers: {},
    feedbackHistory: [],
    alternatives: [],
    status: "idle",
    createdAt: now,
    updatedAt: now,
  };
}

export function findGoalRules(input: {
  eventType: string;
  targetClass: string;
  drivetrain: string;
}): GoalRule[] {
  return rules.goalRules
    .map((rule) => ({ rule, score: scoreScope(rule.scope, input) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.rule);
}

export function startSymptomSession(
  symptomId: string,
  previous?: DiagnosticSessionState | null,
): DiagnosticSessionState {
  const symptom = getSymptom(symptomId);
  const now = new Date().toISOString();
  const firstQuestion = symptom?.followUpQuestions?.[0]?.id;
  return {
    ...(previous ?? createDiagnosticSession()),
    symptomId,
    currentQuestionId: firstQuestion,
    currentStepId: firstQuestion ? undefined : symptom?.entryStepId,
    currentRecommendation: firstQuestion ? undefined : getStep(symptom, symptom?.entryStepId),
    status: firstQuestion ? "asking" : "recommending",
    updatedAt: now,
  };
}

export function answerFollowUp(
  session: DiagnosticSessionState,
  questionId: string,
  value: string | string[],
): DiagnosticSessionState {
  const symptom = getSymptom(session.symptomId);
  const questions = symptom?.followUpQuestions ?? [];
  const currentIndex = questions.findIndex((question) => question.id === questionId);
  const nextQuestion = questions[currentIndex + 1];
  const nextStepId = symptom?.entryStepId;
  return {
    ...session,
    followUpAnswers: { ...session.followUpAnswers, [questionId]: value },
    currentQuestionId: nextQuestion?.id,
    currentStepId: nextQuestion ? undefined : nextStepId,
    currentRecommendation: nextQuestion ? undefined : getStep(symptom, nextStepId),
    status: nextQuestion ? "asking" : "recommending",
    updatedAt: new Date().toISOString(),
  };
}

export function applyFeedback(
  session: DiagnosticSessionState,
  feedback: FeedbackType,
): { session: DiagnosticSessionState; feedbackRule?: FeedbackRule } {
  const symptom = getSymptom(session.symptomId);
  const step = getStep(symptom, session.currentStepId);
  const nextStepId = resolveNextStep(step, feedback, symptom);
  const feedbackRule = rules.feedbackRules.find((rule) => rule.trigger.feedback.includes(feedback));
  const now = new Date().toISOString();

  return {
    feedbackRule,
    session: {
      ...session,
      currentStepId: nextStepId === "finish" ? undefined : nextStepId,
      currentRecommendation: nextStepId === "finish" ? undefined : getStep(symptom, nextStepId),
      feedbackHistory: [
        ...session.feedbackHistory,
        {
          stepId: step?.stepId ?? "unknown",
          action: step?.action ?? "未记录动作",
          feedback,
          nextStepId,
          at: now,
        },
      ],
      alternatives: Array.from(new Set([...(session.alternatives ?? []), ...(step?.alternatives ?? [])])),
      status: nextStepId === "finish" ? "finished" : "recommending",
      updatedAt: now,
    },
  };
}

export function getRelevantDependencies(step?: RecommendationStep, build?: BuildCardData): DependencyRule[] {
  if (!step) return [];
  const parts = new Set(step.relatedParts ?? []);
  return rules.dependencyRules.filter((rule) => {
    const interactionParts = rule.interaction?.parts ?? rule.affectedParts ?? [];
    const overlaps = interactionParts.some((part) => parts.has(part));
    return overlaps && dependencyApplies(rule, build);
  });
}

export function getSources(sourceIds: string[] = []) {
  return sourceIds
    .map((id) => rules.sources.find((source) => source.id === id))
    .filter(Boolean);
}

export function getSymptom(id?: string): SymptomRule | undefined {
  return rules.symptomRules.find((rule) => rule.id === id);
}

export function getStep(symptom?: SymptomRule, stepId?: string): RecommendationStep | undefined {
  if (!symptom || !stepId || stepId === "finish") return undefined;
  return symptom.steps.find((step) => step.stepId === stepId);
}

function resolveNextStep(
  step: RecommendationStep | undefined,
  feedback: FeedbackType,
  symptom: SymptomRule | undefined,
): string {
  if (!step || !symptom) return "finish";
  const next = step.next ?? {};
  if (feedback === "greatly_improved") {
    return next.onGreatlyImproved ?? next.onImproved ?? "finish";
  }
  if (feedback === "slightly_improved") {
    return next.onSlightlyImproved ?? next.onImproved ?? "finish";
  }
  if (feedback === "no_change") {
    return next.onNoChange ?? step.alternatives?.[0] ?? next.onImproved ?? "finish";
  }
  return next.onWorse ?? step.alternatives?.[0] ?? "finish";
}

function scoreScope(
  scope: Record<string, unknown> | undefined,
  input: { eventType: string; targetClass: string; drivetrain: string },
) {
  if (!scope) return 0;
  let score = 0;
  if (matches(scope.eventType, input.eventType)) score += 2;
  if (matches(scope.class, input.targetClass)) score += 2;
  if (matches(scope.drivetrain, input.drivetrain)) score += 2;
  return score;
}

function matches(values: unknown, value: string) {
  return Array.isArray(values) && values.includes(value);
}

function dependencyApplies(rule: DependencyRule, build?: BuildCardData) {
  if (!build || !rule.appliesWhen) return true;
  const drivetrain = rule.appliesWhen.drivetrain;
  if (Array.isArray(drivetrain) && !drivetrain.includes(build.drivetrain)) return false;
  if (rule.appliesWhen.hasFrontAero === true && !build.installedParts.includes("aero_front")) return false;
  if (rule.appliesWhen.hasRearAero === true && !build.installedParts.includes("aero_rear")) return false;
  return true;
}

function getUpgradeStatus(step: UpgradePlanStep, build?: BuildCardData) {
  if (!build) return "unknown";
  const missingParts = step.candidateParts.filter((part) => !build.installedParts.includes(part));
  if (missingParts.length === 0) return "complete";
  if (missingParts.length < step.candidateParts.length) return "partial";
  return "missing";
}

function getNeededObservationRequests(
  requests: ObservationRequest[] | undefined,
  build?: BuildCardData,
  scopeId?: string,
) {
  if (!requests || !build) return requests ?? [];
  const observations = build.observations ?? {};
  return requests.filter((request) => {
    const scopedKey = scopeId ? `${scopeId}.${request.key}` : request.key;
    return observations[scopedKey] === undefined && observations[request.key] === undefined;
  });
}

export function isBaselineTuneStep(step: unknown): step is BaselineTuneStep {
  return Boolean(step && typeof step === "object" && "baselineAction" in step);
}

function inferRequiredCapabilitiesFromParts(parts: string[]) {
  const partRequirements: Record<string, BuildCapability[]> = {
    brakes: ["tunable_brakes"],
    suspension: ["tunable_suspension"],
    antiroll_bars: ["tunable_antiroll_bars"],
    differential: ["tunable_differential"],
    transmission: ["adjustable_gearing"],
    aero_front: ["tunable_front_aero"],
    aero_rear: ["tunable_rear_aero"],
  };
  return Array.from(new Set(parts.flatMap((part) => partRequirements[part] ?? [])));
}
