# Forza Horizon Tune Coach - Handoff Context

本文档用于在新目录 / 新项目中继续开发 `Forza Horizon Tune Coach`。它整理了当前对话形成的产品边界、已实现内容、正在演进的架构方向，以及需要继续处理的事项。

## 1. 产品定位

项目名称：`Forza Horizon Tune Coach`

定位：

- 面向《Forza Horizon 6 / 极限竞速：地平线6》新手和轻中度玩家
- 不是聊天机器人
- 不是自动生成"最优调校"的 AI
- 不是完整 FH6 车辆 / 零件 / PI 数据库
- 是一个"交互式改装问诊助手 / 调车教练"

核心价值：

- 使用少量稳定、通用、可解释的规则
- 结合用户在游戏里能看到的实际数据
- 通过结构化问诊和反馈闭环
- 输出下一步最值得尝试的改装或调校动作

MVP 范围：

- 覆盖全部赛事类型（12 种）
- 覆盖全部等级 D - R
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

## 2. 当前已实现内容

项目结构：

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
├─ scripts
│  └─ collect-car-catalog.mjs
└─ src
   ├─ App.tsx
   ├─ index.css
   ├─ main.tsx
   ├─ data
   │  ├─ dependencyRules.json
   │  ├─ feedbackRules.json
   │  ├─ goalRules.json
   │  ├─ partRules.json
   │  ├─ symptomRules.json
   │  ├─ sources.json
   │  ├─ carCatalog.json
   │  └─ authoritativeRuleFacts.json
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
  - 车辆名称、当前 PI、目标等级、赛事类型、驱动形式、驾驶偏好
  - 已安装关键部件（按 6 大分类折叠展示，含互斥逻辑）
  - 自定义备注
  - localStorage 自动保存
  - 可删除 / 可编辑
  - JSON 导入 / 导出
- 改装目标向导
  - 从 618 台官方车辆列表搜索选择原厂车型开始
  - 赛事类型（12 种）、目标等级（D-R）、驱动形式、驾驶偏好（速度/均衡/操控）选择
  - 三段式输出：基础改装路线 + 基础调校路线 + 基线测试
  - 改装路线步骤按分类展示候选部件、预期收益/需要权衡
  - "其他升级建议"按部件逐条展示具体收益和权衡说明
  - 调校步骤按条件显示/隐藏（未安装对应部件则隐藏）
  - 最小必要追问：去游戏里确认一下
- 调车问诊 / 症状诊断器
  - 结构化症状入口
  - 动态追问
  - 当前步骤 / 当前建议 / 用户反馈 / 下一步状态推进
  - 反馈选项：明显改善、稍微改善、没变化、变差
- 建议输出区
  - 建议动作、原因、副作用、建议幅度、测试方法
  - 下一步按钮
- 部件百科
  - 按 6 大分类分组展示（轮胎与轮圈、平台与操控、传动系统、空气动力学、引擎、转换）
  - 38 个部件，含分类标签、互斥标记、解锁调校能力说明
  - 覆盖：轮胎配方、轮胎宽度、弹簧与阻尼、防倾杆、刹车、差速器、前空力、后空力、减重、变速箱、引擎升级、排气、进气、进气歧管、点火系统、燃油系统、凸轮轴、活塞与压缩、气门、排量、机油与冷却、飞轮、传动轴、离合器、引擎盖、侧裙、防滚架、驱动形式转换、引擎互换、进气形式等

已实现规则文件：

- `sources.json` — 数据来源记录
- `goalRules.json` — 78 条目标构建规则
- `partRules.json` — 38 个部件规则，按 6 大分类组织
- `symptomRules.json` — 21 条症状诊断规则
- `feedbackRules.json` — 反馈规则
- `dependencyRules.json` — 11 条跨部件交互规则
- `carCatalog.json` — 618 台官方车辆列表
- `authoritativeRuleFacts.json` — ForzaFire 规则事实

已实现核心类型：

- `SourceRecord`
- `GoalRule`
- `PartRule`（含 `category`、`priority`、`exclusiveGroup`、`grantsCapabilities`）
- `SymptomRule`
- `FeedbackRule`
- `DependencyRule`
- `RecommendationStep`
- `DiagnosticSessionState`
- `UpgradePlanStep`（含 `partDetails`）
- `BaselineTuneStep`
- `TestStep`
- `PartDetail`（`{ partId, benefit, cost? }`）
- `PartCategory` / `ExclusiveGroup`
- `BuildCapability` / `BuildCardData`

## 3. 已验证状态

已验证通过：

```bash
npm install
npm run build
npx tsc --noEmit
```

浏览器验证过：

