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

export function safeUUID(): string {
  try {
    return crypto.randomUUID();
  } catch {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
}

export function createEmptyBuild(): BuildCardData {
  const now = new Date().toISOString();
  return {
    id: safeUUID(),
    carName: "",
    currentPI: "",
    targetClass: "A",
    eventType: "road_racing",
    drivetrain: "RWD",
    drivingPreference: "balanced",
    installedParts: [],
    observations: {},
    notes: "",
    createdAt: now,
    updatedAt: now,
  };
}

export function inferBuildCapabilities(build?: BuildCardData): BuildCapability[] {
  if (!build) return [];
  const partCapMap = new Map<string, BuildCapability[]>();
  for (const pr of rules.partRules) {
    if (pr.grantsCapabilities?.length) partCapMap.set(pr.id, pr.grantsCapabilities);
  }
  return Array.from(
    new Set(build.installedParts.flatMap((part) => partCapMap.get(part) ?? [])),
  );
}

export type HintLevel = "info" | "important" | "warning";

export interface Hint {
  text: string;
  level: HintLevel;
}

export function inferWeightClass(build?: BuildCardData): string | undefined {
  if (build?.weightKg) {
    if (build.weightKg >= 1600) return "heavy";
    if (build.weightKg >= 1200) return "medium";
    return "light";
  }
  if (build?.carType) return carTypeWeightMap[build.carType];
  return undefined;
}

export function getCarTypeHints(carType: string | undefined, partIds: string[], weightKg?: number, weightDistribution?: number, drivetrain?: string): Hint[] {
  const weightClass = weightKg
    ? (weightKg >= 1600 ? "heavy" : weightKg >= 1200 ? "medium" : "light")
    : (carType ? carTypeWeightMap[carType] : undefined);
  const hints: Hint[] = [];
  const hasWeightReduction = partIds.some((p) => p === "weight_reduction");
  const hasChassisReinforcement = partIds.some((p) => p === "chassis_reinforcement");
  const hasSuspension = partIds.some((p) => p === "suspension" || p === "antiroll_bars");
  const hasBrakes = partIds.some((p) => p === "brakes");
  const hasEngine = partIds.some((p) => p === "engine_upgrades");
  if (hasWeightReduction) {
    if (weightKg) {
      if (weightKg >= 1600) {
        hints.push({ text: `此车重 ${weightKg} kg，属于重车，减重几乎总是值得的。运动减重是必选项；PI预算允许时赛车减重也值得考虑。`, level: "important" });
      } else if (weightKg >= 1200) {
        hints.push({ text: `此车重 ${weightKg} kg，属于中等重量，运动减重通常是甜点；PI预算允许时赛车减重也值得考虑。`, level: "info" });
      } else if (weightKg >= 800) {
        hints.push({ text: `此车重 ${weightKg} kg，属于轻车，减重需谨慎。建议只做运动减重；赛车减重可能导致车辆过于灵敏。`, level: "warning" });
      } else {
        hints.push({ text: `此车仅 ${weightKg} kg，减重收益递减明显。升级前后务必检查功重比变化，PI成本可能超过实际收益。`, level: "warning" });
      }
    } else if (weightClass === "heavy") {
      hints.push({ text: "此车型属于重车，减重几乎总是值得的。运动减重是必选项；PI预算允许时赛车减重也值得考虑。", level: "important" });
    } else if (weightClass === "medium") {
      hints.push({ text: "此车型属于中等重量，运动减重通常是甜点；PI预算允许时赛车减重也值得考虑。", level: "info" });
    } else if (weightClass === "light") {
      hints.push({ text: "此车型属于轻车，减重需谨慎。建议只做运动减重；赛车减重可能导致车辆过于灵敏。", level: "warning" });
    }
  }
  if (hasChassisReinforcement) {
    if (weightKg) {
      if (weightKg < 1000) {
        hints.push({ text: `此车仅 ${weightKg} kg，赛车强化增加的 10-30 kg 可能比刚性收益更伤功重比，建议只做运动强化。`, level: "warning" });
      } else if (weightKg < 1200) {
        hints.push({ text: `此车 ${weightKg} kg，赛车强化需谨慎。低于 1,200 kg 的车辆通常更适合运动强化。`, level: "info" });
      } else {
        hints.push({ text: `此车 ${weightKg} kg，底盘加固价值较高，能显著改善操控一致性。`, level: "info" });
      }
    } else if (weightClass === "heavy") {
      hints.push({ text: "重车底盘加固价值很高，能显著改善操控一致性。", level: "info" });
    } else if (weightClass === "light") {
      hints.push({ text: "轻车底盘加固需谨慎，增加的重量可能抵消刚性收益。", level: "warning" });
    }
  }
  if (hasSuspension && weightKg) {
    if (weightDistribution) {
      const deviation = weightDistribution - 50;
      if (Math.abs(deviation) > 5) {
        const direction = deviation > 0 ? "前重" : "后重";
        const correctionKgf = Math.round(Math.abs(deviation) * 4);
        hints.push({ text: `前后重量分配 ${weightDistribution}/${100 - weightDistribution}，偏${direction} ${Math.abs(deviation)}%。建议弹簧修正：前弹簧 ${deviation > 0 ? "+" : "-"}${correctionKgf} kgf/mm，后弹簧 ${deviation > 0 ? "-" : "+"}${correctionKgf} kgf/mm。`, level: "important" });
      }
    }
    if (weightKg >= 1600) {
      hints.push({ text: "重车弹簧刚度整体偏高，注意前弹簧不要过硬导致轮胎过载丧失抓地力。", level: "info" });
    } else if (weightKg < 1000) {
      hints.push({ text: "轻车弹簧刚度整体偏低，调校时小幅度变化就会产生明显效果，建议微调。", level: "info" });
    }
  }
  if (hasBrakes && weightDistribution) {
    if (drivetrain === "FWD" && weightDistribution > 55) {
      hints.push({ text: `前驱车前轴 ${weightDistribution}% 重量分配，前轮承受更多重量和抓地力，刹车可偏前至 55-62%。`, level: "info" });
    } else if (drivetrain === "RWD" && weightDistribution < 48) {
      hints.push({ text: `后驱车后轴 ${100 - weightDistribution}% 重量分配较重，刹车偏前 50-55% 配合重心前移。`, level: "info" });
    }
  }
  if (hasEngine && weightKg) {
    if (weightKg < 800) {
      hints.push({ text: "轻车引擎升级需关注功重比变化，赛车排量等高PI升级可能不划算。升级前后检查功重比。", level: "warning" });
    } else if (weightKg >= 1600) {
      hints.push({ text: "重车引擎升级收益通常较高，功重比提升明显。优先选择单位PI动力回报高的升级。", level: "info" });
    }
  }
  return hints;
}

type CarClassLevel = "sport" | "high_performance" | "race";

function inferCarClassLevel(targetClass: string): CarClassLevel {
  if (targetClass === "D" || targetClass === "C" || targetClass === "B") return "sport";
  if (targetClass === "A") return "high_performance";
  return "race";
}

function isRallyOrOffroad(eventType: string): "rally" | "offroad" | false {
  if (eventType === "dirt_racing" || eventType === "trailblazers") return "rally";
  if (eventType === "cross_country") return "offroad";
  return false;
}

const springPctByClass: Record<CarClassLevel, { front: [number, number]; rear: [number, number] }> = {
  sport: { front: [87, 98], rear: [58, 80] },
  high_performance: { front: [85, 93], rear: [63, 84] },
  race: { front: [83, 93], rear: [59, 85] },
};

export function getBaselineTuneHints(
  tuningArea: string,
  weightKg?: number,
  weightDistribution?: number,
  drivetrain?: string,
  frontSpringMinKgf?: number,
  frontSpringMaxKgf?: number,
  rearSpringMinKgf?: number,
  rearSpringMaxKgf?: number,
  eventType?: string,
  targetClass?: string,
): Hint[] {
  if (!weightKg) return [];
  const hints: Hint[] = [];
  const classLevel = inferCarClassLevel(targetClass ?? "A");
  const terrain = isRallyOrOffroad(eventType ?? "");
  const isFwd = drivetrain === "FWD";
  const frontWdPct = weightDistribution ?? 52;
  const frontAxleKg = weightKg * (frontWdPct / 100);
  const rearAxleKg = weightKg - frontAxleKg;
  const weightLb = weightKg * 2.205;
  const frontAxleLb = frontAxleKg * 2.205;

  const hasFrontSpringRange = frontSpringMinKgf != null && frontSpringMaxKgf != null && frontSpringMaxKgf > frontSpringMinKgf;
  const hasRearSpringRange = rearSpringMinKgf != null && rearSpringMaxKgf != null && rearSpringMaxKgf > rearSpringMinKgf;
  const hasSpringRange = hasFrontSpringRange || hasRearSpringRange;

  if (tuningArea === "springs" || tuningArea === "spring_rate") {
    if (terrain === "offroad") {
      hints.push({
        text: "越野弹簧：建议滑块前约 39-40%，后约 6-7% 作为起点。越野需要最大悬挂顺应性吸收地形冲击。",
        level: "important",
      });
      if (hasFrontSpringRange) {
        const frontKgf = Math.round(((frontSpringMaxKgf! - frontSpringMinKgf!) * 0.395 + frontSpringMinKgf!) * 10) / 10;
        hints.push({ text: `前弹簧线性插值：约 ${frontKgf} kgf/mm。`, level: "info" });
      }
      if (hasRearSpringRange) {
        const rearKgf = Math.round(((rearSpringMaxKgf! - rearSpringMinKgf!) * 0.065 + rearSpringMinKgf!) * 10) / 10;
        hints.push({ text: `后弹簧线性插值：约 ${rearKgf} kgf/mm。`, level: "info" });
      }
    } else if (terrain === "rally") {
      const pctRange = springPctByClass[classLevel];
      const frontMid = (pctRange.front[0] + pctRange.front[1]) / 2;
      const rearMid = (pctRange.rear[0] + pctRange.rear[1]) / 2;
      const rallyFrontPct = Math.round(frontMid / 2);
      const rallyRearPct = Math.round(rearMid / 2);
      hints.push({
        text: `拉力弹簧：将赛车弹簧数值大致减半。建议前约 ${rallyFrontPct}%，后约 ${rallyRearPct}%。更软弹簧吸收地形而非弹起车辆。`,
        level: "important",
      });
      if (hasFrontSpringRange) {
        const frontKgf = Math.round(((frontSpringMaxKgf! - frontSpringMinKgf!) * (rallyFrontPct / 100) + frontSpringMinKgf!) * 10) / 10;
        hints.push({ text: `前弹簧线性插值：约 ${frontKgf} kgf/mm。`, level: "info" });
      }
      if (hasRearSpringRange) {
        const rearKgf = Math.round(((rearSpringMaxKgf! - rearSpringMinKgf!) * (rallyRearPct / 100) + rearSpringMinKgf!) * 10) / 10;
        hints.push({ text: `后弹簧线性插值：约 ${rearKgf} kgf/mm。`, level: "info" });
      }
    } else {
      const pctRange = springPctByClass[classLevel];
      let frontPctRange = pctRange.front;
      let rearPctRange = pctRange.rear;
      if (isFwd) {
        const tmp = frontPctRange;
        frontPctRange = rearPctRange;
        rearPctRange = tmp;
      }
      const frontPct = Math.round((frontPctRange[0] + frontPctRange[1]) / 2);
      const rearPct = Math.round((rearPctRange[0] + rearPctRange[1]) / 2);
      const classLabel = classLevel === "sport" ? "运动级" : classLevel === "high_performance" ? "高性能级" : "赛车级";
      const driveLabel = isFwd ? "前驱" : drivetrain === "AWD" ? "全驱" : "后驱";
      hints.push({
        text: `${classLabel}${driveLabel}车辆弹簧起始目标：前 ${frontPctRange[0]}-${frontPctRange[1]}%（取中 ${frontPct}%），后 ${rearPctRange[0]}-${rearPctRange[1]}%（取中 ${rearPct}%）。`,
        level: "important",
      });
      if (hasFrontSpringRange) {
        const frontKgf = Math.round(((frontSpringMaxKgf! - frontSpringMinKgf!) * (frontPct / 100) + frontSpringMinKgf!) * 10) / 10;
        hints.push({
          text: `前弹簧线性插值：约 ${frontKgf} kgf/mm。公式：刚度 = (最大 - 最小) × 滑块% + 最小`,
          level: "info",
        });
      }
      if (hasRearSpringRange) {
        const rearKgf = Math.round(((rearSpringMaxKgf! - rearSpringMinKgf!) * (rearPct / 100) + rearSpringMinKgf!) * 10) / 10;
        hints.push({
          text: `后弹簧线性插值：约 ${rearKgf} kgf/mm。`,
          level: "info",
        });
      }
      if (!hasSpringRange) {
        hints.push({
          text: "输入前后弹簧最小/最大刚度（从游戏调校界面读取）后，可换算为具体 kgf/mm 数值。",
          level: "info",
        });
      }
      if (weightDistribution && Math.abs(weightDistribution - 50) > 2) {
        const deviation = weightDistribution - 50;
        const correctionKgf = Math.round(Math.abs(deviation) * 4);
        hints.push({
          text: `重量分配 ${weightDistribution}/${100 - weightDistribution}，每偏离 50/50 约 1% 移动约 4 kgf/mm。修正：前弹簧 ${deviation > 0 ? "+" : "-"}${correctionKgf} kgf/mm，后弹簧 ${deviation > 0 ? "-" : "+"}${correctionKgf} kgf/mm。`,
          level: "important",
        });
      }
      if (eventType === "drag_racing") {
        hints.push({
          text: "直线加速：悬挂较软，车身姿态前低后略高，有助于起步牵引。",
          level: "info",
        });
      }
    }
  }

  if (tuningArea === "damping" || tuningArea === "dampers") {
    const minBumpByClass: Record<CarClassLevel, number> = {
      sport: 4.6,
      high_performance: 4.7,
      race: 4.8,
    };
    const minBump = minBumpByClass[classLevel];
    const bumpFront = Math.round((minBump + (frontAxleLb / 200) * 0.1) * 10) / 10;
    const reboundFront = Math.round((bumpFront / 0.6) * 10) / 10;
    hints.push({
      text: `前压缩阻尼 = ${minBump} + (前轴重量 ${Math.round(frontAxleLb)} lb / 200) × 0.1 ≈ ${bumpFront}。前回弹阻尼 = ${bumpFront} / 0.6 ≈ ${reboundFront}。`,
      level: "important",
    });

    let springDiffPct = 0;
    if (hasFrontSpringRange && hasRearSpringRange) {
      const pctRange = springPctByClass[classLevel];
      let fPct = (pctRange.front[0] + pctRange.front[1]) / 2;
      let rPct = (pctRange.rear[0] + pctRange.rear[1]) / 2;
      if (isFwd) { const t = fPct; fPct = rPct; rPct = t; }
      const frontKgf = (frontSpringMaxKgf! - frontSpringMinKgf!) * (fPct / 100) + frontSpringMinKgf!;
      const rearKgf = (rearSpringMaxKgf! - rearSpringMinKgf!) * (rPct / 100) + rearSpringMinKgf!;
      if (weightDistribution) {
        const deviation = weightDistribution - 50;
        const correctedFront = frontKgf + deviation * 4;
        const correctedRear = rearKgf - deviation * 4;
        springDiffPct = Math.abs(correctedFront - correctedRear) / Math.max(correctedFront, correctedRear) * 100;
      } else {
        springDiffPct = Math.abs(frontKgf - rearKgf) / Math.max(frontKgf, rearKgf) * 100;
      }
    }

    let rearReboundOffset: number;
    let rearBumpOffset: number;
    if (springDiffPct <= 1.5) {
      rearReboundOffset = 0.2; rearBumpOffset = 0.1;
    } else if (springDiffPct <= 35) {
      rearReboundOffset = 0.3; rearBumpOffset = 0.2;
    } else if (springDiffPct <= 40) {
      rearReboundOffset = 0.6; rearBumpOffset = 0.4;
    } else {
      rearReboundOffset = 1.2; rearBumpOffset = 0.8;
    }

    const reboundRear = Math.round((reboundFront - rearReboundOffset) * 10) / 10;
    const bumpRear = Math.round((bumpFront - rearBumpOffset) * 10) / 10;
    const diffLabel = springDiffPct > 0 ? `（弹簧差约 ${Math.round(springDiffPct)}%）` : "（需输入弹簧范围计算弹簧差）";
    hints.push({
      text: `后阻尼偏移${diffLabel}：后回弹 ≈ ${reboundFront} - ${rearReboundOffset} = ${reboundRear}，后压缩 ≈ ${bumpFront} - ${rearBumpOffset} = ${bumpRear}。弹簧差越大，前后阻尼差越大。`,
      level: "important",
    });

    if (isFwd) {
      hints.push({
        text: "前驱车后弹簧通常更硬，后阻尼偏移方向相反：后回弹和后压缩应比前轴更高。",
        level: "info",
      });
    }

    if (terrain === "rally" || terrain === "offroad") {
      const adjReboundFront = Math.round((reboundFront + 1.0) * 10) / 10;
      const adjReboundRear = Math.round((reboundRear + 1.0) * 10) / 10;
      hints.push({
        text: `${terrain === "rally" ? "拉力" : "越野"}修正：全部回弹阻尼 +1.0，提升地形恢复能力。前回弹 ${reboundFront} → ${adjReboundFront}，后回弹 ${reboundRear} → ${adjReboundRear}。`,
        level: "important",
      });
    }
  }

  if (tuningArea === "antiroll_bars" || tuningArea === "arb") {
    const stiffnessPctByClass: Record<CarClassLevel, number> = {
      sport: 63,
      high_performance: 43,
      race: 48,
    };
    const stiffnessPct = stiffnessPctByClass[classLevel];
    const baseArb = Math.round(((weightLb / 2) / (200 - 200 * (stiffnessPct / 100))) * 10) / 10;
    const classLabel = classLevel === "sport" ? "运动级" : classLevel === "high_performance" ? "高性能级" : "赛车级";
    hints.push({
      text: `${classLabel}防倾杆基础值 = (${Math.round(weightLb)} lb / 2) / (200 - 200 × ${stiffnessPct}%) ≈ ${baseArb}。`,
      level: "important",
    });

    if (weightDistribution) {
      const deviation = weightDistribution - 50;
      let frontArb: number;
      let rearArb: number;
      if (drivetrain === "FWD") {
        const shift = Math.round(Math.abs(deviation) * 1 * 10) / 10;
        frontArb = Math.round((baseArb - shift) * 10) / 10;
        rearArb = Math.round((baseArb + shift) * 10) / 10;
        hints.push({
          text: `前驱车分配：前重 ${weightDistribution}%，前防倾杆 ${baseArb} - ${shift} ≈ ${frontArb}（偏软），后防倾杆 ${baseArb} + ${shift} ≈ ${rearArb}（偏硬，帮助旋转）。`,
          level: "important",
        });
      } else if (drivetrain === "AWD") {
        const shift = Math.round(Math.abs(deviation) * 0.66 * 10) / 10;
        frontArb = Math.round((baseArb + shift) * 10) / 10;
        rearArb = Math.round((baseArb - shift) * 10) / 10;
        hints.push({
          text: `全驱车分配：每 1% 偏移约 0.66 点。前防倾杆 ≈ ${frontArb}，后防倾杆 ≈ ${rearArb}。更软前端提供前轮抓地，更硬后端帮助旋转对抗转向不足。`,
          level: "important",
        });
      } else {
        const shift = Math.round(Math.abs(deviation) * 1 * 10) / 10;
        frontArb = Math.round((baseArb + shift) * 10) / 10;
        rearArb = Math.round((baseArb - shift) * 10) / 10;
        hints.push({
          text: `后驱车分配：每 1% 前重偏移约 1 点。前防倾杆 ≈ ${frontArb}，后防倾杆 ≈ ${rearArb}。`,
          level: "important",
        });
      }
    }
    hints.push({
      text: "防倾杆常见范围 25-45，不要盲目拉满。车辆转向不足时优先软化前防倾杆，转向过度时优先软化后防倾杆。",
      level: "info",
    });
  }

  if (tuningArea === "alignment") {
    if (terrain === "offroad") {
      hints.push({ text: "越野倾角：前后约 -0.5°，需要尽可能平整的接地面积。束角保持 0.0°。", level: "important" });
    } else if (terrain === "rally") {
      hints.push({ text: "泥地倾角：前轮 -0.8° 到 -1.2°，后轮 -0.5° 到 -0.8°。后轮可略微束入 +0.1° 到 +0.3° 提升稳定性。", level: "important" });
    } else if (eventType === "drift_zones") {
      hints.push({ text: "漂移倾角：前轮 -3.0° 到 -5.0°，后轮约 -1.0°。前轮大负倾角维持大转向角时抓地。", level: "important" });
    } else {
      hints.push({ text: "公路赛倾角：前轮 -1.0° 到 -2.0°，后轮 -0.5° 到 -1.0°。光头胎偏 -2.0°，运动胎偏 -1.0°。", level: "important" });
    }
    hints.push({ text: "束角默认前后 0.0°。入弯响应不够可尝试前束出 -0.1° 到 -0.2°；高速不稳可尝试后束入 +0.1° 到 +0.3°。非零束角会损失极速。", level: "info" });

    if (weightKg >= 1400) {
      hints.push({ text: `此车 ${weightKg} kg，主销后倾建议 5.5°-6.0°（重车偏低段）。超过 7° 可能破坏轮胎磨耗和可预测性。`, level: "info" });
    } else if (weightKg >= 1000) {
      hints.push({ text: `此车 ${weightKg} kg，主销后倾建议 5.5°-6.5°（中等重量）。`, level: "info" });
    } else {
      hints.push({ text: `此车 ${weightKg} kg，主销后倾建议 6.0°-7.0°（轻车偏高段，增强方向回正）。`, level: "info" });
    }
  }

  if (tuningArea === "brakes" || tuningArea === "brake_bias") {
    if (eventType === "drift_zones") {
      hints.push({ text: "漂移刹车偏后 45-50%，更多后轮制动力有助于引发滑移和车尾旋转。", level: "important" });
    } else if (terrain) {
      hints.push({ text: `${terrain === "rally" ? "泥地" : "越野"}刹车偏后约 48%，帮助车辆在跳跃落地时更稳定。`, level: "important" });
    } else if (drivetrain === "FWD") {
      hints.push({ text: "前驱车刹车偏前 55-62%，前轮承受更多重量和抓地力。", level: "important" });
    } else if (drivetrain === "RWD") {
      hints.push({ text: "后驱车刹车偏前 50-55%，轻微前偏配合刹车时重心前移。", level: "important" });
    } else if (drivetrain === "AWD") {
      hints.push({ text: "四驱车刹车偏前 52-56%，与后驱类似。", level: "important" });
    }
    if (weightDistribution && weightDistribution > 58 && eventType !== "drift_zones") {
      hints.push({ text: `前轴 ${weightDistribution}% 偏重，刹车可适当再偏前 2-3%。`, level: "info" });
    }
    hints.push({ text: "制动力压力：默认 100%。重车可 105-115%，轻车或无 ABS 可 85-95%。", level: "info" });
  }

  if (tuningArea === "ride_height") {
    if (terrain === "offroad") {
      hints.push({ text: "越野车身高度：前后最高。跳跃、坑洼和车辙中的离地间隙不可妥协。", level: "important" });
    } else if (terrain === "rally") {
      hints.push({ text: "泥地车身高度：滑块范围的 70-80%。需要足够高度越过路面杂物，同时保持合理重心。", level: "important" });
    } else if (eventType === "drag_racing") {
      hints.push({ text: "直线加速：前低后略高，形成轻微前倾姿态，有助于起步牵引。", level: "important" });
    } else if (eventType === "drift_zones") {
      hints.push({ text: "漂移车身高度：前后最低。", level: "important" });
    } else {
      hints.push({ text: "公路赛车身高度：前后最低。更低重心带来更好过弯表现。压到底盘或频繁蹭路肩时才需升高。", level: "important" });
    }
  }

  if (tuningArea === "tire_pressure") {
    if (terrain === "offroad") {
      hints.push({ text: "越野胎压约 28.0-30.0 PSI（1.93-2.07 BAR），需要最大接地面积。", level: "important" });
    } else if (terrain === "rally") {
      hints.push({ text: "拉力胎压约 29.0-30.0 PSI（2.00-2.07 BAR）。全驱车可前后对称。", level: "important" });
    } else if (eventType === "drift_zones") {
      hints.push({ text: "漂移胎压约 20.0-26.0 PSI（1.38-1.79 BAR），低胎压让滑移更可预测。", level: "important" });
    } else {
      hints.push({ text: "公路赛胎压基准：运动胎 31.5 PSI，半热熔 32.0 PSI，光头胎 32.5 PSI。每次调整 0.5 PSI。", level: "important" });
    }
    if (drivetrain === "FWD" && !terrain && eventType !== "drift_zones") {
      hints.push({ text: "前驱车前胎压比后胎压高 1.0-2.0 PSI，前轮负担重需更高胎压维持形状。", level: "info" });
    } else if (drivetrain === "RWD" && !terrain && eventType !== "drift_zones") {
      hints.push({ text: "后驱车前胎压略高于后胎压 0.5-1.0 PSI，入弯更锐利，后轮低胎压扩大接地帮助出弯。", level: "info" });
    }
    if (weightKg >= 1600) {
      hints.push({ text: `重车 ${weightKg} kg 需要更高胎压抵抗载荷变形，可比基准高 1-3 PSI。`, level: "info" });
    } else if (weightKg < 900) {
      hints.push({ text: `轻车 ${weightKg} kg 可比基准低 1-2 PSI，避免胎压过高导致接地面积不足。`, level: "info" });
    }
  }

  if (tuningArea === "aero") {
    if (terrain) {
      hints.push({ text: `${terrain === "rally" ? "泥地" : "越野"}赛速度通常不够高，下压力收益有限。使用最小空气动力学设定，平衡接近 0.50 即可。`, level: "important" });
    } else if (eventType === "drag_racing") {
      hints.push({ text: "直线加速：前后下压力最低，空气阻力是主要敌人。", level: "important" });
    } else if (eventType === "drift_zones") {
      hints.push({ text: "漂移：可装赛车前保险杠获少量前端下压力，跳过赛车尾翼（需车尾容易突破抓地）。平衡 0.45-0.50。", level: "important" });
    } else if (drivetrain === "AWD") {
      hints.push({ text: "全驱公路赛：最大前下压力对抗推头，最低后下压力（全驱已有后轮牵引，后下压力只增阻力）。平衡 0.40-0.45。", level: "important" });
    } else if (drivetrain === "RWD") {
      hints.push({ text: "后驱公路赛：中高前下压力（60-80%），中高后下压力（60-90%）保出弯稳定。平衡 0.50-0.55。", level: "important" });
    } else if (drivetrain === "FWD") {
      hints.push({ text: "前驱公路赛：高到最大前下压力，低到中等后下压力。平衡 0.45-0.55。", level: "important" });
    }
  }

  if (tuningArea === "differential") {
    if (eventType === "drift_zones") {
      hints.push({ text: "漂移差速器：加速锁定 90-100%（接近焊死），减速锁定 15-25%。", level: "important" });
    } else if (terrain === "offroad" && drivetrain === "AWD") {
      hints.push({ text: "越野全驱差速器：前加速 35-45%，前减速 5-15%，后加速 65-75%，后减速 20-25%，中央平衡 55-65% 后偏。", level: "important" });
    } else if (terrain === "rally" && drivetrain === "AWD") {
      hints.push({ text: "泥地全驱差速器：前加速 30-40%，前减速 0-15%，后加速 55-70%，后减速 20-25%，中央平衡 65-75% 后偏。", level: "important" });
    } else if (drivetrain === "AWD") {
      hints.push({ text: "公路全驱差速器：前加速 28%，前减速 0%，后加速 100%，后减速 45%，中央平衡 70-85% 后偏。高后偏对抗全驱转向不足。", level: "important" });
    } else if (drivetrain === "RWD") {
      hints.push({ text: "后驱差速器：加速锁定 40-65%，减速锁定 15-30%。", level: "important" });
    }
  }

  if (tuningArea === "gearing") {
    if (terrain === "offroad") {
      hints.push({ text: "越野齿比：6速通常足够。主减速比偏高（加速取向），确保低速牵引力。挡位间距均匀即可。", level: "important" });
    } else if (terrain === "rally") {
      hints.push({ text: "泥地齿比：6速通常足够。主减速比偏高（加速取向），泥地不需要很高极速。", level: "important" });
    } else if (eventType === "drag_racing") {
      hints.push({ text: "直线加速齿比：8-10速可能值得，更多挡位让引擎保持在动力区间。主减速比根据赛道长度调整——确保最高挡刚好在终点线前到达红线。", level: "important" });
      hints.push({ text: "直线加速主减速比调整方法：跑一次直线，如果到终点线前就到红线，说明主减速比太高（齿比太短），降低一点；如果到终点线还没到红线，说明主减速比太低（齿比太长），提高一点。", level: "info" });
    } else if (eventType === "drift_zones") {
      hints.push({ text: "漂移齿比：6速足够。主减速比偏高，让2挡和3挡覆盖主要漂移速度范围。确保2挡能在低速弯维持滑移，3挡能在高速弯维持滑移。", level: "important" });
    } else {
      hints.push({ text: "公路赛齿比：6-7速通常足够。主减速比根据赛道特征调整——多弯赛道偏高（加速取向），长直道赛道偏低（极速取向）。", level: "important" });
      hints.push({ text: "主减速比调整原则：提高主减速比 → 所有挡位变短，加速更强，极速降低；降低主减速比 → 所有挡位变长，加速变弱，极速提高。", level: "info" });
      hints.push({ text: "赛车变速箱挡位间距：让每个挡位在升挡后转速刚好落在引擎最佳动力区间下限。避免出现'空挡区'——某个速度范围没有合适挡位可用。", level: "info" });
    }
    if (weightKg >= 1600 && !terrain) {
      hints.push({ text: `重车 ${weightKg} kg，主减速比可适当偏高，重车需要更多加速力而非极速。`, level: "info" });
    } else if (weightKg < 1000 && !terrain) {
      hints.push({ text: `轻车 ${weightKg} kg，主减速比可适当偏低，轻车加速已足够，可换取更高极速。`, level: "info" });
    }
    hints.push({ text: "运动变速箱只解锁主减速比滑块，赛车变速箱解锁每个挡位的单独齿比。如果只需调整整体加速/极速平衡，运动变速箱通常够用且更省PI。", level: "info" });
    hints.push({ text: "赛车变速箱可选6-10速：更多挡位让引擎更稳定地保持在动力区间，但增加换挡次数和变速箱重量。不需要的挡位可以设为与相邻挡位相同来'隐藏'。", level: "info" });
    if (targetClass === "B" || targetClass === "A") {
      hints.push({ text: `${targetClass}级推荐运动变速箱——省下的PI可以花在轮胎或底盘升级上，比多2-8点PI的赛车变速箱更划算。`, level: "info" });
    } else if (targetClass === "S1" || targetClass === "S2") {
      hints.push({ text: `${targetClass}级推荐赛车变速箱——高级别车辆动力区间更窄，需要精确匹配每个挡位齿比。`, level: "info" });
    }
  }

  return hints;
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
    id: safeUUID(),
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
  carType?: string;
  weightKg?: number;
  drivingPreference?: string;
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

const eventGroupMap: Record<string, string[]> = {
  road_racing: ["road"],
  dirt_racing: ["dirt"],
  cross_country: ["cross_country"],
  touge: ["touge"],
  street_racing: ["street"],
  drag_racing: ["drag"],
  time_attack: ["road"],
  speed_traps: ["road"],
  speed_zones: ["road"],
  danger_signs: ["cross_country"],
  drift_zones: ["drift"],
  trailblazers: ["cross_country"],
};

function expandEventType(eventType: string): string[] {
  return eventGroupMap[eventType] ?? [eventType];
}

const carTypeWeightMap: Record<string, string> = {
  "Classic Muscle": "heavy",
  "Modern Muscle": "heavy",
  "Retro Muscle": "heavy",
  "Muscle Car": "heavy",
  "Fullsize Sedan": "heavy",
  "Luxury": "heavy",
  "Super Saloon": "medium",
  "Modern Super Saloons": "medium",
  "Retro Super Saloons": "medium",
  "SUV": "heavy",
  "Super SUV": "heavy",
  "Sports Utility Heroes": "heavy",
  "Utility Heroes": "heavy",
  "Pickups & 4x4's": "heavy",
  "Offroad": "heavy",
  "Extreme Offroad": "heavy",
  "Unlimited Offroad": "heavy",
  "Offroad Buggy": "heavy",
  "Buggies": "medium",
  "Unlimited Buggies": "medium",
  "UTV's": "heavy",
  "Truck": "heavy",
  "Racing Truck": "heavy",
  "Van": "heavy",
  "Minivan": "heavy",
  "Microvan": "heavy",
  "Rally": "medium",
  "Modern Rally": "medium",
  "Retro Rally": "medium",
  "Classic Rally": "medium",
  "Rally Monster": "heavy",
  "Rally Monsters": "heavy",
  "Rallycross": "medium",
  "Super GT": "medium",
  "GT Car": "medium",
  "GT Cars": "medium",
  "Touring Car": "medium",
  "Sports Car": "medium",
  "Modern Sports Cars": "medium",
  "Classic Sports Cars": "medium",
  "Retro Sports Cars": "medium",
  "Hot Hatch": "medium",
  "Retro Hot Hatch": "medium",
  "Super Hot Hatch": "medium",
  "Sport Compact": "medium",
  "Drift Car": "medium",
  "Drift Cars": "medium",
  "Formula Drift": "medium",
  "Supercar": "light",
  "Modern Supercars": "light",
  "Retro Supercars": "light",
  "Hypercars": "light",
  "Track Toy": "light",
  "Track Toys": "light",
  "Extreme Track Toys": "light",
  "Classic Racers": "light",
  "Retro Racers": "light",
  "Porsche": "medium",
  "Ferrari": "light",
  "Lamborghini": "light",
  "Vintage": "heavy",
  "Rare Classics": "heavy",
  "Cult Cars": "medium",
  "Rods and Customs": "heavy",
  "Eclectic Domestics": "medium",
};

function expandCarType(carType: string | undefined, weightKg?: number): string[] {
  const result: string[] = [];
  if (carType) result.push(carType);
  if (weightKg) {
    if (weightKg >= 1600) result.push("heavy");
    else if (weightKg >= 1200) result.push("medium");
    else result.push("light");
  } else if (carType) {
    const weightClass = carTypeWeightMap[carType];
    if (weightClass) result.push(weightClass);
  }
  return result;
}

function scoreScope(
  scope: Record<string, unknown> | undefined,
  input: { eventType: string; targetClass: string; drivetrain: string; carType?: string; weightKg?: number; drivingPreference?: string },
) {
  if (!scope) return 0;
  const expandedEvents = expandEventType(input.eventType);
  if (Array.isArray(scope.eventType) && !scope.eventType.some((e: string) => expandedEvents.includes(e))) return 0;
  if (Array.isArray(scope.class) && !scope.class.includes(input.targetClass)) return 0;
  if (Array.isArray(scope.drivetrain) && !scope.drivetrain.includes(input.drivetrain)) return 0;
  let score = 2;
  if (scope.carType && (input.carType || input.weightKg)) {
    const expandedCarTypes = expandCarType(input.carType, input.weightKg);
    if (matches(scope.carType, expandedCarTypes)) score += 1;
  }
  if (scope.drivingPreference && input.drivingPreference) {
    if (matches(scope.drivingPreference, input.drivingPreference)) score += 1;
  }
  return score;
}

function matches(values: unknown, value: string | string[]) {
  if (!Array.isArray(values)) return false;
  const vals = Array.isArray(value) ? value : [value];
  return values.some((v) => vals.includes(v));
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
