// Pure domain logic, per-user separate chair/step personalization, StepSafe & Motion Guards.

export type PainArea = "knee" | "back";
export type MorningCondition = "good" | "fair" | "poor";
export type RiskLevel = "SAFE" | "CAUTION" | "HIGH_RISK";
export type SitContext = "home" | "cafe" | "clinic";
export type PainSeverity = "none" | "mild" | "sharp";
export type SpatialMode = "chair" | "stairs";
export type MotionAlertType = "none" | "bend" | "stand" | "pace";

export interface PainLogEntry {
    id: number;
    timeLabel: string;
    spatialMode: SpatialMode;
    context: SitContext;
    measureCm: number;
    painArea: PainArea;
    medsTaken: boolean;
    severity: PainSeverity;
    offsetDeltaCm: number;
    syncState: "Local" | "Synced" | "MemOnly";
}

export interface MotionAlertState {
    type: MotionAlertType;
    badge: string;
    detail: string;
    severity: "red" | "amber" | "cyan";
}

export interface SeatSafeState {
    spatialMode: SpatialMode;
    chairHeightCm: number; // 30 / 38 / 46
    stepRiseCm: number; // 22 / 18 / 14
    painArea: PainArea;
    medsTaken: boolean;
    morningCondition: MorningCondition;
    morningScore: number;
    syncSource: string;
    sitContext: SitContext;
    chairOffsetCm: number; // Chair-only adaptive offset (-4..+8 cm)
    stepOffsetCm: number; // Stairs-only adaptive offset (-4..+8 cm)
    painLogs: PainLogEntry[];
}

export interface SeatSafeResult {
    riskLevel: RiskLevel;
    riskScore: number; // 1..10
    safeThresholdCm: number;
    deficitCm: number; // Chair: below safe height | Stairs: above safe step rise
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

export function getActivePersonalOffset(state: SeatSafeState): number {
    return state.spatialMode === "stairs" ? state.stepOffsetCm : state.chairOffsetCm;
}

export function applyPersonalFeedback(currentOffsetCm: number, severity: PainSeverity): {
    nextOffsetCm: number;
    deltaCm: number;
} {
    let rawDelta = 0;
    if (severity === "sharp") {
        rawDelta = 2;
    } else if (severity === "mild") {
        rawDelta = 1;
    } else {
        rawDelta = currentOffsetCm > -4 ? -1 : 0;
    }
    const nextOffsetCm = Math.max(-4, Math.min(8, currentOffsetCm + rawDelta));
    return {
        nextOffsetCm,
        deltaCm: nextOffsetCm - currentOffsetCm
    };
}

export function formatContextLabel(ctx: SitContext): string {
    if (ctx === "home") return "Home";
    if (ctx === "cafe") return "Cafe";
    return "Clinic";
}

export function formatSeverityLabel(sev: PainSeverity): string {
    if (sev === "none") return "No Pain";
    if (sev === "mild") return "Mild";
    return "Sharp";
}

export function parseStrictBoolean(value: unknown, fallback: boolean = false): boolean {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") {
        if (value === 1) return true;
        if (value === 0) return false;
        return fallback;
    }
    if (typeof value === "string") {
        const norm = value.trim().toLowerCase();
        if (norm === "true" || norm === "1" || norm === "yes") return true;
        if (norm === "false" || norm === "0" || norm === "no" || norm === "") return false;
    }
    return fallback;
}

export function clampScore(value: unknown, fallback: number = 35): number {
    if (typeof value === "number" && isFinite(value)) {
        return Math.max(0, Math.min(100, Math.round(value)));
    }
    if (typeof value === "string" && value.trim() !== "") {
        const parsed = Number(value);
        if (isFinite(parsed)) {
            return Math.max(0, Math.min(100, Math.round(parsed)));
        }
    }
    return fallback;
}

