# Forza Horizon Tune Coach - Handoff Context

本文档用于在新目录 / 新项目中继续开发 `Forza Horizon Tune Coach`。它整理了当前对话形成的产品边界、已实现内容、正在演进的架构方向，以及需要继续处理的事项。

## 1. 产品定位

项目名称：`Forza Horizon Tune Coach`

定位：

- 面向《Forza Horizon 6 / 极限竞速：地平线6》新手和轻中度玩家
- 不是聊天机器人
- 不是自动生成“最优调校”的 AI
- 不是完整 FH6 车辆 / 零件 / PI 数据库
- 是一个“交互式改装问诊助手 / 调车教练”

核心价值：

- 使用少量稳定、通用、可解释的规则
- 结合用户在游戏里能看到的实际数据
- 通过结构化问诊和反馈闭环
- 输出下一步最值得尝试的改装或调校动作

MVP 范围：

- 公路 / 街头 / 山路（Touge）
- A 级 / S1
- RWD / AWD
- 抓地稳定向构建
- 无后端
- React + Vite + Tailwind CSS
- 本地 JSON / TS 对象
- localStorage 保存用户配置和问诊状态
- 支持 JSON 导入 / 导出
- 中文界面

明确不做：

- 不伪装成完整 FH6 数据库
- 不虚构完整车辆、PI、零件、宽体、胎宽、引擎 swap 数据
- 不自动精确计算完整 PI
- 不抓取全网游戏数据
- 不做账号系统或后端

## 2. 第一版已实现内容

旧目录中已创建了完整 React + Vite + Tailwind 项目。

主要结构：

```text
.
├─ index.html
├─ package.json
├─ postcss.config.js
├─ tailwind.config.ts
├─ tsconfig.json
├─ tsconfig.app.json
├─ tsconfig.node.json
├─ vite.config.ts
├─ README.md
├─ HANDOFF_CONTEXT.md
└─ src
   ├─ App.tsx
   ├─ index.css
   ├─ main.tsx
   ├─ data
   │  ├─ dependencyRules.json
   │  ├─ feedbackRules.json
   │  ├─ goalRules.json
   │  ├─ partRules.json
   │  ├─ sampleBuilds.json
   │  ├─ sampleCars.json
   │  ├─ sources.json
   │  └─ symptomRules.json
   ├─ lib
   │  ├─ ruleData.ts
   │  ├─ ruleEngine.ts
   │  └─ storage.ts
   └─ types
      └─ rules.ts
```

已实现页面 / 模块：

- 首页
  - 我要改一台车
  - 我的车不好开
  - 我想了解一个部件
- 当前改装卡片
  - 车辆名称
  - 当前 PI
  - 目标等级
  - 赛事类型
  - 驱动形式
  - 驾驶偏好
  - 已安装关键部件
  - 自定义备注
  - localStorage 自动保存
  - 可删除 / 可编辑
  - JSON 导入 / 导出
- 改装目标向导
  - 初版：根据赛事、等级、驱动、偏好匹配 goalRules
  - 后续已开始升级为“基础改装 + 基础调校 + 首次测试”的路线图
- 调车问诊 / 症状诊断器
  - 结构化症状入口
  - 动态追问
  - 当前步骤 / 当前建议 / 用户反馈 / 下一步状态推进
  - 反馈选项：明显改善、稍微改善、没变化、变差
- 建议输出区
  - 建议动作
  - 原因
  - 副作用
  - 建议幅度
  - 测试方法
  - 来源 / 可信度展示
  - 下一步按钮
- 部件百科
  - 轮胎胶料
  - 胎宽
  - 宽体套件
  - 刹车
  - 悬挂
  - 防倾杆
  - 变速箱
  - 差速器
  - 前空力
  - 后空力
  - 减重
  - 发动机动力升级
- 来源和可信度面板

已实现规则文件：

- `sources.json`
- `goalRules.json`
- `partRules.json`
- `symptomRules.json`
- `feedbackRules.json`
- `dependencyRules.json`
- `sampleCars.json`
- `sampleBuilds.json`

已实现核心类型：

- `SourceRecord`
- `GoalRule`
- `PartRule`
- `SymptomRule`
- `FeedbackRule`
- `DependencyRule`
- `RecommendationStep`
- `DiagnosticSessionState`

## 3. 已验证状态

第一次完整实现后曾通过：

