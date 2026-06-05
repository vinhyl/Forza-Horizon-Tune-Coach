# Forza Horizon Tune Coach

Forza Horizon Tune Coach 是一个面向《Forza Horizon 6 / 极限竞速：地平线6》新手和轻中度玩家的静态网页改装调校辅助工具。

它不是聊天机器人，也不是自动生成“最优调校”的 AI。第一版定位是：交互式改装问诊助手 / 调车教练。

## MVP 范围

- 覆盖全部赛事类型（公路、泥地、越野、峠道、街头、直线加速、计时赛、测速照相、测速区间、危险标志、漂移区域、拓荒者）
- 覆盖全部等级 D - R
- 覆盖 RWD / AWD
- 覆盖抓地、均衡、速度三向驾驶偏好
- 无后端、无账号、无网络抓取
- 所有规则数据使用本地 JSON / TS 对象
- 用户车辆卡片和问诊状态保存到 localStorage
- 支持 JSON 导入 / 导出
- 支持从官方车辆列表（618 台）搜索选择原厂车型

暂不做全量车辆数据库、完整零件数据库、完整 PI 计算、自动最优调校或外部数据抓取。

## 为什么不做完整车辆数据库

FH 系列车辆、零件、PI、宽体、胎宽、换发动机等数据量很大，而且会随着游戏和版本变化。第一版如果伪装成完整数据库，反而会让建议看起来“很精确”，但实际可信度不足。

因此本项目使用低数据依赖策略：依赖通用可解释规则、用户当前在游戏里看到的配置、结构化问诊，以及用户实测反馈。

## 为什么使用规则系统 + 用户反馈闭环

调车不是一次性答案，而是“改一个变量 -> 同一路段测试 -> 根据反馈继续收敛”的过程。项目通过 symptomRules 和 feedbackRules 实现状态推进：

- 当前问题
- 当前追问
- 当前建议
- 用户反馈
- 下一步推荐
- 替代路径 / 回退路径

每条建议都展示建议动作、原因、可能副作用、建议幅度、测试方法、来源类型和可信度。

## 规则结构说明

当前规则引擎包含五种规则类型，覆盖从原厂车构建到症状诊断的完整流程。规则文件位于 `src/data/`：

- `sources.json` — 数据来源记录
- `goalRules.json` — 78 条目标构建规则，每条包含 upgradePlan（改装路线）、baselineTunePlan（基础调校）和 firstTestPlan（首次测试）
- `partRules.json` — 38 个部件规则，按 6 大分类组织（轮胎与轮圈、平台与操控、传动系统、空气动力学、引擎、转换），含互斥逻辑和调校能力解锁
- `symptomRules.json` — 21 条症状诊断规则
- `feedbackRules.json` — 反馈规则
- `dependencyRules.json` — 11 条跨部件交互规则
- `carCatalog.json` — 618 台官方车辆列表（厂商、车名、车型、初始等级/PI 等）
- `authoritativeRuleFacts.json` — 从 ForzaFire FH6 指南归纳的规则事实

TypeScript 类型位于 `src/types/rules.ts`，核心类型包括：

- `SourceRecord`
- `GoalRule`
- `PartRule`（含 `category`、`priority`、`exclusiveGroup`、`grantsCapabilities` 等字段）
- `SymptomRule`
- `FeedbackRule`
- `DependencyRule`
- `UpgradePlanStep`（含 `partDetails` 逐部件收益/权衡说明）
- `BaselineTuneStep`
- `TestStep`
- `PartDetail`（`{ partId, benefit, cost? }`）
- `PartCategory` / `ExclusiveGroup`
- `BuildCapability` / `BuildCardData`
- `RecommendationStep`
- `DiagnosticSessionState`

规则引擎核心逻辑位于 `src/lib/`：

- `ruleEngine.ts` — 规则匹配、scoreScope 评分、inferBuildCapabilities、基线调校公式计算
- `ruleData.ts` — 中文标签映射、分类标签、赛事分组映射、车型重量映射
- `storage.ts` — localStorage 持久化 + 数据迁移

## 项目目录结构

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

## 运行

```bash
npm install
npm run dev
```

构建检查：

```bash
npm run build
```

## 数据原则

- 所有规则数据基于 FH6 官方车辆列表和 ForzaFire FH6 调校指南归纳整理
- `carCatalog.json` 为官方车辆列表，含 618 台车的基础信息
- 部件规则按 6 大分类组织，含互斥关系（如轮胎配方、悬挂类型）和调校能力解锁
- 目标向导输出"基础改装路线 + 基础调校路线 + 基线测试"，每条改装步骤含逐部件收益/权衡说明
- 调校公式（弹簧、阻尼、防倾杆）严格对照指南，用户需输入游戏中实际数值
- 用户可在游戏内填写车重、重量分配、弹簧刚度范围等动态数据
- 工具不需要知道所有车，只需要帮助用户理解下一步该试什么