export function buildPainLogUrl(baseConditionUrl: string): string {
    const qIdx = baseConditionUrl.indexOf("?");
    const basePart = qIdx >= 0 ? baseConditionUrl.slice(0, qIdx) : baseConditionUrl;
    const queryPart = qIdx >= 0 ? baseConditionUrl.slice(qIdx) : "";
    const replaced = basePart.replace(/\/api\/condition\/?$/, "/api/pain-log");
    return `${replaced}${queryPart}`;
}

export function evaluateMotionGuard(params: {
    painArea: PainArea;
    medsTaken: boolean;
    morningScore: number;
    bendActive: boolean;
    pitchDeg: number;
    standCountdownSec: number;
    stillSeconds: number;
    overrideMode: MotionAlertType;
}): MotionAlertState {
    // 1. Live StandSafe ALWAYS takes top priority (never overridden by demo preview)
    if (params.standCountdownSec > 0.05) {
        const secs = params.standCountdownSec.toFixed(1);
        return {
            type: "stand",
            badge: `[STAND SAFE · PAUSE ${secs}s]`,
            detail: "Rising quickly — Hold support & pause before walking.",
            severity: "red"
        };
    }

    // 2. Manual preview override (when no live StandSafe emergency is active)
    if (params.overrideMode === "stand") {
        return {
            type: "stand",
            badge: "[STAND SAFE · PAUSE 3.0s]",
            detail: "Rising quickly — Pause 3s before walking to prevent dizziness.",
            severity: "red"
        };
    }
    if (params.overrideMode === "bend") {
        return {
            type: "bend",
            badge: "[BEND SAFE · POSTURE ALERT]",
            detail: "Deep forward bend detected — Bend knees, not your lower back.",
            severity: "amber"
        };
    }
    if (params.overrideMode === "pace") {
        return {
            type: "pace",
            badge: "[PACE SAFE · POSTURE REMINDER]",
            detail: params.medsTaken
                ? "Still for 30s+ — Shift weight & stretch gently."
                : "Still for 30s+ — Stretch gently & check if pain meds are due.",
            severity: "cyan"
        };
    }

    // 3. Live BendSafe (requires real downward lean, not level sitting)
    if (params.bendActive && (params.painArea === "back" || params.morningScore < 75)) {
        const deg = Math.round(Math.abs(params.pitchDeg));
        return {
            type: "bend",
            badge: `[BEND SAFE · ${deg}° LEAN]`,
            detail: "Protect spine & knees — Squat with knees instead of bending back.",
            severity: params.morningScore < 50 ? "red" : "amber"
        };
    }

    // 4. Live PaceSafe (prolonged stillness / stiffness & medication check)
    if (params.stillSeconds >= 30) {
        const sec = Math.floor(params.stillSeconds);
        return {
            type: "pace",
            badge: `[PACE SAFE · ${sec}s STILL]`,
            detail: params.medsTaken
                ? "Avoid joint stiffness — Take a brief gentle stretch."
                : "Joint stiffness risk — Stretch gently & check medication.",
            severity: "cyan"
        };
    }

    return {
        type: "none",
        badge: "",
        detail: "",
        severity: "cyan"
    };
}

