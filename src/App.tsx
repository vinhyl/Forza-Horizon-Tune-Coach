import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Car,
  CheckCircle2,
  ClipboardList,
  Download,
  FileJson,
  Gauge,
  Home,
  RotateCcw,
  Save,
  Trash2,
  Upload,
  Wrench,
} from "lucide-react";
import {
  answerFollowUp,
  applyFeedback,
  createDiagnosticSession,
  createEmptyBuild,
  findGoalRules,
  getCarTypeHints,
  getBaselineTuneHints,
  getMissingCapabilitiesForStep,
  getRelevantDependencies,
  getSymptom,
  safeUUID,
  startSymptomSession,
  summarizeGoalPlan,
} from "./lib/ruleEngine";
import { labelOf, rules, carCatalog, categoryLabels, categoryOrder } from "./lib/ruleData";
import {
  exportWorkspace,
  loadBuildCards,
  loadDiagnosticSession,
  parseWorkspaceImport,
  saveBuildCards,
  saveDiagnosticSession,
} from "./lib/storage";
import type {
  BuildCardData,
  CarCatalogEntry,
  DiagnosticSessionState,
  FeedbackType,
  GoalRule,
  ObservationRequest,
  PartRule,
  RecommendationStep,
} from "./types/rules";

type ViewKey = "home" | "build" | "goal" | "diagnostic" | "parts";

const views: { key: ViewKey; label: string; icon: typeof Home }[] = [
  { key: "home", label: "首页", icon: Home },
  { key: "build", label: "改装卡片", icon: Car },
  { key: "goal", label: "目标向导", icon: ClipboardList },
  { key: "diagnostic", label: "调车问诊", icon: Gauge },
  { key: "parts", label: "部件百科", icon: BookOpen },
];

const eventOptions = [
  { value: "road_racing", label: "公路竞速赛" },
  { value: "dirt_racing", label: "泥地竞速赛" },
  { value: "cross_country", label: "越野竞速赛" },
  { value: "touge", label: "峠道竞速赛" },
  { value: "street_racing", label: "街头竞速赛" },
  { value: "drag_racing", label: "直线加速赛" },
  { value: "time_attack", label: "计时赛" },
  { value: "speed_traps", label: "测速照相" },
  { value: "speed_zones", label: "测速区间" },
  { value: "danger_signs", label: "危险标志" },
  { value: "drift_zones", label: "漂移区域" },
  { value: "trailblazers", label: "拓荒者" },
];

const classOptions = ["D", "C", "B", "A", "S1", "S2", "R"];
const drivetrainOptions = ["RWD", "AWD"];
const preferenceOptions = [
  { value: "speed", label: "速度优先" },
  { value: "balanced", label: "均衡" },
  { value: "handling", label: "操控优先" },
];

