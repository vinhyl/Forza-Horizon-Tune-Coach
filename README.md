# Forza Horizon Tune Coach

Forza Horizon Tune Coach 是一个面向《Forza Horizon 6 / 极限竞速：地平线6》新手和轻中度玩家的静态网页改装调校辅助工具。

它不是聊天机器人，也不是自动生成“最优调校”的 AI。第一版定位是：交互式改装问诊助手 / 调车教练。

## MVP 范围

- 聚焦公路 / 街头 / 山路（Touge）
- 聚焦 A 级 / S1
- 聚焦 RWD / AWD
- 聚焦抓地稳定向构建
- 无后端、无账号、无网络抓取
- 所有规则数据使用本地 JSON / TS 对象
- 用户车辆卡片和问诊状态保存到 localStorage
- 支持 JSON 导入 / 导出

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

当前规则结构为可扩展 starter version，后续仍需持续演进。现有数据用于演示产品和规则引擎，不代表 FH6 官方完整数据。

规则文件位于 `src/data/`：

- `sources.json`
- `goalRules.json`
- `partRules.json`
- `symptomRules.json`
- `feedbackRules.json`
- `dependencyRules.json`
- `sampleCars.json`
- `sampleBuilds.json`

TypeScript 类型位于 `src/types/rules.ts`，核心类型包括：

- `SourceRecord`
- `GoalRule`
- `PartRule`
- `SymptomRule`
- `FeedbackRule`
- `DependencyRule`
- `RecommendationStep`
- `DiagnosticSessionState`

这些类型保留了扩展字段入口，方便未来增加新字段、新症状、新赛事、新部件、更复杂 flow engine 和 dependency handling。

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

- 所有示例数据都标记为 `sample`
- `sampleCars` 只是 UI 和流程演示，不是完整车辆库
- 工具允许用户自己录入车辆和构建
- 工具不需要知道所有车，只需要帮助用户理解下一步该试什么
- 当前 JSON 是 starter version，后续仍需要继续完善和扩展规则结构与规则数据