export function evaluateSeatSafety(state: SeatSafeState): SeatSafeResult {
    const areaLabel = state.painArea === "knee" ? "Knee Pain" : "Back Pain";
    const medsLabel = state.medsTaken ? "Meds: Taken" : "Meds: Not Taken";
    const condLabel =
        state.morningCondition === "good"
            ? "Good"
            : state.morningCondition === "fair"
              ? "Fair"
              : "Poor";
    const contextText = `${areaLabel} | ${medsLabel} | AM: ${state.morningScore}/100 (${condLabel})`;

    if (state.spatialMode === "stairs") {
        const stepOffset = state.stepOffsetCm || 0;
        const offsetTag =
            stepOffset !== 0 ? ` (My ${stepOffset > 0 ? "+" : ""}${stepOffset}cm)` : "";

        // StepSafe: lower step rise is safer; positive personal offset tightens max step height
        let safeMaxStepCm = state.painArea === "knee" ? 15 : 17;
        if (state.morningScore < 50) {
            safeMaxStepCm -= 2;
        }
        const personalAdj = Math.round(stepOffset * 0.5);
        safeMaxStepCm = Math.max(12, Math.min(20, safeMaxStepCm - personalAdj));

        const excessCm = Math.max(0, state.stepRiseCm - safeMaxStepCm);
        let risk = 1;
        if (excessCm >= 6) {
            risk += 5;
        } else if (excessCm >= 2) {
            risk += 3;
        } else if (excessCm > 0) {
            risk += 2;
        }

        if (!state.medsTaken) {
            risk += excessCm >= 6 ? 2 : 1;
        }
        if (state.morningScore < 50) {
            risk += 2;
        } else if (state.morningScore < 75) {
            risk += 1;
        }
        risk = Math.max(1, Math.min(10, risk));

        // Any step exceeding safe threshold is at least CAUTION (never SAFE)
        let riskLevel: RiskLevel = "SAFE";
        if (risk >= 7 || excessCm >= 6) {
            riskLevel = "HIGH_RISK";
        } else if (risk >= 4 || excessCm > 0) {
            riskLevel = "CAUTION";
            risk = Math.max(4, risk);
        }

        const levelLabel =
            riskLevel === "HIGH_RISK" ? "HIGH RISK" : riskLevel === "CAUTION" ? "CAUTION" : "SAFE";
        const badgeText = `[STEP ${levelLabel} · ${risk}/10]`;

        const heightText =
            excessCm > 0
                ? `Step: ${state.stepRiseCm}cm (+${excessCm}cm over ${safeMaxStepCm}cm safe${offsetTag})`
                : `Step: ${state.stepRiseCm}cm (Within ${safeMaxStepCm}cm safe${offsetTag})`;

        let tipText = "Manageable step height. Keep steady pace.";
        if (riskLevel === "HIGH_RISK") {
            tipText = "Steep step risk! Hold handrail firmly or take elevator.";
        } else if (riskLevel === "CAUTION") {
            tipText = "Moderate step load. Hold handrail & step one at a time.";
        }

        return {
            riskLevel,
            riskScore: risk,
            safeThresholdCm: safeMaxStepCm,
            deficitCm: excessCm,
            badgeText,
            heightText,
            contextText,
            tipText
        };
    }

    // Chair mode (SeatSafe) uses chairOffsetCm independently from stairs
    const chairOffset = state.chairOffsetCm || 0;
    const offsetTag =
        chairOffset !== 0 ? ` (My ${chairOffset > 0 ? "+" : ""}${chairOffset}cm)` : "";

    let safeThresholdCm = state.painArea === "knee" ? 45 : 43;
    if (state.morningScore < 50) {
        safeThresholdCm += 2;
    }
    safeThresholdCm = Math.max(36, Math.min(54, safeThresholdCm + chairOffset));

    const deficitCm = Math.max(0, safeThresholdCm - state.chairHeightCm);

    let risk = 1;
    if (deficitCm >= 12) {
        risk += 5;
    } else if (deficitCm >= 5) {
        risk += 3;
    } else if (deficitCm > 0) {
        risk += 2;
    }

    if (!state.medsTaken) {
        risk += deficitCm >= 12 ? 2 : 1;
    }
    if (state.morningScore < 50) {
        risk += 2;
    } else if (state.morningScore < 75) {
        risk += 1;
    }

    risk = Math.max(1, Math.min(10, risk));

    // Any seat below safe threshold is at least CAUTION (never SAFE)
    let riskLevel: RiskLevel = "SAFE";
    if (risk >= 7 || deficitCm >= 12) {
        riskLevel = "HIGH_RISK";
    } else if (risk >= 4 || deficitCm > 0) {
        riskLevel = "CAUTION";
        risk = Math.max(4, risk);
    }

    const levelLabel =
        riskLevel === "HIGH_RISK" ? "HIGH RISK" : riskLevel === "CAUTION" ? "CAUTION" : "SAFE";
    const badgeText = `[${levelLabel} · ${risk}/10]`;

    const heightText =
        deficitCm > 0
            ? `Seat: ${state.chairHeightCm}cm (${deficitCm}cm below ${safeThresholdCm}cm safe${offsetTag})`
            : `Seat: ${state.chairHeightCm}cm (Meets ${safeThresholdCm}cm safe${offsetTag})`;

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

export function hasValidPainFreePayload(data: unknown): boolean {
    if (!data || typeof data !== "object") return false;
    const obj = data as Record<string, unknown>;
    const hasScore =
        (typeof obj.morningScore === "number" && isFinite(obj.morningScore)) ||
        (typeof obj.morningScore === "string" &&
            obj.morningScore.trim() !== "" &&
            isFinite(Number(obj.morningScore)));
    const hasMeds =
        typeof obj.medsTaken === "boolean" ||
        obj.medsTaken === 0 ||
        obj.medsTaken === 1 ||
        (typeof obj.medsTaken === "string" &&
            ["true", "false", "1", "0", "yes", "no"].includes(obj.medsTaken.trim().toLowerCase()));
    return hasScore || hasMeds;
}

export async function fetchPainFreeAppCondition(
    internetModule: InternetModule | null,
    apiUrl: string,
    timeoutRace?: <T>(promise: Promise<T>, ms: number) => Promise<T>,
    timeoutMs: number = 2500
): Promise<PainFreeSyncPayload> {
    const fallback: PainFreeSyncPayload = {
        morningScore: 35,
        morningCondition: "poor",
        medsTaken: false,
        painArea: "knee",
        source: "PainFree Sample"
    };

    const trimmedUrl = (apiUrl || "").trim();
    if (!internetModule || !trimmedUrl) {
        return fallback;
    }

    try {
        const req = new Request(trimmedUrl, { method: "GET" });
        const fetchAndReadText = async (): Promise<string | null> => {
            const resp = await internetModule.fetch(req);
            if (!resp || resp.status < 200 || resp.status >= 300) {
                return null;
            }
            return await resp.text();
        };
        const text = timeoutRace
            ? await timeoutRace(fetchAndReadText(), timeoutMs)
            : await fetchAndReadText();
        if (text !== null) {
            const data = JSON.parse(text);
            if (!hasValidPainFreePayload(data)) {
                return fallback;
            }
            const score = clampScore(data.morningScore, 35);
            const cond: MorningCondition = score >= 75 ? "good" : score >= 50 ? "fair" : "poor";
            return {
                morningScore: score,
                morningCondition: cond,
                medsTaken: parseStrictBoolean(data.medsTaken, false),
                painArea: data.painArea === "back" ? "back" : "knee",
                source: "PainFree Live"
            };
        }
    } catch (e) {
        // Fallback cleanly on timeout (headers or body), offline server, or malformed response
    }

    return fallback;
}

export async function postPainLogToPainFree(
    internetModule: InternetModule | null,
    baseConditionUrl: string,
    entry: PainLogEntry,
    activeOffsetCm: number,
    timeoutRace?: <T>(promise: Promise<T>, ms: number) => Promise<T>,
    timeoutMs: number = 2500
): Promise<boolean> {
    const trimmedUrl = (baseConditionUrl || "").trim();
    if (!internetModule || !trimmedUrl) {
        return false;
    }
    try {
        const logUrl = buildPainLogUrl(trimmedUrl);
        const req = new Request(logUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                ...entry,
                personalOffsetCm: activeOffsetCm
            })
        });
        const fetchPromise = internetModule.fetch(req);
        const resp = timeoutRace
            ? await timeoutRace(fetchPromise, timeoutMs)
            : await fetchPromise;
        return Boolean(resp && resp.status >= 200 && resp.status < 300);
    } catch (e) {
        return false;
    }
}