```bash
npm install
npm run build
```

并启动过：

```bash
npm run dev -- --port 5173
```

浏览器验证过：

- 首页渲染
- 问诊入口
- 选择“出弯给油推头”
- 动态追问
- 输出建议
- 目标向导
- 部件百科

后来用户要求停止本地服务，已确认 `http://localhost:5173` 下线。

## 4. 后续讨论形成的新产品方向

用户提出：

目标向导不能只是简单列表，需要真正帮助新手完成更高效清晰的构建方案。

经过讨论形成的新理解：

### 4.1 构建模块与问诊模块的职责

构建模块不是只负责“装什么部件”。

新的职责：

> 构建模块 = 从原厂配置出发，完成一套“基础改装 + 基础调校 + 首次测试”的完整引导。

问诊模块职责：

> 问诊模块 = 针对已经改装 / 已调过的车，在出现具体症状后做局部修正。

也就是说：

- 构建模块给“能开、能测、方向正确”的基线车
- 问诊模块根据具体症状继续收敛

### 4.2 避免功能重叠的原则

构建模块负责：

- 从原厂车出发的改装路线
- 哪些升级优先装
- 哪些调校项必须设一个安全基线
- 哪些参数构建阶段先不要乱动
- 第一次基线测试怎么跑
- 如果 PI 超标，优先拆什么
- 如果出现明显症状，跳到哪个问诊入口

问诊模块负责：

- 入弯推头
- 弯中推头
- 出弯给油推头
- 出弯甩尾
- 刹车时车尾不稳
- 高速发飘
- 直线太慢
- 起步打滑
- 频繁换挡
- 压路肩弹跳
- 调整后反馈与下一步

构建模块中的调校建议应该是“保守初始值 / 安全方向”，不是症状微调。

例如构建模块可以说：

> 安装比赛差速器后，先给一个稳定基线；第一次测试只观察出弯是否推头、甩尾或打滑。

问诊模块才说：

> 降低前差速加速锁止 3%~5%。如果没变化，中央差速更偏后。

## 5. 关于公开权威数据与动态用户反馈

用户强调：

前期希望以官方或权威公开数据为基础，由 Codex 收集和归纳到项目里。`user_input`、`user_tested`、`sample` 这些可以先不重点处理，来源可信度也可以先放下。

但设计建议时必须考虑：

> 能收集到的数据是否足以让系统具备真正实用性。

当前判断：

只靠官方 / 权威公开数据，可以支撑：

- 车辆基础目录
- 初始等级 / PI / 车型等可公开字段
- 部件类别和调校项的通用作用
- 哪些升级解锁哪些调校能力
- 通用调校原则
- 新手稳定向构建路线

但不适合支撑：

- 完整单车配装数据库
- 每台车每个零件的精确 PI 增减
- 每台车可用宽体、胎宽、引擎 swap 的完整表
- 自动精确计算 PI
- 自动输出“最优配装”

因此更现实的路线是：

> 权威公开数据负责底座和边界，用户从游戏里反馈动态数据负责现场校准，规则系统负责最小必要追问和决策。

## 6. 最小必要追问机制

用户明确希望：

系统根据实际改装规则动态要求用户反馈数据，不要每做一次改动都让用户反馈一大堆东西。

形成的设计原则：

- 每条规则声明自己需要哪些观测数据
- 系统先查已知权威事实
- 再查当前 Build Card
- 再查本轮已问过的动态反馈
- 只有缺失且会改变决策的问题才问用户
- 每次最多问 1 到 2 个问题

示例：

如果公开数据已知“比赛差速器会解锁差速器调校”，系统不应再问：

> 是否解锁差速器调校？

而应该只问缺失信息：

> 这台车当前是否可以安装比赛差速器？

如果用户答“可以”，系统就能直接进入保留或基础调校流程。

建议的数据结构：

```ts
interface ObservationRequest {
  key: ObservationKey;
  prompt: string;
  requiredWhen?: string[];
  optionalWhen?: string[];
  skipWhen?: string[];
  choices?: { value: string; label: string }[];
}
```

## 7. Capability 概念

为让构建和问诊模块协作，引入 `BuildCapability`。

示例：

```ts
type BuildCapability =
  | "tunable_brakes"
  | "tunable_suspension"
  | "tunable_antiroll_bars"
  | "tunable_differential"
  | "tunable_front_aero"
  | "tunable_rear_aero"
  | "adjustable_gearing";
```