- 首页渲染
- 问诊入口
- 选择症状 -> 动态追问 -> 输出建议
- 目标向导（赛事/等级/驱动/偏好选择 -> 改装路线 -> 调校路线 -> 基线测试）
- 部件百科（按分类分组展示）
- 部件选择互斥逻辑
- "其他升级建议"按部件展示收益/权衡
- 调校项目条件显示/隐藏
- 局域网访问按钮正常

## 4. 后续讨论形成的新产品方向

用户提出：

目标向导不能只是简单列表，需要真正帮助新手完成更高效清晰的构建方案。

经过讨论形成的新理解：

### 4.1 构建模块与问诊模块的职责

构建模块不是只负责"装什么部件"。

新的职责：

> 构建模块 = 从原厂配置出发，完成一套"基础改装 + 基础调校 + 首次测试"的完整引导。

问诊模块职责：

> 问诊模块 = 针对已经改装 / 已调过的车，在出现具体症状后做局部修正。

也就是说：

- 构建模块给"能开、能测、方向正确"的基线车
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

- 入弯推头、弯中推头、出弯给油推头、出弯甩尾
- 刹车时车尾不稳、高速发飘、直线太慢
- 起步打滑、频繁换挡、压路肩弹跳
- 调整后反馈与下一步

构建模块中的调校建议应该是"保守初始值 / 安全方向"，不是症状微调。

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
- 自动输出"最优配装"

因此更现实的路线是：

> 权威公开数据负责底座和边界，用户从游戏里反馈动态数据负责现场校准，规则系统负责最小必要追问和决策。

## 6. 最小必要追问机制

形成的设计原则：

- 每条规则声明自己需要哪些观测数据
- 系统先查已知权威事实
- 再查当前 Build Card
- 再查本轮已问过的动态反馈
- 只有缺失且会改变决策的问题才问用户
- 每次最多问 1 到 2 个问题

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

目标向导通过 `inferBuildCapabilities` 从 partRules 数据的 `grantsCapabilities` 字段读取已安装部件解锁的能力。问诊模块根据建议需要的 capability 判断当前能否执行。

## 8. 目标向导规则结构

`goalRules.json` 已升级为完整的三段式结构：

```ts
interface GoalRule {
  upgradePlan?: UpgradePlanStep[];
  baselineTunePlan?: BaselineTuneStep[];
  firstTestPlan?: TestStep[];
  escalationRules?: EscalationRule[];
}

interface UpgradePlanStep {
  id: string;
  phase: string;
  candidateParts: string[];
  purpose: string;
  reason: string;
  expectedBenefits: string[];
  expectedCosts?: string[];
  partDetails?: PartDetail[];          // 按部件展示具体收益/权衡
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

## 9. 当前重要设计结论

最终架构方向：

> 构建模块从原厂车出发，建立基础改装 + 基础调校 + 测试基线。

> 问诊模块针对已构建车辆的具体症状做局部修正。

> 权威公开数据负责已知事实和规则边界。

> 用户游戏内反馈只在必要时被动态追问，用于补足公开数据无法覆盖的现场信息。

> 系统不追求完整自动配装，而是做一个足够聪明、少问废话、能解释取舍的改装调校教练。

## 10. 2026-05-28 本轮接手进展

已完成：

- 在新目录中重新安装依赖：`npm install`
- 已确认 `npm run build` 通过，`tsc -b` 与 `vite build` 都正常
- 修复目标向导选择状态：切换当前改装卡片后，目标向导的赛事、等级、驱动和偏好会同步当前卡片
- 增强目标向导可操作性：基础改装路线里的"待试"部件现在可点击，一键写入当前改装卡片的 `installedParts`
- 改进最小必要追问：追问答案按步骤作用域保存，例如 `a-finish-speed.pi_after`，避免多个阶段共用 `pi_delta` / `is_available` 时互相误判
- 追问面板最多一次显示 2 个问题，保存答案后继续显示剩余问题

本轮修改文件：

- `src/lib/ruleEngine.ts`
- `src/App.tsx`
- `HANDOFF_CONTEXT.md`

## 11. 2026-05-28 UI 重新梳理

用户反馈：

- 前台 UI 不应该暴露规则引擎的内部判断文本，例如"只在需要时追问"
- 前期先以官方 / 权威公开数据和可解释规则为基础，`user_input`、`user_tested`、`sample`、来源可信度展示可以先放下
- 但产品逻辑仍要保留"需要用户从游戏里确认动态数据"的能力，因为官方公开数据不足以支撑精确单车配装和 PI 计算

本轮调整：

- 主导航移除"来源可信度"，不再把来源面板作为玩家前台功能
- 主流程移除 `sample`、可信度、来源类型等调试/元数据展示
- 目标向导追问区从"只在需要时追问"改为"去游戏里确认一下"
- 移除目标向导里的"已知规则事实"前台区块
- 将目标路线和部件百科里的英文 token 批量映射为中文玩家语言
- 首页文案改为"权威数据打底 + 游戏内反馈校准 + 一步一测"的产品表达

后续 UI 方向：

- 前台只展示"玩家下一步要做什么、为什么、怎么判断保留/回退"
- 数据覆盖、来源可信度、sample 标记、规则 confidence 放在开发/数据层

## 12. 2026-06-01 官方车辆表与 ForzaFire 规则事实整理

本轮新增：

- `scripts/collect-car-catalog.mjs`：从 `https://forza.net/fh6cars?pubDate=20260123` 解析官方 FH6 车辆表，输出 `src/data/carCatalog.json`，可通过 `npm run collect:cars` 重新采集
- `src/data/carCatalog.json`：618 台车，字段包括 `make`、`carName`、`carType`、`initialClass`、`initialPI`、`rawClass`、`country`、`collection`、`addOns`、`sourceIds`
- `src/data/authoritativeRuleFacts.json`：从 ForzaFire FH6 指南归纳出 20 条规则事实，覆盖悬挂、防倾杆、刹车、减重、定位、车高、轮胎胶料、胎宽、胎压、前后空力、空力平衡、驱动转换、变速箱、终传、差速器、发动机升级
- `src/data/sources.json`：新增官方车辆列表来源和 ForzaFire FH6 指南来源

