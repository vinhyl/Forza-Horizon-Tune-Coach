export type ConfidenceLevel = "low" | "medium" | "high" | "variable";
export type SourceType =
  | "official"
  | "authority_guide"
  | "community"
  | "user_input"
  | "user_tested"
  | "sample";

export type EventType =
  | "road_racing"
  | "dirt_racing"
  | "cross_country"
  | "touge"
  | "street_racing"
  | "drag_racing"
  | "time_attack"
  | "speed_traps"
  | "speed_zones"
  | "danger_signs"
  | "drift_zones"
  | "trailblazers"
  | string;
export type TargetClass = "A" | "S1" | string;
export type Drivetrain = "RWD" | "AWD" | "FWD" | string;
export type FeedbackType =
  | "greatly_improved"
  | "slightly_improved"
  | "no_change"
  | "worse";
export type BuildCapability =
  | "tunable_brakes"
  | "tunable_suspension"
  | "tunable_antiroll_bars"
  | "tunable_differential"
  | "tunable_front_aero"
  | "tunable_rear_aero"
  | "tunable_tire_pressure"
  | "adjustable_gearing"
  | string;
export type ObservationKey =
  | "is_available"
  | "pi_before"
  | "pi_after"
  | "pi_delta"
  | "stat_speed_delta"
  | "stat_handling_delta"
  | "stat_braking_delta"
  | "stat_launch_delta"
  | "unlocks_tuning"
  | "symptom_after_install"
  | "user_feel"
  | string;

export interface SourceRecord {
  id: string;
  title: string;
  type: SourceType;
  confidence: ConfidenceLevel;
  notes?: string;
  sample?: boolean;
  [key: string]: unknown;
}

export interface RuleScope {
  class?: TargetClass[];
  eventType?: EventType[];
  drivetrain?: Drivetrain[];
  appliesTo?: EventType[];
  [key: string]: unknown;
}

export interface GoalRule {
  id: string;
  name: string;
  summary: string;
  confidence: ConfidenceLevel;
  sourceIds: string[];
  scope: RuleScope;
  priorities: string[];
  upgradePlan?: UpgradePlanStep[];
  baselineTunePlan?: BaselineTuneStep[];
  firstTestPlan?: TestStep[];
  escalationRules?: EscalationRule[];
  avoidFirst?: string[];
  ifOverPI?: string[];
  notes?: string;
  sample?: boolean;
  [key: string]: unknown;
}

export interface ObservationRequest {
  key: ObservationKey;
  prompt: string;
  requiredWhen?: string[];
  optionalWhen?: string[];
  skipWhen?: string[];
  choices?: { value: string; label: string }[];
}

export interface PartDetail {
  partId: string;
  benefit: string;
  cost?: string;
}

export interface UpgradePlanStep {
  id: string;
  phase: string;
  candidateParts: string[];
  purpose: string;
  reason: string;
  expectedBenefits: string[];
  expectedCosts?: string[];
  partDetails?: PartDetail[];
  requiredCapabilities?: BuildCapability[];
  grantsCapabilities?: BuildCapability[];
  knownFacts?: string[];
  askWhenNeeded?: ObservationRequest[];
  keepWhen?: string[];
  skipWhen?: string[];
  fallbackParts?: string[];
  handoffSymptoms?: string[];
  sourceIds: string[];
  confidence: ConfidenceLevel;
  [key: string]: unknown;
}

export interface BaselineTuneStep {
  id: string;
  tuningArea: string;
  title: string;
  purpose: string;
  appliesWhen?: string[];
  requiresCapabilities?: BuildCapability[];
  knownFacts?: string[];
  baselineAction: string;
  safeRange?: string;
  doNotOptimizeYet?: string[];
  askWhenNeeded?: ObservationRequest[];
  handoffSymptoms?: string[];
  sourceIds: string[];
  confidence: ConfidenceLevel;
  [key: string]: unknown;
}

export interface TestStep {
  id: string;
  title: string;
  method: string;
  observe: string[];
  nextIfProblem?: { symptomId: string; label: string }[];
}

export interface EscalationRule {
  when: string[];
  targetModule: "diagnostic" | "goal";
  targetId?: string;
  message: string;
}

export type PartCategory =
  | "tires"
  | "platform"
  | "engine"
  | "aero"
  | "drivetrain"
  | "conversion";

export type ExclusiveGroup =
  | "tire_type"
  | "suspension_type";