目标向导通过已安装部件推导 capability：

- `brakes` -> `tunable_brakes`
- `suspension` -> `tunable_suspension`
- `antiroll_bars` -> `tunable_antiroll_bars`
- `differential` -> `tunable_differential`
- `transmission` -> `adjustable_gearing`
- `aero_front` -> `tunable_front_aero`
- `aero_rear` -> `tunable_rear_aero`

问诊模块根据建议需要的 capability 判断当前能否执行。

例如：

```json
{
  "symptom": "exit_understeer",
  "recommendedStep": "降低前差速加速锁止",
  "requiresCapability": ["tunable_differential"],
  "fallbackIfMissing": {
    "action": "回到目标向导，优先评估差速器升级",
    "targetModule": "goal_wizard"
  }
}
```

## 8. 目标向导规则升级方向

`goalRules.json` 已开始从简单结构：

```json
"priorities": ["tire_compound", "tire_width", "brakes"]
```

升级为：

```ts
interface GoalRule {
  upgradePlan?: UpgradePlanStep[];
  baselineTunePlan?: BaselineTuneStep[];
  firstTestPlan?: TestStep[];
  escalationRules?: EscalationRule[];
}
```

新增类型思路：

```ts
interface UpgradePlanStep {
  id: string;
  phase: string;
  candidateParts: string[];
  purpose: string;
  reason: string;
  expectedBenefits: string[];
  expectedCosts?: string[];
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
}

interface BaselineTuneStep {
  id: string;
  tuningArea: string;
  title: string;
  purpose: string;
  requiresCapabilities?: BuildCapability[];
  knownFacts?: string[];
  baselineAction: string;
  safeRange?: string;
  doNotOptimizeYet?: string[];
  askWhenNeeded?: ObservationRequest[];
  handoffSymptoms?: string[];
  sourceIds: string[];
  confidence: ConfidenceLevel;
}

interface TestStep {
  id: string;
  title: string;
  method: string;
  observe: string[];
  nextIfProblem?: { symptomId: string; label: string }[];
}
```

## 9. 已开始但未完成的修改

在旧目录中，上一轮中断前已经开始修改这些文件：

- `src/types/rules.ts`
- `src/data/goalRules.json`
- `src/lib/ruleEngine.ts`
- `src/App.tsx`

已加入的内容：

- `BuildCapability`
- `ObservationKey`
- `ObservationRequest`
- `UpgradePlanStep`
- `BaselineTuneStep`
- `TestStep`
- `EscalationRule`
- `BuildCardData.observations`
- `RecommendationStep.requiresCapabilities`
- `RecommendationStep.fallbackIfMissing`
- `inferBuildCapabilities`
- `summarizeGoalPlan`
- `getMissingCapabilitiesForStep`
- 目标向导三段式 UI 的初稿
- 问诊建议缺少 capability 时提示回目标向导

但是注意：

`src/App.tsx` 在中断前经历过多次 JSX 标签修复，当前旧目录状态需要重新跑构建确认。如果在新目录继续，建议优先做：

```bash
npx tsc -b
npm run build
```

此前 `npx tsc -b` 曾通过，但 `vite build` 后来在本机出现过卡住，可能与中断时依赖安装 / Vite 进程状态有关。新目录建议重新安装依赖后再验证：

```bash
npm install
npm run build
```

如果出现 Vite 卡住：

- 先确认没有残留 `vite build` / `node` 进程
- 删除 `node_modules` 后重新安装
- 或新目录重新 `npm install`

## 10. 下一步建议

建议在新目录中按这个顺序继续：

1. 先恢复可构建状态
   - 跑 `npx tsc -b`
   - 修复可能的 JSX 标签问题
   - 跑 `npm run build`

2. 稳定目标向导新 UI
   - 基础改装路线
   - 基础调校路线
   - 第一次基线测试
   - 最小必要追问

3. 完善 goalRules 数据
   - A 级公路 / 街头 / Touge 稳定向
   - S1 公路稳定向
   - RWD 与 AWD 分支
   - 每个阶段只写权威公开数据可支撑的内容

4. 改进问诊与构建联动
   - 问诊建议需要 capability 时先检查
   - 缺能力时跳回目标向导
   - 目标向导完成能力后回到原症状

