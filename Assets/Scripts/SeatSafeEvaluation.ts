// Pure domain logic & PainFree App sync helper for SeatSafe AR.

export type PainArea = "knee" | "back";
export type MorningCondition = "good" | "fair" | "poor";
export type RiskLevel = "SAFE" | "CAUTION" | "HIGH_RISK";

export interface SeatSafeState {
    chairHeightCm: number;
    painArea: PainArea;
    medsTaken: boolean;
    morningCondition: MorningCondition;
    morningScore: number;
    syncSource: string;
}

export interface SeatSafeResult {
    riskLevel: RiskLevel;
    riskScore: number; // 1..10
    safeThresholdCm: number;
    deficitCm: number;
    badgeText: string;
    heightText: string;
    contextText: string;
    tipText: string;
}

export function getScoreForCondition(cond: MorningCondition): number {
    if (cond === "good") return 90;
    if (cond === "fair") return 65;
    return 35;
}

export function evaluateSeatSafety(state: SeatSafeState): SeatSafeResult {
    // Base safe seat height: knee pain needs higher seat (45 cm) than lower back (43 cm).
    let safeThresholdCm = state.painArea === "knee" ? 45 : 43;
    if (state.morningScore < 50) {
        safeThresholdCm += 2;
    }

    const deficitCm = Math.max(0, safeThresholdCm - state.chairHeightCm);

    // Risk score calculation (1..10)
    let risk = 2;
    if (deficitCm >= 12) {
        risk += 5;
    } else if (deficitCm >= 5) {
        risk += 3;
    } else if (deficitCm > 0) {
        risk += 1;
    }

    if (!state.medsTaken) {
        risk += 2;
    }
    if (state.morningScore < 50) {
        risk += 2;
    } else if (state.morningScore < 75) {
        risk += 1;
    }

    risk = Math.max(1, Math.min(10, risk));

    let riskLevel: RiskLevel = "SAFE";
    if (risk >= 7 || deficitCm >= 12) {
        riskLevel = "HIGH_RISK";
    } else if (risk >= 4 || deficitCm >= 4) {
        riskLevel = "CAUTION";
    }

    const levelLabel =
        riskLevel === "HIGH_RISK" ? "HIGH RISK" : riskLevel === "CAUTION" ? "CAUTION" : "SAFE";
    const badgeText = `[${levelLabel} · ${risk}/10]`;

    const heightText =
        deficitCm > 0
            ? `Seat: ${state.chairHeightCm}cm (${deficitCm}cm below ${safeThresholdCm}cm safe)`
            : `Seat: ${state.chairHeightCm}cm (Meets ${safeThresholdCm}cm safe height)`;

    const areaLabel = state.painArea === "knee" ? "Knee Pain" : "Back Pain";
    const medsLabel = state.medsTaken ? "Meds: Taken" : "Meds: Not Taken";
    const condLabel =
        state.morningCondition === "good"
            ? "Good"
            : state.morningCondition === "fair"
              ? "Fair"
              : "Poor";
    const contextText = `${areaLabel} | ${medsLabel} | AM: ${state.morningScore}/100 (${condLabel})`;

    let tipText = "Safe posture. Lower yourself smoothly.";
    if (riskLevel === "HIGH_RISK") {
        tipText = state.medsTaken
            ? "Meds mask pain—joint load stays high! Use armrest/cane."
            : "Severe post-sit pain risk! Avoid or add a thick cushion.";
    } else if (riskLevel === "CAUTION") {
        tipText = state.medsTaken
            ? "Moderate joint strain. Hold support while sitting down."
            : "Unmedicated strain risk. Sit slowly with hand support.";
    }

    return {
        riskLevel,
        riskScore: risk,
        safeThresholdCm,
        deficitCm,
        badgeText,
        heightText,
        contextText,
        tipText
    };
}

export interface PainFreeSyncPayload {
    morningScore: number;
    morningCondition: MorningCondition;
    medsTaken: boolean;
    painArea: PainArea;
    source: string;
}

export async function fetchPainFreeAppCondition(
    internetModule: InternetModule | null,
    apiUrl: string
): Promise<PainFreeSyncPayload> {
    const fallback: PainFreeSyncPayload = {
        morningScore: 35,
        morningCondition: "poor",
        medsTaken: false,
        painArea: "knee",
        source: "PainFree Sample"
    };

    if (!internetModule || !apiUrl) {
        return fallback;
    }

    try {
        const req = new Request(apiUrl, { method: "GET" });
        const resp = await internetModule.fetch(req);
        if (resp && resp.status >= 200 && resp.status < 300) {
            const text = await resp.text();
            const data = JSON.parse(text);
            const score = typeof data.morningScore === "number" ? data.morningScore : 35;
            const cond: MorningCondition = score >= 75 ? "good" : score >= 50 ? "fair" : "poor";
            return {
                morningScore: score,
                morningCondition: cond,
                medsTaken: Boolean(data.medsTaken),
                painArea: data.painArea === "back" ? "back" : "knee",
                source: "PainFree Live"
            };
        }
    } catch (e) {
        // Fallback cleanly when PainFree local/cloud server is offline during preview
    }

    return fallback;
}