export default function App() {
  const [view, setView] = useState<ViewKey>("home");
  const [showCarPicker, setShowCarPicker] = useState(false);
  const [carPickerTarget, setCarPickerTarget] = useState<"new" | string>("new");
  const [builds, setBuilds] = useState<BuildCardData[]>(() => {
    const stored = loadBuildCards();
    if (stored.length > 0) return stored;
    return [];
  });
  const [activeBuildId, setActiveBuildId] = useState<string | undefined>(builds[0]?.id);
  const [session, setSession] = useState<DiagnosticSessionState | null>(() => loadDiagnosticSession());
  const [importText, setImportText] = useState("");
  const [importMessage, setImportMessage] = useState("");

  const activeBuild = builds.find((build) => build.id === activeBuildId) ?? builds[0];

  useEffect(() => saveBuildCards(builds), [builds]);
  useEffect(() => saveDiagnosticSession(session), [session]);

  function updateBuild(id: string, patch: Partial<BuildCardData>) {
    setBuilds((items) =>
      items.map((item) =>
        item.id === id ? { ...item, ...patch, updatedAt: new Date().toISOString() } : item,
      ),
    );
  }

  function addBuild() {
    const next = createEmptyBuild();
    setBuilds((items) => [next, ...items]);
    setActiveBuildId(next.id);
    setView("build");
  }

  function addBuildFromCar(car: CarCatalogEntry) {
    const now = new Date().toISOString();
    const targetClass = inferTargetClass(car.initialClass, car.initialPI);
    const next: BuildCardData = {
      id: safeUUID(),
      carName: car.makeCn ? `${car.makeCn} ${car.carName}` : car.carName,
      carType: car.carType,
      currentPI: car.rawClass,
      targetClass,
      eventType: "road_racing",
      drivetrain: "RWD",
      drivingPreference: "balanced",
      installedParts: [],
      observations: {},
      notes: `原厂等级：${car.rawClass} · 类型：${car.carTypeCn ?? car.carType} · 国家：${car.country}`,
      createdAt: now,
      updatedAt: now,
    };
    if (carPickerTarget === "new") {
      setBuilds((items) => [next, ...items]);
      setActiveBuildId(next.id);
      setView("build");
    } else {
      updateBuild(carPickerTarget, {
        carName: next.carName,
        currentPI: next.currentPI,
        targetClass: next.targetClass,
        notes: next.notes,
      });
    }
    setShowCarPicker(false);
  }

  function openCarPicker(target: "new" | string) {
    setCarPickerTarget(target);
    setShowCarPicker(true);
  }

  function deleteBuild(id: string) {
    const nextBuilds = builds.filter((build) => build.id !== id);
    setBuilds(nextBuilds);
    setActiveBuildId(nextBuilds[0]?.id);
  }

  function downloadJson() {
    const blob = new Blob([exportWorkspace(builds, session)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "forza-horizon-tune-coach-export.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  function importJson() {
    try {
      const imported = parseWorkspaceImport(importText);
      setBuilds(imported.buildCards);
      setActiveBuildId(imported.buildCards[0]?.id);
      setSession(imported.diagnosticSession);
      setImportMessage("导入完成。");
    } catch {
      setImportMessage("导入失败：JSON 格式无法解析。");
    }
  }

  return (
    <main className="min-h-screen bg-paper">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-signal">
              Forza Horizon Tune Coach
            </p>
            <h1 className="text-2xl font-bold text-asphalt md:text-3xl">交互式改装问诊助手</h1>
          </div>
          <nav className="flex gap-2 overflow-x-auto pb-1">
            {views.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.key}
                  className={`secondary-button whitespace-nowrap ${
                    view === item.key ? "border-asphalt bg-asphalt text-white hover:bg-asphalt" : ""
                  }`}
                  onClick={() => setView(item.key)}
                >
                  <Icon size={17} />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-5 px-4 py-5 lg:grid-cols-[280px_1fr]">
        <aside className="space-y-4">
          <ActiveBuildSummary build={activeBuild} onSelectBuild={() => setView("build")} />
          <JsonTools
            importText={importText}
            importMessage={importMessage}
            onChangeImportText={setImportText}
            onDownload={downloadJson}
            onImport={importJson}
          />
        </aside>

        <section className="min-w-0">
          {view === "home" && (
            <HomePanel
              onBuildFromCatalog={() => openCarPicker("new")}
              onBuildBlank={addBuild}
              onDiagnose={() => {
                setView("diagnostic");
                setSession((current) => current ?? createDiagnosticSession());
              }}
              onParts={() => setView("parts")}
            />
          )}
          {view === "build" && (
            <BuildCardPanel
              builds={builds}
              activeBuildId={activeBuild?.id}
              onSelect={setActiveBuildId}
              onAdd={addBuild}
              onAddFromCatalog={() => openCarPicker("new")}
              onFillFromCatalog={(buildId) => openCarPicker(buildId)}
              onDelete={deleteBuild}
              onUpdate={updateBuild}
            />
          )}
          {view === "goal" && <GoalWizard build={activeBuild} onApplyBuild={updateBuild} />}
          {view === "diagnostic" && (
            <DiagnosticPanel
              build={activeBuild}
              session={session}
              onSessionChange={setSession}
              onOpenGoal={() => setView("goal")}
            />
          )}
          {view === "parts" && <PartsEncyclopedia />}
        </section>
      </div>

      {showCarPicker && (
        <CarPickerModal
          onSelect={addBuildFromCar}
          onClose={() => setShowCarPicker(false)}
          onBlank={carPickerTarget === "new" ? addBuild : undefined}
        />
      )}
    </main>
  );
}

function ActiveBuildSummary({
  build,
  onSelectBuild,
}: {
  build?: BuildCardData;
  onSelectBuild: () => void;
}) {
  return (
    <div className="panel p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-bold">当前改装卡片</h2>
        <button className="icon-button" title="编辑卡片" onClick={onSelectBuild}>
          <Wrench size={17} />
        </button>
      </div>
      {build ? (
        <div className="space-y-2 text-sm">
          <p className="font-semibold">{build.carName || "未命名车辆"}</p>
          <div className="flex flex-wrap gap-2">
            <span className="tag">{build.currentPI || "PI 未填"}</span>
            <span className="tag">{build.targetClass}</span>
            <span className="tag">{labelOf(build.eventType)}</span>
            <span className="tag">{build.drivetrain}</span>
          </div>
        </div>
      ) : (
        <p className="text-sm text-asphalt/60">还没有车辆卡片。</p>
      )}
    </div>
  );
}

function JsonTools({
  importText,
  importMessage,
  onChangeImportText,
  onDownload,
  onImport,
}: {
  importText: string;
  importMessage: string;
  onChangeImportText: (text: string) => void;
  onDownload: () => void;
  onImport: () => void;
}) {
  return (
    <div className="panel p-4">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-bold">
        <FileJson size={17} />
        JSON 导入 / 导出
      </h2>
      <div className="flex gap-2">
        <button className="secondary-button flex-1" onClick={onDownload}>
          <Download size={16} />
          导出
        </button>
        <button className="secondary-button flex-1" onClick={onImport}>
          <Upload size={16} />
          导入
        </button>
      </div>
      <textarea
        className="field mt-3 min-h-28 resize-y"
        placeholder="粘贴导出的 JSON..."
        value={importText}
        onChange={(event) => onChangeImportText(event.target.value)}
      />
      {importMessage && <p className="mt-2 text-xs text-asphalt/70">{importMessage}</p>}
    </div>
  );
}

function HomePanel({
  onBuildFromCatalog,
  onBuildBlank,
  onDiagnose,
  onParts,
}: {
  onBuildFromCatalog: () => void;
  onBuildBlank: () => void;
  onDiagnose: () => void;
  onParts: () => void;
}) {
  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-lg bg-asphalt text-white">
        <div className="grid min-h-[330px] items-end bg-[linear-gradient(120deg,rgba(32,37,43,0.92),rgba(32,37,43,0.58)),url('https://images.unsplash.com/photo-1503736334956-4c8f8e92946d?auto=format&fit=crop&w=1600&q=80')] bg-cover bg-center p-6 md:p-10">
          <div className="max-w-3xl">
            <h2 className="text-3xl font-bold md:text-5xl">Forza Horizon Tune Coach</h2>
            <p className="mt-4 max-w-2xl text-base text-white/82 md:text-lg">
              面向 FH6 新手和轻中度玩家的规则驱动调车教练。它不假装拥有完整数据库，只帮你把当前手感问题拆成可测试的下一步。
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button className="primary-button" onClick={onBuildFromCatalog}>
                <Car size={18} />
                我要改一台车
              </button>
              <button className="secondary-button border-white/25 bg-white/10 text-white hover:bg-white/20" onClick={onDiagnose}>
                <Gauge size={18} />
                我的车不好开
              </button>
              <button className="secondary-button border-white/25 bg-white/10 text-white hover:bg-white/20" onClick={onParts}>
                <BookOpen size={18} />
                我想了解一个部件
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          ["权威数据打底", "用公开可验证的数据确定边界：车辆基础信息、部件作用和通用调校原则。"],
          ["游戏内反馈校准", "官方数据无法确认的 PI、可装零件和手感变化，由你在游戏里少量确认。"],
          ["一步一测", "每次只推荐最值得尝试的下一步，保留、回退或进入问诊都基于测试结果。"],
        ].map(([title, body]) => (
          <article className="panel p-5" key={title}>
            <h3 className="font-bold">{title}</h3>
            <p className="mt-2 text-sm leading-6 text-asphalt/70">{body}</p>
          </article>
        ))}
      </section>
    </div>
  );
}

