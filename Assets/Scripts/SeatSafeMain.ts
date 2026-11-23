import {
    applyPersonalFeedback,
    evaluateMotionGuard,
    evaluateSeatSafety,
    fetchPainFreeAppCondition,
    getActivePersonalOffset,
    getScoreForCondition,
    MorningCondition,
    MotionAlertType,
    PainLogEntry,
    PainSeverity,
    postPainLogToPainFree,
    RiskLevel,
    SeatSafeState,
    SitContext
} from "./SeatSafeEvaluation";
import { SeatSafeChairVisual } from "./SeatSafeChairVisual";
import { SeatSafePanelUI } from "./SeatSafePanelUI";

const alertSfxAsset = requireAsset("../GeneratedSFX/risk_alert.wav") as AudioTrackAsset;
const safeSfxAsset = requireAsset("../GeneratedSFX/safe_chime.wav") as AudioTrackAsset;
const clickSfxAsset = requireAsset("../GeneratedSFX/btn_click.wav") as AudioTrackAsset;

const STORAGE_PROFILE_KEY = "seatsafe_profile_v2";

@component
export class SeatSafeMain extends BaseScriptComponent {
    @input
    debugColliders: boolean = false;

    @input
    enableAudio: boolean = false;

    @input
    cameraObj!: SceneObject;

    @input
    chairAnchor!: SceneObject;

    @input
    chairVisual!: SeatSafeChairVisual;

    @input
    panelUI!: SeatSafePanelUI;

    @input
    painFreeApiUrl: string = "";

    private internetModule: InternetModule | null = null;
    private alertAudio: AudioComponent | null = null;
    private safeAudio: AudioComponent | null = null;
    private clickAudio: AudioComponent | null = null;

    private state: SeatSafeState = {
        spatialMode: "chair",
        chairHeightCm: 30,
        stepRiseCm: 22,
        painArea: "knee",
        medsTaken: false,
        morningCondition: "fair",
        morningScore: 65,
        syncSource: "Initial Check-in",
        sitContext: "home",
        chairOffsetCm: 0,
        stepOffsetCm: 0,
        painLogs: []
    };

    private nextLogId: number = 1;
    private syncRequestSeq: number = 0;
    private overlayVisible: boolean = true;
    private dismissed: boolean = false;
    private playedHighRiskChime: boolean = false;
    private lastDistCm: number = 128;
    private lastEvaluatedRiskLevel: RiskLevel = "HIGH_RISK";

    // Real-time camera motion guard sensor state (BendSafe, StandSafe, PaceSafe)
    private sensorInitialized: boolean = false;
    private baseEyeY: number = 0;
    private prevCamPos: vec3 = vec3.zero();
    private stillAnchorPos: vec3 = vec3.zero();
    private samplePos: vec3 = vec3.zero();
    private sampleElapsedSec: number = 0;
    private stillSeconds: number = 0;
    private cumulativeStillTravelCm: number = 0;
    private standEndTimeSec: number = 0;
    private lowestRecentY: number = 0;
    private guardOverride: MotionAlertType = "none";
    private lastGuardKey: string = "";

    onAwake() {
        this.internetModule = require("LensStudio:InternetModule") as InternetModule;
        this.loadPersistedPersonalData();
        this.setupAudio();

        this.createEvent("OnStartEvent").bind(() => {
            this.onStartSetup();
        });

        this.createEvent("UpdateEvent").bind(() => {
            this.updateProximity();
            this.updateMotionSensors();
        });
    }

    private setupAudio() {
        if (!this.enableAudio) return;
        this.ensureAudioReady();
    }

    private ensureAudioReady() {
        if (this.alertAudio && this.safeAudio && this.clickAudio) return;
        const host = this.getSceneObject();
        this.alertAudio = this.makeLowLatencyAudio(host, alertSfxAsset, 0.12);
        this.safeAudio = this.makeLowLatencyAudio(host, safeSfxAsset, 0.10);
        this.clickAudio = this.makeLowLatencyAudio(host, clickSfxAsset, 0.08);
    }

    private makeLowLatencyAudio(
        host: SceneObject,
        track: AudioTrackAsset,
        volume: number
    ): AudioComponent {
        const ac = host.createComponent("Component.AudioComponent") as AudioComponent;
        ac.audioTrack = track;
        ac.volume = volume;
        ac.playbackMode = Audio.PlaybackMode.LowLatency;
        return ac;
    }

