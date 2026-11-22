import {
    evaluateSeatSafety,
    fetchPainFreeAppCondition,
    getScoreForCondition,
    MorningCondition,
    SeatSafeState
} from "./SeatSafeEvaluation";
import { SeatSafeChairVisual } from "./SeatSafeChairVisual";
import { SeatSafePanelUI } from "./SeatSafePanelUI";

const alertSfxAsset = requireAsset("../GeneratedSFX/risk_alert.wav") as AudioTrackAsset;
const safeSfxAsset = requireAsset("../GeneratedSFX/safe_chime.wav") as AudioTrackAsset;
const clickSfxAsset = requireAsset("../GeneratedSFX/btn_click.wav") as AudioTrackAsset;

@component
export class SeatSafeMain extends BaseScriptComponent {
    @input
    debugColliders: boolean = false;

    @input
    cameraObj!: SceneObject;

    @input
    chairAnchor!: SceneObject;

    @input
    chairVisual!: SeatSafeChairVisual;

    @input
    panelUI!: SeatSafePanelUI;

    @input
    painFreeApiUrl: string = "http://127.0.0.1:8091/api/condition";

    private internetModule: InternetModule | null = null;
    private alertAudio: AudioComponent | null = null;
    private safeAudio: AudioComponent | null = null;
    private clickAudio: AudioComponent | null = null;

    private state: SeatSafeState = {
        chairHeightCm: 30,
        painArea: "knee",
        medsTaken: false,
        morningCondition: "poor",
        morningScore: 35,
        syncSource: "Initial Check-in"
    };

    private overlayVisible: boolean = true;
    private dismissed: boolean = false;
    private playedHighRiskChime: boolean = false;

    onAwake() {
        this.internetModule = require("LensStudio:InternetModule") as InternetModule;
        this.setupAudio();

        this.createEvent("OnStartEvent").bind(() => {
            this.onStartSetup();
        });

        this.createEvent("UpdateEvent").bind(() => {
            this.updateProximity();
        });
    }

    private setupAudio() {
        const host = this.getSceneObject();
        this.alertAudio = this.makeLowLatencyAudio(host, alertSfxAsset, 0.85);
        this.safeAudio = this.makeLowLatencyAudio(host, safeSfxAsset, 0.75);
        this.clickAudio = this.makeLowLatencyAudio(host, clickSfxAsset, 0.65);
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

    private onStartSetup() {
        if (!this.cameraObj || !this.chairAnchor || !this.chairVisual || !this.panelUI) {
            print("SeatSafeMain: missing required @input references.");
            return;
        }

        if (this.debugColliders) {
            this.setColliderDebugAll(this.getSceneObject(), true);
        }

        this.panelUI.ensureBuilt();

        this.panelUI.onSelectHeight.add((heightCm: number) => {
            this.playClick();
            this.state.chairHeightCm = heightCm;
            this.dismissed = false;
            this.playedHighRiskChime = false;
            this.refreshAll(true);
        });

        this.panelUI.onTogglePainArea.add(() => {
            this.playClick();
            this.state.painArea = this.state.painArea === "knee" ? "back" : "knee";
            this.dismissed = false;
            this.refreshAll(true);
        });

        this.panelUI.onToggleMeds.add(() => {
            this.playClick();
            this.state.medsTaken = !this.state.medsTaken;
            this.dismissed = false;
            this.refreshAll(true);
        });

        this.panelUI.onSelectCondition.add((cond: MorningCondition) => {
            this.playClick();
            this.state.morningCondition = cond;
            this.state.morningScore = getScoreForCondition(cond);
            this.state.syncSource = "Manual Input";
            this.dismissed = false;
            this.refreshAll(true);
        });

        this.panelUI.onSyncApp.add(() => {
            this.playClick();
            this.syncPainFree();
        });

        this.panelUI.onDismiss.add(() => {
            this.playClick();
            this.dismissed = true;
            this.overlayVisible = false;
            this.refreshAll(false);
        });

        this.refreshAll(false);
    }

    private async syncPainFree() {
        const synced = await fetchPainFreeAppCondition(this.internetModule, this.painFreeApiUrl);
        this.state.morningScore = synced.morningScore;
        this.state.morningCondition = synced.morningCondition;
        this.state.medsTaken = synced.medsTaken;
        this.state.painArea = synced.painArea;
        this.state.syncSource = synced.source;
        this.dismissed = false;
        this.refreshAll(true);
    }

    private updateProximity() {
        if (!this.cameraObj || !this.chairAnchor) return;
        const camPos = this.cameraObj.getTransform().getWorldPosition();
        const chairPos = this.chairAnchor.getTransform().getWorldPosition();
        const dx = camPos.x - chairPos.x;
        const dz = camPos.z - chairPos.z;
        const distCm = Math.sqrt(dx * dx + dz * dz);

        if (distCm >= 250) {
            if (this.overlayVisible) {
                this.overlayVisible = false;
                this.dismissed = false;
                this.playedHighRiskChime = false;
                this.refreshAll(false);
            }
        } else if (distCm <= 200 && !this.dismissed) {
            if (!this.overlayVisible) {
                this.overlayVisible = true;
                this.refreshAll(false);
            }
            if (distCm <= 150 && !this.playedHighRiskChime) {
                const res = evaluateSeatSafety(this.state);
                if (res.riskLevel === "HIGH_RISK" && this.alertAudio) {
                    this.alertAudio.play(1);
                    this.playedHighRiskChime = true;
                }
            }
        }
    }

    private refreshAll(playFeedbackSound: boolean) {
        const res = evaluateSeatSafety(this.state);
        if (this.chairVisual) {
            this.chairVisual.updateVisual(
                this.state.chairHeightCm,
                res.safeThresholdCm,
                res.riskLevel,
                this.overlayVisible
            );
        }
        if (this.panelUI) {
            this.panelUI.setCardVisible(this.overlayVisible);
            this.panelUI.updateView(this.state, res);
        }

        if (playFeedbackSound) {
            if (res.riskLevel === "HIGH_RISK" && this.alertAudio) {
                this.alertAudio.play(1);
            } else if (res.riskLevel === "SAFE" && this.safeAudio) {
                this.safeAudio.play(1);
            }
        }
    }

    private playClick() {
        if (this.clickAudio) {
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