function BuildCardPanel({
  builds,
  activeBuildId,
  onSelect,
  onAdd,
  onAddFromCatalog,
  onFillFromCatalog,
  onDelete,
  onUpdate,
}: {
  builds: BuildCardData[];
  activeBuildId?: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onAddFromCatalog: () => void;
  onFillFromCatalog: (buildId: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, patch: Partial<BuildCardData>) => void;
}) {
  const active = builds.find((build) => build.id === activeBuildId) ?? builds[0];

  return (
    <div className="grid gap-5 xl:grid-cols-[280px_1fr]">
      <div className="panel p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-bold">车辆卡片</h2>
          <div className="flex gap-1">
            <button className="icon-button" title="从车型库选择" onClick={onAddFromCatalog}>
              <Car size={17} />
            </button>
          </div>
        </div>
        <div className="space-y-2">
          {builds.map((build) => (
            <button
              key={build.id}
              className={`w-full rounded-md border px-3 py-2 text-left text-sm transition ${
                active?.id === build.id ? "border-asphalt bg-asphalt text-white" : "border-line bg-white hover:bg-paper"
              }`}
              onClick={() => onSelect(build.id)}
            >
              <span className="block font-semibold">{build.carName || "未命名车辆"}</span>
              <span className="text-xs opacity-75">
                {build.currentPI || "PI 未填"} · {build.targetClass} · {build.drivetrain}
              </span>
            </button>
          ))}
        </div>
      </div>

      {active ? (
        <div className="panel p-5">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 className="text-xl font-bold">当前改装卡片</h2>
            <div className="flex gap-2">
              <button className="secondary-button" onClick={() => onFillFromCatalog(active.id)}>
                <Car size={16} />
                从车型库填充
              </button>
              <button className="secondary-button text-signal" onClick={() => onDelete(active.id)}>
                <Trash2 size={16} />
                删除
              </button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="车辆名称">
              <input className="field" value={active.carName} onChange={(e) => onUpdate(active.id, { carName: e.target.value })} />
            </Field>
            <Field label="当前 PI">
              <input className="field" placeholder="例如 A700 / S1 900" value={active.currentPI} onChange={(e) => onUpdate(active.id, { currentPI: e.target.value })} />
            </Field>
            <Field label="目标等级">
              <select className="field" value={active.targetClass} onChange={(e) => onUpdate(active.id, { targetClass: e.target.value })}>
                {classOptions.map((option) => <option key={option} value={option}>{labelOf(option)}</option>)}
              </select>
            </Field>
            <Field label="赛事类型">
              <select className="field" value={active.eventType} onChange={(e) => onUpdate(active.id, { eventType: e.target.value })}>
                {eventOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </Field>
            <Field label="驱动形式">
              <select className="field" value={active.drivetrain} onChange={(e) => onUpdate(active.id, { drivetrain: e.target.value })}>
                {drivetrainOptions.map((option) => <option key={option}>{option}</option>)}
              </select>
            </Field>
            <Field label="驾驶偏好">
              <select className="field" value={active.drivingPreference} onChange={(e) => onUpdate(active.id, { drivingPreference: e.target.value })}>
                {preferenceOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </Field>
          </div>

          <div className="mt-5">
            <p className="mb-2 text-sm font-semibold">已安装升级部件</p>
            {categoryOrder.map((cat) => {
              const parts = rules.partRules.filter((p) => p.category === cat);
              if (parts.length === 0) return null;
              return (
                <PartCategoryGroup
                  key={cat}
                  category={cat}
                  parts={parts}
                  installedParts={active.installedParts}
                  onChange={(installedParts) => onUpdate(active.id, { installedParts })}
                />
              );
            })}
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label="车重（kg）" hint="从游戏调校界面读取">
              <input
                type="number"
                className="field"
                placeholder="如 1450"
                value={active.weightKg ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  onUpdate(active.id, { weightKg: v === "" ? undefined : Number(v) });
                }}
              />
            </Field>
            <Field label="前轴重量分配（%）" hint="如 55 表示 55/45">
              <input
                type="number"
                className="field"
                placeholder="如 55"
                min={40}
                max={70}
                value={active.weightDistribution ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  onUpdate(active.id, { weightDistribution: v === "" ? undefined : Number(v) });
                }}
              />
            </Field>
          </div>

          <Field label="自定义备注" className="mt-5">
            <textarea className="field min-h-28 resize-y" value={active.notes} onChange={(e) => onUpdate(active.id, { notes: e.target.value })} />
          </Field>
          <p className="mt-4 flex items-center gap-2 text-xs text-asphalt/60">
            <Save size={14} />
            已自动保存到 localStorage。最后更新：{new Date(active.updatedAt).toLocaleString()}
          </p>
        </div>
      ) : (
        <div className="panel p-6">还没有改装卡片。</div>
      )}
    </div>
  );
}