来源边界：

- 官方车表适合做车辆基础目录和筛选条件
- ForzaFire 规则适合做"权威指南级规则事实"，但不是官方数据
- 单车具体零件可用性、装后 PI、性能条变化和手感仍然必须由用户在游戏里确认

## 13. 2026-06-02 规则数据全面重建与 FH6 指南对接

本轮对项目的规则引擎、数据层和 UI 做了全面重建，核心目标是将规则数据从样本状态升级为基于 FH6 官方文件和 ForzaFire 调校指南的正式规则体系。

### 13.1 数据源替换

- 用 `FH6_Clean_Dictionary_V2.csv` 和 `FH6 tuning guide.docx` 替换原有样本规则数据
- `goalRules.json` 从 6 条扩展到 78 条，覆盖全部 12 种赛事类型 x 全部等级 x 三种驾驶偏好
- `partRules.json` 从 22 个部件扩展到 38 个，覆盖指南中六大部分的所有可选升级部件
- `symptomRules.json` 从 12 条扩展到 21 条
- `dependencyRules.json` 从 7 条扩展到 11 条
- 删除了不再需要的 `sampleCars.json` 和 `sampleBuilds.json`

### 13.2 车型库接入

- `carCatalog.json`（618 台车）接入"我要改一台车"流程，用户从搜索选择原厂车型开始
- 汉化厂商、车名、车类型
- `carTypeWeightMap`：37 种游戏车型 -> heavy/medium/light 重量分类映射
- `expandCarType`：将 carType 展开为 [原始类型, weightClass]，支持 weightKg 覆盖

### 13.3 赛事类型扩展

- 从 3 种扩展到 12 种赛事类型，全部中英文名称整理
- `eventGroupMap` 机制：将细粒度赛事类型映射到规则 scope 中的分组标签（road/dirt/crosscountry/touge/street/drag/speed/prstunts/drift）

### 13.4 驾驶偏好重构

- 从 stable/balanced/rotation 重新提炼为 speed/balanced/handling（速度优先/均衡/操控优先）
- 驾驶偏好与规则匹配：作为 scoreScope 的软加分项（+1）

### 13.5 规则匹配引擎改进

- `scoreScope` 匹配逻辑重构：eventType/class/drivetrain 改为硬性前提条件（不匹配返回 0），carType/drivingPreference 为软加分（+1）
- 修复了 B 级+AWD+直线加速赛错误匹配泥地规则的问题

### 13.6 车重与重量分配

- `BuildCardData` 新增 `weightKg`（车重 kg）和 `weightDistribution`（前重分配 %）
- 调校板块顶部增加车重和前重分配输入框
- 统一使用公制单位 kg

### 13.7 调校公式全面重写

严格对照 FH6 调校指南重写所有公式计算逻辑：

- **弹簧刚度**：线性插值公式 `刚度 = (最大刚度 - 最小刚度) x 滑块位置% + 最小刚度`，用户输入前后弹簧各自的最小/最大刚度值
- **阻尼计算链**：前压缩 -> 前回弹 -> 后回弹/后压缩（基于弹簧差偏移）-> 拉力/越野修正
- **防倾杆**：基础值公式 + 前后平衡调整
- **CarClassLevel**：sport(D/C/B) / high_performance(A) / race(S1/S2/R)，不同等级使用不同公式参数
- `isRallyOrOffroad`：判断赛事类型是否为泥地/越野，影响阻尼/弹簧修正