export interface PartRule {
  id: string;
  name: string;
  category: PartCategory;
  priority: number;
  exclusiveGroup?: ExclusiveGroup;
  grantsCapabilities: BuildCapability[];
  summary: string;
  confidence: ConfidenceLevel;
  sourceIds: string[];
  scope?: RuleScope;
  effects: string[];
  sideEffects: string[];
  goodFor?: string[];
  notRecommendedWhen?: string[];
  relatedParts?: string[];
  notes?: string;
  sample?: boolean;
  [key: string]: unknown;
}

export interface RecommendationStep {
  stepId: string;
  action: string;
  amount?: string;
  reason: string;
  sideEffects?: string[];
  testMethod?: string;
  sourceIds?: string[];
  sourceType?: SourceType | "rule";
  relatedParts?: string[];
  requiresCapabilities?: BuildCapability[];
  fallbackIfMissing?: {
    action: string;
    targetModule: "goal_wizard" | "diagnostic";
    targetId?: string;
  };
  next?: {
    onGreatlyImproved?: string;
    onSlightlyImproved?: string;
    onImproved?: string;
    onNoChange?: string;
    onWorse?: string;
    [key: string]: string | undefined;
  };
  alternatives?: string[];
  weight?: number;
  [key: string]: unknown;
}

export interface FollowUpQuestion {
  id: string;
  label: string;
  type: "single" | "multi" | "text";
  required?: boolean;
  options?: { value: string; label: string }[];
}

export interface SymptomRule {
  id: string;
  name: string;
  summary: string;
  confidence: ConfidenceLevel;
  sourceIds: string[];
  scope: RuleScope;
  conditions?: string[];
  likelyCauses: string[];
  followUpQuestions?: FollowUpQuestion[];
  steps: RecommendationStep[];
  entryStepId: string;
  notes?: string;
  sample?: boolean;
  [key: string]: unknown;
}

export interface FeedbackRule {
  id: string;
  name: string;
  summary: string;
  confidence: ConfidenceLevel;
  sourceIds: string[];
  trigger: { feedback: FeedbackType[] };
  response: {
    type: "keep_and_continue" | "move_to_next_step" | "rollback_and_branch" | string;
    message: string;
    nextMode?: string;
  };
  sample?: boolean;
  [key: string]: unknown;
}

export interface DependencyRule {
  id: string;
  name: string;
  summary: string;
  confidence: ConfidenceLevel;
  sourceIds: string[];
  appliesWhen?: Record<string, unknown>;
  affectedParts?: string[];
  interaction?: {
    parts: string[];
    effect: string;
  };
  guidance: string[];
  weightModifier?: number;
  notes?: string;
  sample?: boolean;
  [key: string]: unknown;
}

export interface BuildCardData {
  id: string;
  carName: string;
  carType?: string;
  weightKg?: number;
  weightDistribution?: number;
  frontSpringMinKgf?: number;
  frontSpringMaxKgf?: number;
  rearSpringMinKgf?: number;
  rearSpringMaxKgf?: number;
  currentPI: string;
  targetClass: TargetClass;
  eventType: EventType;
  drivetrain: Drivetrain;
  drivingPreference: string;
  installedParts: string[];
  observations?: Record<string, string | number | boolean>;
  notes: string;
  createdAt: string;
  updatedAt: string;
  sample?: boolean;
}

export interface DiagnosticHistoryEntry {
  stepId: string;
  action: string;
  feedback: FeedbackType;
  nextStepId?: string;
  at: string;
}

export interface DiagnosticSessionState {
  id: string;
  symptomId?: string;
  currentQuestionId?: string;
  followUpAnswers: Record<string, string | string[]>;
  currentStepId?: string;
  currentRecommendation?: RecommendationStep;
  feedbackHistory: DiagnosticHistoryEntry[];
  alternatives: string[];
  status: "idle" | "asking" | "recommending" | "finished";
  createdAt: string;
  updatedAt: string;
}

export interface CarCatalogEntry {
  id: string;
  make: string;
  makeCn?: string;
  carName: string;
  carType: string;
  carTypeCn?: string;
  initialClass: string;
  initialPI: number;
  rawClass: string;
  country: string;
  collection: string[];
  addOns: string[];
  sourceIds: string[];
}

export interface RuleBundle {
  sources: SourceRecord[];
  goalRules: GoalRule[];
  partRules: PartRule[];
  symptomRules: SymptomRule[];
  feedbackRules: FeedbackRule[];
  dependencyRules: DependencyRule[];
}