5. 后续再做权威数据收集
   - 官方 Forza 车辆列表
   - 官方 / 权威调校说明
   - 游戏内部件说明可公开归纳的部分
   - 不收集或不承诺无法验证的完整单车零件 PI 表

## 11. 当前重要设计结论

最终架构方向：

> 构建模块从原厂车出发，建立基础改装 + 基础调校 + 测试基线。

> 问诊模块针对已构建车辆的具体症状做局部修正。

> 权威公开数据负责已知事实和规则边界。

> 用户游戏内反馈只在必要时被动态追问，用于补足公开数据无法覆盖的现场信息。

> 系统不追求完整自动配装，而是做一个足够聪明、少问废话、能解释取舍的改装调校教练。

## 12. 2026-05-28 本轮接手进展

已完成：

- 在新目录中重新安装依赖：`npm install`
- 已确认 `npm run build` 通过，`tsc -b` 与 `vite build` 都正常
- 修复目标向导选择状态：切换当前改装卡片后，目标向导的赛事、等级、驱动和偏好会同步当前卡片
- 增强目标向导可操作性：基础改装路线里的“待试”部件现在可点击，一键写入当前改装卡片的 `installedParts`
- 改进最小必要追问：追问答案按步骤作用域保存，例如 `a-finish-speed.pi_after`，避免多个阶段共用 `pi_delta` / `is_available` 时互相误判
- 追问面板最多一次显示 2 个问题，保存答案后继续显示剩余问题
- 使用 Browser 插件验证 `http://localhost:5173/`：
  - 首页正常渲染
  - 目标向导正常打开
  - 点击“待试：减重”后变为“已装：减重”
  - 回答“没有超”后该追问消失，下一条追问保留

本轮修改文件：

- `src/lib/ruleEngine.ts`
- `src/App.tsx`
- `HANDOFF_CONTEXT.md`

建议下一步：

1. 把目标向导里的英文 token，如 `pi_budget`、`wheelspin`、`top_speed`，补充到 `labelOf` 映射或改成中文规则文本。
2. 给“基础调校路线”也接入必要追问显示，目前数据结构支持但 UI 只在基础改装路线里渲染。
3. 增加从“首次基线测试”的问题标签直接跳转到对应问诊症状的按钮。
4. 后续再补更细的 A / S1、RWD / AWD 分支规则。

## 13. 2026-05-28 UI 重新梳理

用户反馈：

- 前台 UI 不应该暴露规则引擎的内部判断文本，例如“只在需要时追问”
- 前期先以官方 / 权威公开数据和可解释规则为基础，`user_input`、`user_tested`、`sample`、来源可信度展示可以先放下
- 但产品逻辑仍要保留“需要用户从游戏里确认动态数据”的能力，因为官方公开数据不足以支撑精确单车配装和 PI 计算

本轮调整：

- 主导航移除“来源可信度”，不再把来源面板作为玩家前台功能
- 主流程移除 `sample`、可信度、来源类型等调试/元数据展示
- 目标向导追问区从“只在需要时追问”改为“去游戏里确认一下”
- 移除目标向导里的“已知规则事实”前台区块
- 将目标路线和部件百科里的英文 token 批量映射为中文玩家语言，例如：
  - `pi_budget` -> “占用 PI 空间”
  - `top_speed` -> “直线尾速”
  - `wheelspin` -> “更容易打滑”
  - `unlock_tuning` -> “解锁可调项目”
- 首页文案改为“权威数据打底 + 游戏内反馈校准 + 一步一测”的产品表达

已验证：

- `npm run build` 通过
- Browser 刷新 `http://localhost:5173/` 后确认：
  - 不再出现“只在需要时追问”
  - 不再出现 `sample`
  - 不再出现“可信度”
  - 不再出现“来源可信度”
  - 不再出现 `pi budget`
  - 出现“去游戏里确认一下”和“占用 PI 空间”等前台文案

后续 UI 方向：

- 前台只展示“玩家下一步要做什么、为什么、怎么判断保留/回退”
- 数据覆盖、来源可信度、sample 标记、规则 confidence 放在开发/数据层，等接入官方数据后再考虑是否以更自然的“数据边界说明”形式出现
- 下一步可继续把“目标向导”的卡片结构改成更强的流程体验：当前建议 -> 去游戏确认 -> 记录结果 -> 保留/回退/下一候选