function GoalWizard({
  build,
  onApplyBuild,
}: {
  build?: BuildCardData;
  onApplyBuild: (id: string, patch: Partial<BuildCardData>) => void;
}) {
  const [eventType, setEventType] = useState(build?.eventType ?? "road_racing");
  const [targetClass, setTargetClass] = useState(build?.targetClass ?? "A");
  const [drivetrain, setDrivetrain] = useState(build?.drivetrain ?? "RWD");
  const [drivingPreference, setDrivingPreference] = useState(build?.drivingPreference ?? "balanced");
  const matches = useMemo(() => findGoalRules({ eventType, targetClass, drivetrain, carType: build?.carType, weightKg: build?.weightKg, drivingPreference }), [eventType, targetClass, drivetrain, build?.carType, build?.weightKg, drivingPreference]);
  const primary = matches[0];
  const summary = summarizeGoalPlan(primary, build);

  useEffect(() => {
    if (!build) return;
    setEventType(build.eventType);
    setTargetClass(build.targetClass);
    setDrivetrain(build.drivetrain);
    setDrivingPreference(build.drivingPreference);
  }, [build?.id, build?.eventType, build?.targetClass, build?.drivetrain, build?.drivingPreference]);

  return (
    <div className="space-y-5">
      <div className="panel p-5">
        <h2 className="mb-4 text-xl font-bold">改装目标向导</h2>
        <p className="mb-4 text-sm leading-6 text-asphalt/70">
          构建模块负责从原厂车出发，给出基础改装、基础调校和首次测试流程；出现明确症状后，再交给问诊模块做局部修正。
        </p>
        <div className="grid gap-4 md:grid-cols-4">
          <Field label="赛事类型">
            <select className="field" value={eventType} onChange={(e) => setEventType(e.target.value)}>
              {eventOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </Field>
          <Field label="目标等级">
            <select className="field" value={targetClass} onChange={(e) => setTargetClass(e.target.value)}>
              {classOptions.map((option) => <option key={option} value={option}>{labelOf(option)}</option>)}
            </select>
          </Field>
          <Field label="驱动形式">
            <select className="field" value={drivetrain} onChange={(e) => setDrivetrain(e.target.value)}>
              {drivetrainOptions.map((option) => <option key={option}>{option}</option>)}
            </select>
          </Field>
          <Field label="驾驶偏好">
            <select className="field" value={drivingPreference} onChange={(e) => setDrivingPreference(e.target.value)}>
              {preferenceOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </Field>
        </div>
        {build && (
          <button
            className="primary-button mt-4"
            onClick={() => onApplyBuild(build.id, { eventType, targetClass, drivetrain, drivingPreference })}
          >
            <Save size={16} />
            应用到当前卡片
          </button>
        )}
      </div>

      {primary ? <GoalRulePanel rule={primary} build={build} summary={summary} onApplyBuild={onApplyBuild} /> : <NoRuleMessage />}
    </div>
  );
}

function GoalRulePanel({
  rule,
  build,
  summary,
  onApplyBuild,
}: {
  rule: GoalRule;
  build?: BuildCardData;
  summary: ReturnType<typeof summarizeGoalPlan>;
  onApplyBuild: (id: string, patch: Partial<BuildCardData>) => void;
}) {
  function markPartInstalled(partId: string) {
    if (!build || build.installedParts.includes(partId)) return;
    onApplyBuild(build.id, {
      installedParts: [...build.installedParts, partId],
    });
  }

  return (
    <div className="space-y-5">
      <div className="panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-xl font-bold">{rule.name}</h3>
            <p className="mt-2 text-sm leading-6 text-asphalt/72">{rule.summary}</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {summary.capabilities.length > 0 ? (
            summary.capabilities.map((capability) => <span className="tag" key={capability}>{capabilityLabel(capability)}</span>)
          ) : (
            <span className="tag">尚未推导出可调能力</span>
          )}
        </div>
      </div>

      {summary.nextUpgrade && (
        <div className="panel border-l-4 border-l-signal p-5">
          <p className="text-sm font-semibold text-signal">当前下一步</p>
          <h3 className="mt-1 text-xl font-bold">{summary.nextUpgrade.step.phase}</h3>
          <p className="mt-2 text-sm leading-6 text-asphalt/70">{summary.nextUpgrade.step.purpose}</p>
          {summary.nextUpgrade.missingParts.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="tag">建议先确认/尝试</span>
              {summary.nextUpgrade.missingParts.map((part) => <span className="tag" key={part}>{labelOf(part)}</span>)}
            </div>
          )}
        </div>
      )}

      <section className="panel p-5">
        <h3 className="mb-4 text-lg font-bold">基础改装路线</h3>
        <div className="space-y-4">
          {summary.upgradeStatuses.map(({ step, installedParts, missingParts, missingQuestions, status }) => {
            const isMisc = step.phase.includes("其他升级建议");
            return (
            <article key={step.id} className={`rounded-lg border p-4 ${isMisc ? "border-dashed border-slate-300 bg-slate-50/50" : "border-line bg-paper"}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-bold">{isMisc && "📎 "}{step.phase}</p>
                  <p className="mt-1 text-sm leading-6 text-asphalt/70">{step.reason}</p>
                </div>
                <span className="tag">{status === "complete" ? "已具备" : status === "partial" ? "部分具备" : isMisc ? "按需选择" : "待确认"}</span>
              </div>
              {isMisc && step.partDetails?.length ? (
                <div className="mt-3 space-y-2">
                  {step.partDetails.map((pd) => {
                    const isInstalled = installedParts.includes(pd.partId);
                    return (
                      <div key={pd.partId} className={`flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${isInstalled ? "border-signal/30 bg-signal/5" : "border-line bg-white"}`}>
                        <span className="shrink-0 font-semibold text-asphalt/80">{labelOf(pd.partId)}</span>
                        <span className="text-asphalt/60">—</span>
                        <span className="text-asphalt/70">{pd.benefit}</span>
                        {pd.cost && <span className="ml-auto shrink-0 text-amber-600/80 text-xs">⚠ {pd.cost}</span>}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-3 grid gap-3 lg:grid-cols-3">
                  <ListBlock title="候选部件" items={step.candidateParts} />
                  <ListBlock title="预期收益" items={step.expectedBenefits} mapItem={labelOf} />
                  <ListBlock title="需要权衡" items={step.expectedCosts ?? []} mapItem={labelOf} />
                </div>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {installedParts.map((part) => <span className="tag" key={part}>已装：{labelOf(part)}</span>)}
                {missingParts.map((part) => (
                  build ? (
                    <button
                      key={part}
                      className="tag transition hover:border-asphalt hover:bg-white"
                      onClick={() => markPartInstalled(part)}
                      title={`标记已安装 ${labelOf(part)}`}
                    >
                      待试：{labelOf(part)}
                    </button>
                  ) : (
                    <span className="tag" key={part}>待试：{labelOf(part)}</span>
                  )
                ))}
                {(step.grantsCapabilities ?? []).map((capability) => <span className="tag" key={capability}>获得：{capabilityLabel(capability)}</span>)}
              </div>
              {getCarTypeHints(build?.carType, step.candidateParts, build?.weightKg, build?.weightDistribution, build?.drivetrain).map((hint, i) => (
                <p key={i} className={`mt-2 rounded-md border px-3 py-2 text-sm ${
                  hint.level === "warning" ? "border-red-300 bg-red-50 text-red-800" :
                  hint.level === "important" ? "border-amber-300 bg-amber-50 text-amber-800" :
                  "border-slate-200 bg-slate-50 text-slate-700"
                }`}>{hint.level === "warning" ? "⚠️" : hint.level === "important" ? "💡" : "ℹ️"} {hint.text}</p>
              ))}
              {build && missingQuestions.length > 0 && (
                <ObservationQuestions
                  build={build}
                  scopeId={step.id}
                  requests={missingQuestions}
                  onApplyBuild={onApplyBuild}
                />
              )}
              {step.handoffSymptoms && step.handoffSymptoms.length > 0 && (
                <div className="mt-3">
                  <p className="mb-2 text-sm font-semibold">测试后如果出现这些问题</p>
                  <div className="flex flex-wrap gap-2">
                    {step.handoffSymptoms.map((symptomId) => (
                      <span className="tag" key={symptomId}>{getSymptom(symptomId)?.name ?? symptomId}</span>
                    ))}
                  </div>
                </div>
              )}
            </article>
            );
          })}
        </div>
      </section>

      <section className="panel p-5">
        <h3 className="mb-4 text-lg font-bold">基础调校路线</h3>
        {build && (
          <div className="mb-4 grid gap-4 sm:grid-cols-2">
            <Field label="车重（kg）" hint="改装后请更新">
              <input type="number" className="field" placeholder="如 1450"
                value={build.weightKg ?? ""}
                onChange={(e) => { const v = e.target.value; onApplyBuild(build.id, { weightKg: v === "" ? undefined : Number(v) }); }}
              />
            </Field>
            <Field label="前轴重量分配（%）" hint="如 55 表示 55/45">
              <input type="number" className="field" placeholder="如 55" min={40} max={70}
                value={build.weightDistribution ?? ""}
                onChange={(e) => { const v = e.target.value; onApplyBuild(build.id, { weightDistribution: v === "" ? undefined : Number(v) }); }}
              />
            </Field>
          </div>
        )}
        <div className="grid gap-4 lg:grid-cols-2">
          {summary.tuneStatuses.filter(({ missingCapabilities }) => missingCapabilities.length === 0).map(({ step }) => (
            <article key={step.id} className="rounded-lg border border-line bg-paper p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h4 className="font-bold">{step.title}</h4>
                <span className="tag">可执行</span>
              </div>
              <p className="mt-2 text-sm leading-6 text-asphalt/70">{step.purpose}</p>
              <InfoBlock title="基线动作" text={step.baselineAction} />
              {step.safeRange && <InfoBlock title="安全幅度" text={step.safeRange} />}
              {(step.tuningArea === "springs" || step.tuningArea === "spring_rate") && build && (
                <div className="mt-3">
                  <p className="mb-2 text-sm font-semibold">弹簧刚度范围（kgf/mm）<span className="font-normal text-asphalt/60">— 从游戏调校界面读取滑块两端数值</span></p>
                  <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
                    <Field label="前最小">
                      <input type="number" className="field" placeholder="如 5.0" step="0.1"
                        value={build.frontSpringMinKgf ?? ""}
                        onChange={(e) => { const v = e.target.value; onApplyBuild(build.id, { frontSpringMinKgf: v === "" ? undefined : Number(v) }); }}
                      />
                    </Field>
                    <Field label="前最大">
                      <input type="number" className="field" placeholder="如 40.0" step="0.1"
                        value={build.frontSpringMaxKgf ?? ""}
                        onChange={(e) => { const v = e.target.value; onApplyBuild(build.id, { frontSpringMaxKgf: v === "" ? undefined : Number(v) }); }}
                      />
                    </Field>
                    <Field label="后最小">
                      <input type="number" className="field" placeholder="如 5.0" step="0.1"
                        value={build.rearSpringMinKgf ?? ""}
                        onChange={(e) => { const v = e.target.value; onApplyBuild(build.id, { rearSpringMinKgf: v === "" ? undefined : Number(v) }); }}
                      />
                    </Field>
                    <Field label="后最大">
                      <input type="number" className="field" placeholder="如 40.0" step="0.1"
                        value={build.rearSpringMaxKgf ?? ""}
                        onChange={(e) => { const v = e.target.value; onApplyBuild(build.id, { rearSpringMaxKgf: v === "" ? undefined : Number(v) }); }}
                      />
                    </Field>
                  </div>
                </div>
              )}
              {getBaselineTuneHints(step.tuningArea, build?.weightKg, build?.weightDistribution, build?.drivetrain, build?.frontSpringMinKgf, build?.frontSpringMaxKgf, build?.rearSpringMinKgf, build?.rearSpringMaxKgf, build?.eventType, build?.targetClass).map((hint, i) => (
                <p key={i} className={`mt-2 rounded-md border px-3 py-2 text-sm ${
                  hint.level === "warning" ? "border-red-300 bg-red-50 text-red-800" :
                  hint.level === "important" ? "border-amber-300 bg-amber-50 text-amber-800" :
                  "border-slate-200 bg-slate-50 text-slate-700"
                }`}>{hint.level === "warning" ? "⚠️" : hint.level === "important" ? "💡" : "ℹ️"} {hint.text}</p>
              ))}
              <ListBlock title="先别急着做" items={step.doNotOptimizeYet ?? []} />
              <ListBlock title="这些问题后续再细调" items={step.handoffSymptoms ?? []} mapItem={(item) => getSymptom(item)?.name ?? item} />
            </article>
          ))}
        </div>
        {summary.tuneStatuses.some(({ missingCapabilities }) => missingCapabilities.length > 0) && (
          <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-sm font-semibold text-slate-700">🔒 尚未解锁的调校项目</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {summary.tuneStatuses.filter(({ missingCapabilities }) => missingCapabilities.length > 0).map(({ step, missingCapabilities }) => (
                <span key={step.id} className="tag" title={`需要安装：${missingCapabilities.map(capabilityLabel).join("、")}`}>
                  {step.title}（需{missingCapabilities.map(capabilityLabel).join("、")}）
                </span>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="panel p-5">
        <h3 className="mb-4 text-lg font-bold">第一次基线测试</h3>
        <div className="grid gap-4 lg:grid-cols-2">
          {(rule.firstTestPlan ?? []).map((test) => (
            <article key={test.id} className="rounded-lg border border-line bg-paper p-4">
              <h4 className="font-bold">{test.title}</h4>
              <p className="mt-2 text-sm leading-6 text-asphalt/70">{test.method}</p>
              <ListBlock title="观察重点" items={test.observe} />
              <ListBlock title="有问题时进入问诊" items={(test.nextIfProblem ?? []).map((item) => item.label)} mapItem={(item) => item} />
            </article>
          ))}
          <ListBlock title="不要优先做" items={rule.avoidFirst ?? []} />
          <ListBlock title="PI 超标时优先回退" items={rule.ifOverPI ?? []} />
        </div>
      </section>
    </div>
  );
}

function DiagnosticPanel({
  build,
  session,
  onSessionChange,
  onOpenGoal,
}: {
  build?: BuildCardData;
  session: DiagnosticSessionState | null;
  onSessionChange: (session: DiagnosticSessionState | null) => void;
  onOpenGoal: () => void;
}) {
  const current = session ?? createDiagnosticSession();
  const symptom = getSymptom(current.symptomId);
  const question = symptom?.followUpQuestions?.find((item) => item.id === current.currentQuestionId);
  const dependencies = getRelevantDependencies(current.currentRecommendation, build);

  function chooseSymptom(id: string) {
    onSessionChange(startSymptomSession(id, current));
  }

  function giveFeedback(feedback: FeedbackType) {
    const { session: next } = applyFeedback(current, feedback);
    onSessionChange(next);
  }

  return (
    <div className="space-y-5">
      <div className="panel p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">调车问诊 / 症状诊断器</h2>
            <p className="mt-1 text-sm text-asphalt/65">结构化问诊会保留当前步骤、建议、反馈和下一步路径。</p>
          </div>
          <button className="secondary-button" onClick={() => onSessionChange(createDiagnosticSession())}>
            <RotateCcw size={16} />
            重新开始
          </button>
        </div>
      </div>

      {!current.symptomId && (
        <div className="panel p-5">
          <h3 className="mb-4 text-lg font-bold">你的车现在最大问题是什么？</h3>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {rules.symptomRules.map((rule) => (
              <button key={rule.id} className="rounded-md border border-line bg-white p-4 text-left transition hover:border-asphalt hover:bg-paper" onClick={() => chooseSymptom(rule.id)}>
                <span className="block font-semibold">{rule.name}</span>
                <span className="mt-1 block text-xs leading-5 text-asphalt/62">{rule.summary}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {question && (
        <div className="panel p-5">
          <p className="text-sm text-asphalt/60">{symptom?.name}</p>
          <h3 className="mt-1 text-lg font-bold">{question.label}</h3>
          <div className="mt-4 flex flex-wrap gap-2">
            {question.options?.map((option) => (
              <button
                key={option.value}
                className="secondary-button"
                onClick={() => onSessionChange(answerFollowUp(current, question.id, option.value))}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {current.currentRecommendation && (
        <RecommendationPanel
          step={current.currentRecommendation}
          symptom={symptom}
          build={build}
          dependencies={dependencies}
          onFeedback={giveFeedback}
          onOpenGoal={onOpenGoal}
        />
      )}

      {current.status === "finished" && (
        <div className="panel p-5">
          <h3 className="flex items-center gap-2 text-lg font-bold">
            <CheckCircle2 size={20} />
            这条问诊路径已结束
          </h3>
          <p className="mt-2 text-sm leading-6 text-asphalt/70">
            如果问题已经改善，保留当前有效调整并记录到车辆备注。若问题仍存在，回到症状入口选择最明显的新症状。
          </p>
        </div>
      )}

      {current.feedbackHistory.length > 0 && (
        <div className="panel p-5">
          <h3 className="mb-3 font-bold">反馈记录</h3>
          <div className="space-y-2">
            {current.feedbackHistory.map((entry) => (
              <div key={`${entry.stepId}-${entry.at}`} className="rounded-md border border-line bg-paper p-3 text-sm">
                <p className="font-semibold">{entry.action}</p>
                <p className="text-asphalt/65">
                  反馈：{feedbackLabel(entry.feedback)} · 下一步：{entry.nextStepId === "finish" ? "结束" : entry.nextStepId}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RecommendationPanel({
  step,
  symptom,
  build,
  dependencies,
  onFeedback,
  onOpenGoal,
}: {
  step: RecommendationStep;
  symptom?: ReturnType<typeof getSymptom>;
  build?: BuildCardData;
  dependencies: ReturnType<typeof getRelevantDependencies>;
  onFeedback: (feedback: FeedbackType) => void;
  onOpenGoal: () => void;
}) {
  const missingCapabilities = getMissingCapabilitiesForStep(step, build);
  const canExecute = missingCapabilities.length === 0;

  return (
    <div className="panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-asphalt/60">{symptom?.name ?? "建议"}</p>
          <h3 className="mt-1 text-2xl font-bold">{step.action}</h3>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <InfoBlock title="原因" text={step.reason} />
        <InfoBlock title="建议调整幅度" text={step.amount ?? "按游戏内最小可感知幅度小步测试"} />
        <InfoBlock title="测试方法" text={step.testMethod ?? "只改一个变量，在同一路段做前后对照。"} />
        <ListBlock title="可能副作用" items={step.sideEffects ?? []} mapItem={labelOf} />
      </div>

      {!canExecute && (
        <div className="mt-5 rounded-lg border border-signal/30 bg-signal/5 p-4">
          <h4 className="font-bold text-signal">当前卡片可能还不能执行这条调校</h4>
          <p className="mt-2 text-sm leading-6 text-asphalt/70">
            这条问诊建议需要先具备对应可调能力。建议回到改装目标向导补齐基础部件，再继续这条症状问诊。
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {missingCapabilities.map((capability) => <span className="tag" key={capability}>{capabilityLabel(capability)}</span>)}
          </div>
          <button className="secondary-button mt-4" onClick={onOpenGoal}>
            <ClipboardList size={16} />
            回到目标向导
          </button>
        </div>
      )}

      {step.relatedParts && (
        <div className="mt-4 flex flex-wrap gap-2">
          {step.relatedParts.map((part) => <span className="tag" key={part}>{labelOf(part)}</span>)}
        </div>
      )}

      {dependencies.length > 0 && (
        <div className="mt-5 rounded-lg border border-line bg-paper p-4">
          <h4 className="mb-2 font-bold">交叉影响</h4>
          <div className="space-y-3">
            {dependencies.map((dep) => (
              <div key={dep.id}>
                <p className="text-sm font-semibold">{dep.name}</p>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-asphalt/70">
                  {dep.guidance.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        <button className="primary-button" disabled={!canExecute} onClick={() => onFeedback("greatly_improved")}>明显改善</button>
        <button className="secondary-button" disabled={!canExecute} onClick={() => onFeedback("slightly_improved")}>稍微改善</button>
        <button className="secondary-button" disabled={!canExecute} onClick={() => onFeedback("no_change")}>没变化</button>
        <button className="secondary-button" disabled={!canExecute} onClick={() => onFeedback("worse")}>变差</button>
        {symptom?.id === "unknown_next_part" && (
          <button className="secondary-button" onClick={onOpenGoal}>
            <ClipboardList size={16} />
            打开目标向导
          </button>
        )}
      </div>
    </div>
  );
}

function PartsEncyclopedia() {
  const [selectedId, setSelectedId] = useState(rules.partRules[0]?.id);
  const selected = rules.partRules.find((part) => part.id === selectedId) ?? rules.partRules[0];
  const symptomNamesByToken = new Map(rules.symptomRules.map((symptom) => [symptom.id, symptom.name]));

  return (
    <div className="grid gap-5 xl:grid-cols-[280px_1fr]">
      <div className="panel p-4">
        <h2 className="mb-3 font-bold">部件百科</h2>
        <div className="space-y-3">
          {categoryOrder.map((cat) => {
            const parts = rules.partRules.filter((p) => p.category === cat);
            if (parts.length === 0) return null;
            return (
              <div key={cat}>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-asphalt/50">{categoryLabels[cat]}</p>
                <div className="space-y-1">
                  {parts.map((part) => (
                    <button
                      key={part.id}
                      className={`w-full rounded-md border px-3 py-1.5 text-left text-sm transition ${
                        selected.id === part.id ? "border-asphalt bg-asphalt text-white" : "border-line bg-white hover:bg-paper"
                      }`}
                      onClick={() => setSelectedId(part.id)}
                    >
                      {part.name}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <PartDetail part={selected} symptomNamesByToken={symptomNamesByToken} />
    </div>
  );
}

function PartDetail({
  part,
  symptomNamesByToken,
}: {
  part: PartRule;
  symptomNamesByToken: Map<string, string>;
}) {
  return (
    <div className="panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-asphalt/60">{categoryLabels[part.category] ?? part.category}</span>
            {part.exclusiveGroup && <span className="rounded bg-amber-50 px-2 py-0.5 text-xs text-amber-700">互斥选项</span>}
          </div>
          <h2 className="text-2xl font-bold">{part.name}</h2>
          <p className="mt-2 text-sm leading-6 text-asphalt/72">{part.summary}</p>
        </div>
      </div>
      {part.grantsCapabilities?.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="text-sm font-semibold text-asphalt/60">解锁调校：</span>
          {part.grantsCapabilities.map((cap) => (
            <span key={cap} className="tag">{labelOf(cap)}</span>
          ))}
        </div>
      )}
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <ListBlock title="影响什么" items={part.effects} />
        <ListBlock title="什么时候适合升级" items={part.goodFor ?? []} mapItem={(item) => symptomNamesByToken.get(item) ?? labelOf(item)} />
        <ListBlock title="什么时候不建议优先升级" items={part.notRecommendedWhen ?? []} mapItem={labelOf} />
        <ListBlock title="常见副作用" items={part.sideEffects} mapItem={labelOf} />
        <ListBlock title="能处理哪些常见症状" items={part.goodFor ?? []} mapItem={(item) => symptomNamesByToken.get(item) ?? labelOf(item)} />
        <ListBlock title="交叉影响部件" items={part.relatedParts ?? []} />
      </div>
    </div>
  );
}

function PartCategoryGroup({
  category,
  parts,
  installedParts,
  onChange,
}: {
  category: string;
  parts: PartRule[];
  installedParts: string[];
  onChange: (installedParts: string[]) => void;
}) {
  const [open, setOpen] = useState(true);
  const installedCount = parts.filter((p) => installedParts.includes(p.id)).length;

  function togglePart(part: PartRule, checked: boolean) {
    let next = checked
      ? [...installedParts, part.id]
      : installedParts.filter((id) => id !== part.id);
    // Handle exclusive groups: if this part belongs to an exclusive group,
    // uncheck other parts in the same group when checking this one
    if (checked && part.exclusiveGroup) {
      const siblings = parts.filter(
        (p) => p.exclusiveGroup === part.exclusiveGroup && p.id !== part.id,
      );
      next = next.filter((id) => !siblings.some((s) => s.id === id));
    }
    onChange(next);
  }

  return (
    <div className="mb-3">
      <button
        className="flex w-full items-center gap-2 rounded-t-md border border-b-0 border-line bg-slate-50 px-3 py-2 text-left text-sm font-semibold hover:bg-slate-100"
        onClick={() => setOpen(!open)}
      >
        <span className={`transition-transform ${open ? "rotate-90" : ""}`}>▶</span>
        {categoryLabels[category] ?? category}
        {installedCount > 0 && (
          <span className="ml-auto rounded-full bg-signal/20 px-2 py-0.5 text-xs font-medium text-signal">
            {installedCount}/{parts.length}
          </span>
        )}
      </button>
      {open && (
        <div className="grid gap-1.5 rounded-b-md border border-line bg-paper p-2 sm:grid-cols-2 lg:grid-cols-3">
          {parts.map((part) => {
            const checked = installedParts.includes(part.id);
            const exclusiveConflict =
              !checked &&
              part.exclusiveGroup &&
              parts.some(
                (p) =>
                  p.exclusiveGroup === part.exclusiveGroup &&
                  p.id !== part.id &&
                  installedParts.includes(p.id),
              );
            return (
              <label
                key={part.id}
                className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition ${
                  checked
                    ? "border-signal/40 bg-signal/5"
                    : exclusiveConflict
                      ? "border-line bg-paper opacity-50"
                      : "border-line bg-paper hover:border-asphalt/30"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => togglePart(part, e.target.checked)}
                />
                <span>{part.name}</span>
                {part.grantsCapabilities?.length > 0 && (
                  <span className="ml-auto text-[10px] text-asphalt/40" title="解锁调校">
                    🔧
                  </span>
                )}
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  hint,
  children,
  className = "",
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-sm font-semibold">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-asphalt/50">{hint}</span>}
    </label>
  );
}

function ObservationQuestions({
  build,
  scopeId,
  requests,
  onApplyBuild,
}: {
  build: BuildCardData;
  scopeId: string;
  requests: ObservationRequest[];
  onApplyBuild: (id: string, patch: Partial<BuildCardData>) => void;
}) {
  function saveObservation(key: string, value: string) {
    const scopedKey = `${scopeId}.${key}`;
    onApplyBuild(build.id, {
      observations: {
        ...(build.observations ?? {}),
        [scopedKey]: value,
      },
    });
  }

  const visibleRequests = requests.slice(0, 2);
  const hiddenCount = requests.length - visibleRequests.length;

  return (
    <div className="mt-3 rounded-lg border border-line bg-white p-4">
      <h4 className="mb-2 font-bold">去游戏里确认一下</h4>
      <div className="space-y-3">
        {visibleRequests.map((request) => (
          <div key={request.key}>
            <p className="mb-2 text-sm font-semibold">{request.prompt}</p>
            {request.choices ? (
              <div className="flex flex-wrap gap-2">
                {request.choices.map((choice) => (
                  <button
                    key={choice.value}
                    className="secondary-button"
                    onClick={() => saveObservation(request.key, choice.value)}
                  >
                    {choice.label}
                  </button>
                ))}
              </div>
            ) : (
              <input
                className="field"
                placeholder="例如 +12 PI / 超 4 PI / 不确定"
                onBlur={(event) => {
                  if (event.currentTarget.value.trim()) {
                    saveObservation(request.key, event.currentTarget.value.trim());
                  }
                }}
              />
            )}
          </div>
        ))}
        {hiddenCount > 0 && (
          <p className="text-xs leading-5 text-asphalt/55">
            保存后我再看是否还需要补充 {hiddenCount} 个信息。
          </p>
        )}
      </div>
    </div>
  );
}

function ListBlock({
  title,
  items,
  mapItem = labelOf,
}: {
  title: string;
  items: string[];
  mapItem?: (item: string) => string;
}) {
  return (
    <div className="rounded-lg border border-line bg-paper p-4">
      <h4 className="mb-2 font-bold">{title}</h4>
      {items.length > 0 ? (
        <ul className="list-disc space-y-1 pl-5 text-sm leading-6 text-asphalt/72">
          {items.map((item) => <li key={item}>{mapItem(item)}</li>)}
        </ul>
      ) : (
        <p className="text-sm text-asphalt/55">这一步暂时没有额外说明。</p>
      )}
    </div>
  );
}

function InfoBlock({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-lg border border-line bg-paper p-4">
      <h4 className="mb-2 font-bold">{title}</h4>
      <p className="text-sm leading-6 text-asphalt/72">{text}</p>
    </div>
  );
}

function NoRuleMessage() {
  return (
    <div className="panel p-5">
      <h3 className="font-bold">暂时没有精确匹配的规则</h3>
      <p className="mt-2 text-sm leading-6 text-asphalt/70">
        当前规则覆盖公路/街头/峠道、A/S1、RWD/AWD、抓地稳定向。其他赛事类型会回退到最接近的公路规则作为参考。后续可扩展 goalRules.json 来支持更多场景。
      </p>
    </div>
  );
}

function feedbackLabel(feedback: FeedbackType) {
  return {
    greatly_improved: "明显改善",
    slightly_improved: "稍微改善",
    no_change: "没变化",
    worse: "变差",
  }[feedback];
}

function capabilityLabel(capability: string) {
  const labels: Record<string, string> = {
    tunable_brakes: "可调刹车",
    tunable_suspension: "可调悬挂",
    tunable_antiroll_bars: "可调防倾杆",
    tunable_differential: "可调差速器",
    tunable_front_aero: "可调前空力",
    tunable_rear_aero: "可调后空力",
    adjustable_gearing: "可调齿比",
  };
  return labels[capability] ?? capability;
}

function inferTargetClass(initialClass: string, initialPI: number): string {
  if (initialClass === "R") return "R";
  if (initialClass === "S2") return "S2";
  if (initialClass === "S1" || initialPI >= 800) return "S1";
  if (initialPI >= 500) return "A";
  if (initialPI >= 400) return "B";
  if (initialPI >= 300) return "C";
  return "D";
}

function CarPickerModal({
  onSelect,
  onClose,
  onBlank,
}: {
  onSelect: (car: CarCatalogEntry) => void;
  onClose: () => void;
  onBlank?: () => void;
}) {
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState<string>("all");
  const [makeFilter, setMakeFilter] = useState<string>("all");

  const makes = useMemo(() => {
    const map = new Map<string, string>();
    carCatalog.forEach((c) => {
      if (!map.has(c.make)) map.set(c.make, c.makeCn ?? c.make);
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1], 'zh'));
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return carCatalog.filter((car) => {
      if (classFilter !== "all" && car.initialClass !== classFilter) return false;
      if (makeFilter !== "all" && car.make !== makeFilter) return false;
      if (q && !car.carName.toLowerCase().includes(q) && !car.make.toLowerCase().includes(q) && !(car.makeCn ?? '').includes(q)) return false;
      return true;
    });
  }, [search, classFilter, makeFilter]);

  const classOptions = ["all", "D", "C", "B", "A", "S1", "S2", "R"];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-asphalt/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-3xl rounded-lg bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line p-5">
          <h2 className="text-xl font-bold">选择原厂车型</h2>
          <button className="icon-button" onClick={onClose}>✕</button>
        </div>

        <div className="border-b border-line p-5">
          <div className="grid gap-3 md:grid-cols-3">
            <input
              className="field md:col-span-1"
              placeholder="搜索车型或品牌..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
            <select className="field" value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
              {classOptions.map((c) => <option key={c} value={c}>{c === "all" ? "所有等级" : `${c} 级`}</option>)}
            </select>
            <select className="field" value={makeFilter} onChange={(e) => setMakeFilter(e.target.value)}>
              <option value="all">所有品牌</option>
              {makes.map(([en, cn]) => <option key={en} value={en}>{cn}</option>)}
            </select>
          </div>
          <p className="mt-2 text-xs text-asphalt/60">共 {filtered.length} 台车</p>
        </div>

        <div className="max-h-[55vh] overflow-y-auto p-3">
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-asphalt/60">没有匹配的车型</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {filtered.map((car) => (
                <button
                  key={car.id}
                  className="rounded-md border border-line bg-paper p-3 text-left transition hover:border-asphalt hover:bg-white"
                  onClick={() => onSelect(car)}
                >
                  <span className="block font-semibold text-sm">{car.makeCn ? `${car.makeCn} ` : ''}{car.carName}</span>
                  <span className="mt-1 flex flex-wrap gap-1.5">
                    <span className="tag text-xs">{car.rawClass}</span>
                    <span className="tag text-xs">{car.carTypeCn ?? car.carType}</span>
                    <span className="tag text-xs">{car.country}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {onBlank && (
          <div className="border-t border-line p-4">
            <button className="secondary-button w-full" onClick={onBlank}>
              跳过选车，手动创建空白卡片
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