    private raceWithTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            let settled = false;
            const timer = this.createEvent("DelayedCallbackEvent") as DelayedCallbackEvent;
            timer.bind(() => {
                if (!settled) {
                    settled = true;
                    reject(new Error(`Timeout after ${timeoutMs}ms`));
                }
            });
            timer.reset(timeoutMs / 1000);

            promise.then(
                (val) => {
                    if (!settled) {
                        settled = true;
                        timer.enabled = false;
                        resolve(val);
                    }
                },
                (err) => {
                    if (!settled) {
                        settled = true;
                        timer.enabled = false;
                        reject(err);
                    }
                }
            );
        });
    }

    private onStartSetup() {
        if (!this.cameraObj || !this.chairAnchor || !this.chairVisual || !this.panelUI) {
            print("SeatSafeMain: missing required @input references.");
            return;
        }

        if (this.debugColliders) {
            this.setColliderDebugAll(this.getSceneObject(), true);
        }

        this.panelUI.ensureBuilt();

        this.panelUI.onToggleSpatialMode.add(() => {
            this.playClick();
            this.state.spatialMode = this.state.spatialMode === "chair" ? "stairs" : "chair";
            this.dismissed = false;
            this.refreshAll(true);
        });

        this.panelUI.onCycleGuardPreview.add(() => {
            this.playClick();
            const order: MotionAlertType[] = ["none", "bend", "stand", "pace"];
            const idx = order.indexOf(this.guardOverride);
            this.guardOverride = order[(idx + 1) % order.length];
            this.lastGuardKey = "";
            this.updateMotionSensors();
        });

        this.panelUI.onSelectHeight.add((slotVal: number) => {
            this.playClick();
            let changed = false;
            if (this.state.spatialMode === "stairs") {
                const nextRise = slotVal === 30 ? 22 : slotVal === 38 ? 18 : 14;
                changed = this.state.stepRiseCm !== nextRise;
                this.state.stepRiseCm = nextRise;
            } else {
                changed = this.state.chairHeightCm !== slotVal;
                this.state.chairHeightCm = slotVal;
            }
            const wasHidden = !this.overlayVisible;
            this.dismissed = false;
            this.refreshAll(changed || wasHidden);
        });

        this.panelUI.onTogglePainArea.add(() => {
            this.playClick();
            this.syncRequestSeq++;
            this.state.painArea = this.state.painArea === "knee" ? "back" : "knee";
            this.dismissed = false;
            this.refreshAll(true);
        });

        this.panelUI.onToggleMeds.add(() => {
            this.playClick();
            this.syncRequestSeq++;
            this.state.medsTaken = !this.state.medsTaken;
            this.dismissed = false;
            this.refreshAll(true);
            this.updateMotionSensors();
        });

        this.panelUI.onSelectCondition.add((cond: MorningCondition) => {
            this.playClick();
            this.syncRequestSeq++;
            this.state.morningCondition = cond;
            this.state.morningScore = getScoreForCondition(cond);
            this.state.syncSource = "Manual Input";
            this.dismissed = false;
            this.refreshAll(true);
            this.updateMotionSensors();
        });

        this.panelUI.onSyncApp.add(() => {
            this.playClick();
            this.syncPainFree();
        });

        this.panelUI.onToggleAudio.add(() => {
            this.enableAudio = !this.enableAudio;
            if (this.enableAudio) {
                this.ensureAudioReady();
                this.playClick();
            }
            this.panelUI.updateAudioState(this.enableAudio);
        });

        this.panelUI.onDismiss.add(() => {
            this.playClick();
            // Invalidate any in-flight Sync response so it cannot re-open a dismissed card
            this.syncRequestSeq++;
            this.dismissed = true;
            this.overlayVisible = false;
            this.guardOverride = "none";
            // Do not cancel an active live StandSafe fall-prevention countdown
            this.stillSeconds = 0;
            this.cumulativeStillTravelCm = 0;
            this.refreshAll(false);
            this.updateMotionSensors();
        });

        this.panelUI.onSelectContext.add((ctx: SitContext) => {
            this.playClick();
            this.state.sitContext = ctx;
            this.refreshAll(false);
        });

        this.panelUI.onRecordPain.add((severity: PainSeverity) => {
            this.playClick();
            this.recordPostSitPain(severity);
        });

        this.panelUI.onResetPersonal.add(() => {
            this.playClick();
            this.state.chairOffsetCm = 0;
            this.state.stepOffsetCm = 0;
            this.state.painLogs = [];
            this.savePersistedPersonalData();
            this.dismissed = false;
            this.refreshAll(false);
        });

        this.panelUI.updateAudioState(this.enableAudio);
        this.refreshAll(false);
        this.updateMotionSensors();
    }

    private updateMotionSensors() {
        if (!this.cameraObj || !this.panelUI) return;
        const nowSec = getTime();
        const rawDt = Math.max(0.001, getDeltaTime());
        const smoothDt = Math.min(0.25, rawDt);
        const tf = this.cameraObj.getTransform();
        const camPos = tf.getWorldPosition();

        if (!this.sensorInitialized) {
            this.sensorInitialized = true;
            this.baseEyeY = camPos.y;
            this.prevCamPos = new vec3(camPos.x, camPos.y, camPos.z);
            this.lowestRecentY = camPos.y;
            this.stillAnchorPos = new vec3(camPos.x, camPos.y, camPos.z);
            this.samplePos = new vec3(camPos.x, camPos.y, camPos.z);
            this.sampleElapsedSec = 0;
        }

        // Frame-to-frame vertical delta using un-clamped rawDt for true velocity
        const stepDy = camPos.y - this.prevCamPos.y;

        // StandSafe: rapid upward rise detection using true rawDt velocity & wall-clock countdown
        const vy = stepDy / rawDt;
        if (camPos.y < this.lowestRecentY) {
            this.lowestRecentY = camPos.y;
        } else {
            this.lowestRecentY += (camPos.y - this.lowestRecentY) * Math.min(1, smoothDt * 0.4);
        }

        const riseFromLow = camPos.y - this.lowestRecentY;
        if (vy >= 32 && riseFromLow >= 12 && (this.state.morningScore < 75 || !this.state.medsTaken)) {
            this.standEndTimeSec = nowSec + 3.0;
            this.lowestRecentY = camPos.y;
        }
        const standCountdownSec = Math.max(0, this.standEndTimeSec - nowSec);

        // BendSafe: require BOTH downward gaze AND actual head/torso lowering (crouchDepth >= 18cm)
        // so merely glancing 45° down at a low chair while standing upright never false-triggers.
        const lookDir = tf.back;
        const clampedY = Math.max(-1, Math.min(1, lookDir.y));
        const pitchDeg = (Math.asin(clampedY) * 180) / Math.PI;
        const crouchDepth = this.baseEyeY - camPos.y;
        const bendActive = pitchDeg <= -22 && crouchDepth >= 18;

        // PaceSafe: sample net displacement every 0.5s so slow 60fps pacing is captured
        // while sub-centimeter sensor jitter is rejected.
        this.sampleElapsedSec += rawDt;
        if (this.sampleElapsedSec >= 0.5) {
            const sdx = camPos.x - this.samplePos.x;
            const sdy = camPos.y - this.samplePos.y;
            const sdz = camPos.z - this.samplePos.z;
            const segDist = Math.sqrt(sdx * sdx + sdy * sdy + sdz * sdz);
            if (segDist >= 1.5) {
                this.cumulativeStillTravelCm += segDist;
            }
            this.samplePos = new vec3(camPos.x, camPos.y, camPos.z);
            this.sampleElapsedSec = 0;
        }

        const adx = camPos.x - this.stillAnchorPos.x;
        const ady = camPos.y - this.stillAnchorPos.y;
        const adz = camPos.z - this.stillAnchorPos.z;
        const anchorDist = Math.sqrt(adx * adx + ady * ady + adz * adz);

        if (anchorDist > 20 || this.cumulativeStillTravelCm >= 35) {
            this.stillAnchorPos = new vec3(camPos.x, camPos.y, camPos.z);
            this.stillSeconds = 0;
            this.cumulativeStillTravelCm = 0;
        } else {
            this.stillSeconds += rawDt;
        }

        this.prevCamPos = new vec3(camPos.x, camPos.y, camPos.z);

        const alert = evaluateMotionGuard({
            painArea: this.state.painArea,
            medsTaken: this.state.medsTaken,
            morningScore: this.state.morningScore,
            bendActive,
            pitchDeg,
            standCountdownSec,
            stillSeconds: this.stillSeconds,
            overrideMode: this.guardOverride
        });

        const isLiveStand = standCountdownSec > 0.05;
        const isLiveAlert = (alert.type !== "none" && this.guardOverride === "none") || isLiveStand;
        const key = `${alert.type}|${alert.badge}|${alert.detail}|${alert.severity}|${this.guardOverride}|${isLiveAlert}`;
        if (key !== this.lastGuardKey || isLiveAlert) {
            this.lastGuardKey = key;
            this.panelUI.updateMotionGuard(alert, this.guardOverride, this.cameraObj, isLiveAlert);
        }
    }

    private formatNowTime(): string {
        const d = new Date();
        const hh = String(d.getHours()).padStart(2, "0");
        const mm = String(d.getMinutes()).padStart(2, "0");
        return `${hh}:${mm}`;
    }

    private async recordPostSitPain(severity: PainSeverity) {
        const isStairs = this.state.spatialMode === "stairs";
        const prevOffset = isStairs ? this.state.stepOffsetCm : this.state.chairOffsetCm;
        const feedback = applyPersonalFeedback(prevOffset, severity);

        if (isStairs) {
            this.state.stepOffsetCm = feedback.nextOffsetCm;
        } else {
            this.state.chairOffsetCm = feedback.nextOffsetCm;
        }

        const measureCm = isStairs ? this.state.stepRiseCm : this.state.chairHeightCm;

        const entry: PainLogEntry = {
            id: this.nextLogId++,
            timeLabel: this.formatNowTime(),
            spatialMode: this.state.spatialMode,
            context: this.state.sitContext,
            measureCm,
            painArea: this.state.painArea,
            medsTaken: this.state.medsTaken,
            severity,
            offsetDeltaCm: feedback.deltaCm,
            syncState: "Local"
        };

        this.state.painLogs = [entry, ...this.state.painLogs].slice(0, 6);
        const persisted = this.savePersistedPersonalData();
        if (!persisted) {
            entry.syncState = "MemOnly";
        }
        this.dismissed = false;
        this.refreshAll(false);

        const synced = await postPainLogToPainFree(
            this.internetModule,
            this.painFreeApiUrl,
            entry,
            getActivePersonalOffset(this.state),
            (p, ms) => this.raceWithTimeout(p, ms),
            2500
        );
        if (synced) {
            entry.syncState = "Synced";
            this.savePersistedPersonalData();
            this.refreshAll(false);
        }
    }

    private loadPersistedPersonalData() {
        try {
            const store = global.persistentStorageSystem?.store;
            if (!store || !store.has(STORAGE_PROFILE_KEY)) return;
            const raw = store.getString(STORAGE_PROFILE_KEY);
            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== "object") return;

            if (typeof parsed.chairOffsetCm === "number" && isFinite(parsed.chairOffsetCm)) {
                this.state.chairOffsetCm = Math.max(-4, Math.min(8, Math.round(parsed.chairOffsetCm)));
            }
            if (typeof parsed.stepOffsetCm === "number" && isFinite(parsed.stepOffsetCm)) {
                this.state.stepOffsetCm = Math.max(-4, Math.min(8, Math.round(parsed.stepOffsetCm)));
            }
            let maxId =
                typeof parsed.lastIssuedLogId === "number" && isFinite(parsed.lastIssuedLogId)
                    ? Math.max(0, Math.floor(parsed.lastIssuedLogId))
                    : 0;
            if (Array.isArray(parsed.painLogs)) {
                this.state.painLogs = parsed.painLogs
                    .filter((e: any) => e && typeof e.severity === "string")
                    .map((e: any) => ({
                        ...e,
                        id: typeof e.id === "number" && isFinite(e.id) ? e.id : 1,
                        spatialMode: e.spatialMode === "stairs" ? "stairs" : "chair",
                        measureCm:
                            typeof e.measureCm === "number"
                                ? e.measureCm
                                : typeof e.chairHeightCm === "number"
                                  ? e.chairHeightCm
                                  : 30
                    }))
                    .slice(0, 6);

                maxId = this.state.painLogs.reduce((m, e) => Math.max(m, e.id || 0), maxId);
            }
            this.nextLogId = maxId + 1;
        } catch (e) {
            // Safe fallback if storage is unavailable or corrupted
        }
    }

    private savePersistedPersonalData(): boolean {
        try {
            const store = global.persistentStorageSystem?.store;
            if (!store) return false;
            const payload = {
                chairOffsetCm: this.state.chairOffsetCm,
                stepOffsetCm: this.state.stepOffsetCm,
                lastIssuedLogId: Math.max(0, this.nextLogId - 1),
                painLogs: this.state.painLogs.slice(0, 6)
            };
            store.putString(STORAGE_PROFILE_KEY, JSON.stringify(payload));
            return true;
        } catch (e) {
            return false;
        }
    }

    private async syncPainFree() {
        const token = ++this.syncRequestSeq;
        const synced = await fetchPainFreeAppCondition(
            this.internetModule,
            this.painFreeApiUrl,
            (p, ms) => this.raceWithTimeout(p, ms),
            2500
        );
        // Ignore stale response if user dismissed, edited manually, or started a newer sync
        if (token !== this.syncRequestSeq) return;

        this.state.morningScore = synced.morningScore;
        this.state.morningCondition = synced.morningCondition;
        this.state.medsTaken = synced.medsTaken;
        this.state.painArea = synced.painArea;
        this.state.syncSource = synced.source;
        this.dismissed = false;
        this.refreshAll(true);
        this.updateMotionSensors();
    }

    private updateProximity() {
        if (!this.cameraObj || !this.chairAnchor) return;
        const camPos = this.cameraObj.getTransform().getWorldPosition();
        const chairPos = this.chairAnchor.getTransform().getWorldPosition();
        const dx = camPos.x - chairPos.x;
        const dz = camPos.z - chairPos.z;
        const distCm = Math.sqrt(dx * dx + dz * dz);
        this.lastDistCm = distCm;

        if (distCm >= 250) {
            this.dismissed = false;
            this.playedHighRiskChime = false;
            if (this.overlayVisible) {
                this.overlayVisible = false;
                this.refreshAll(false);
            }
        } else if (distCm <= 200 && !this.dismissed) {
            if (!this.overlayVisible) {
                this.overlayVisible = true;
                this.refreshAll(false);
            }
            // Use cached risk level — zero per-frame evaluation cost in proximity loop
            if (
                this.enableAudio &&
                this.alertAudio &&
                distCm <= 150 &&
                !this.playedHighRiskChime &&
                this.lastEvaluatedRiskLevel === "HIGH_RISK"
            ) {
                this.alertAudio.play(1);
                this.playedHighRiskChime = true;
            }
        }
    }

    private refreshAll(playFeedbackSound: boolean) {
        const res = evaluateSeatSafety(this.state);
        this.lastEvaluatedRiskLevel = res.riskLevel;

        const measureCm =
            this.state.spatialMode === "stairs"
                ? this.state.stepRiseCm
                : this.state.chairHeightCm;

        if (this.chairVisual) {
            this.chairVisual.updateVisual(
                this.state.spatialMode,
                measureCm,
                res.safeThresholdCm,
                res.riskLevel,
                this.overlayVisible
            );
        }
        if (this.panelUI) {
            this.panelUI.setCardVisible(this.overlayVisible);
            this.panelUI.updateView(this.state, res);
        }

        if (playFeedbackSound && this.enableAudio && this.overlayVisible) {
            // High-risk alert chime enforces design-brief 1.5m proximity & once-per-approach rule
            if (
                res.riskLevel === "HIGH_RISK" &&
                this.alertAudio &&
                this.lastDistCm <= 150 &&
                !this.playedHighRiskChime
            ) {
                this.alertAudio.play(1);
                this.playedHighRiskChime = true;
            } else if (res.riskLevel === "SAFE" && this.safeAudio && this.lastDistCm <= 200) {
                this.safeAudio.play(1);
            }
        }
    }

    private playClick() {
        if (this.enableAudio && this.clickAudio) {
            this.clickAudio.play(1);
        }
    }

    private setColliderDebugAll(root: SceneObject, enabled: boolean) {
        for (const col of root.getComponents("Physics.ColliderComponent")) {
            (col as ColliderComponent).debugDrawEnabled = enabled;
        }
        for (const body of root.getComponents("Physics.BodyComponent")) {
            (body as BodyComponent).debugDrawEnabled = enabled;
        }
        for (let i = 0; i < root.getChildrenCount(); i++) {
            this.setColliderDebugAll(root.getChild(i), enabled);
        }
    }
}