### 13.8 调校项目条件显示/隐藏

- `inferBuildCapabilities`：从硬编码改为从 partRules 数据的 `grantsCapabilities` 字段读取
- `requiresCapabilities`：baselineTunePlan 步骤上的解锁条件字段
- UI 自动隐藏未解锁的调校步骤（如未装可调悬挂则隐藏四轮定位、弹簧、阻尼等）
- alignment 步骤补充到所有缺失的规则中

### 13.9 变速箱与齿比

- 变速箱规则全面扩充：运动/赛车区别、挡位数量选择（6-10 速）、PI 成本变化
- 全部 78 条规则补充了 gearing 步骤
- 齿比调校提示：不需要的挡位可通过设为与相邻挡位相同来"隐藏"

### 13.10 部件分类体系

- 新增 `PartCategory` 类型：tires / platform / engine / aero / drivetrain / conversion
- 新增 `ExclusiveGroup` 类型：tire_type / suspension_type
- `categoryLabels` 和 `categoryOrder` 配置在 `ruleData.ts` 中
- `PartCategoryGroup` 组件：分类折叠展示 + 互斥逻辑（选择同组部件自动取消其他）
- 38 个部件各分配 `category`、`priority`（1-38 排序）、`exclusiveGroup`（互斥标记）、`grantsCapabilities`（解锁调校能力）
- 部件百科页面按分类分组展示

### 13.11 新增引擎/空力/转换部件

新增 16 个部件，覆盖指南六大分类：

- **引擎**（10）：exhaust、intake、intake_manifold、ignition、fuel_system、camshaft、pistons、valves、displacement、oil_cooling
- **空力**（2）：hood、side_skirts
- **转换**（3）：drivetrain_conversion、engine_swap、aspiration
- `labelOf` 映射补齐所有新部件中文标签

### 13.12 "其他升级建议"按部件展示

- 新增 `PartDetail` 接口：`{ partId: string; benefit: string; cost?: string }`
- `UpgradePlanStep` 新增 `partDetails?: PartDetail[]` 字段
- 全部 78 条规则在 upgradePlan 末尾添加"其他升级建议"步骤，含每部件的具体 benefit/cost 说明
- UI 渲染：逐部件卡片展示（部件名 - 收益说明 - 权衡说明），已安装部件高亮，替代原有的三列通用列表
- 样式区分：虚线边框、浅灰背景

### 13.13 提示样式分级

- 引入 `Hint` 类型系统：`{ text: string; level: "info" | "important" | "warning" }`
- 不再简单针对某一类规则高亮，而是根据重要性分级

### 13.14 局域网兼容

- `safeUUID()`：兼容非 HTTPS 局域网环境的 UUID 生成，替代 `crypto.randomUUID()`
- 修复局域网访问时按钮点击无反应的问题

### 13.15 本轮修改文件清单

- `src/types/rules.ts` — 新增 PartCategory、ExclusiveGroup、PartDetail 类型，UpgradePlanStep 新增 partDetails 字段
- `src/data/partRules.json` — 从 22 扩展到 38 个部件，新增 category/priority/exclusiveGroup/grantsCapabilities 字段
- `src/data/goalRules.json` — 78 条规则全部补充 gearing/alignment/其他升级建议步骤，含 partDetails 数据
- `src/lib/ruleEngine.ts` — inferBuildCapabilities 改为从 partRules 读取，调校公式全面重写
- `src/lib/ruleData.ts` — 新增 categoryLabels、categoryOrder、carTypeWeightMap、expandCarType、新部件 labelOf 映射
- `src/App.tsx` — 新增 PartCategoryGroup 组件、部件分类折叠展示、其他升级建议按部件展示、调校项目条件显示/隐藏、弹簧输入框、车重输入框
- `src/data/symptomRules.json` — 扩展到 21 条
- `src/data/dependencyRules.json` — 扩展到 11 条

### 13.16 已验证状态

- TypeScript 编译通过：`npx tsc --noEmit`
- 浏览器验证：页面正常加载，目标向导"其他升级建议"区域按部件展示收益/权衡，已安装部件高亮
- 部件百科按分类分组展示
- 部件选择互斥逻辑正常工作

### 13.17 后续建议

1. 进一步细化 goalRules 中各部件在不同赛事/等级/驱动组合下的差异化建议
2. 引擎互换、进气形式、驱动形式转换等转换类部件目前数据较粗，需补充更多指南细节
3. 考虑增加"PI 预算"概念，帮助用户在 PI 限制下自动推荐优先级排序
4. 泥地/越野赛事的部件建议目前相对公路赛事较少，可进一步丰富