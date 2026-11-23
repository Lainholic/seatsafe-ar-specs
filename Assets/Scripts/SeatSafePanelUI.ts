import Event from "InteractionKit.lspkg/Utils/Event";
import { Frame } from "UIKit.lspkg/Scripts/Components/Frame/Frame";
import { Button } from "UIKit.lspkg/Scripts/Components/Button/Button";
import { ElementContent } from "UIKit.lspkg/Scripts/Components/Content/ElementContent";
import { addContentToElement } from "UIKit.lspkg/Scripts/Components/Content/ElementContentFactory";
import { FlexLayout } from "UIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout";
import { FlexItem } from "UIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem";
import {
    FlexDirection,
    FlexJustify,
    FlexAlign
} from "UIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes";
import { RoundedRectangle } from "UIKit.lspkg/Scripts/Visuals/RoundedRectangle/RoundedRectangle";
import { createChildSceneObjectWithParentLayer } from "UIKit.lspkg/Scripts/Utility/SceneUtilities";
import {
    formatContextLabel,
    formatSeverityLabel,
    getActivePersonalOffset,
    MorningCondition,
    MotionAlertState,
    MotionAlertType,
    PainSeverity,
    RiskLevel,
    SeatSafeResult,
    SeatSafeState,
    SitContext
} from "./SeatSafeEvaluation";

interface RiskPalette {
    accent: vec4;
    pillBg: vec4;
    pillBorder: vec4;
    tipBg: vec4;
    tipBorder: vec4;
    tipText: vec4;
}

const PALETTES: Record<RiskLevel, RiskPalette> = {
    SAFE: {
        accent: new vec4(0.18, 0.9, 0.52, 1.0),
        pillBg: new vec4(0.08, 0.28, 0.18, 1.0),
        pillBorder: new vec4(0.24, 0.94, 0.56, 1.0),
        tipBg: new vec4(0.07, 0.2, 0.14, 1.0),
        tipBorder: new vec4(0.2, 0.72, 0.44, 1.0),
        tipText: new vec4(0.76, 1.0, 0.86, 1.0)
    },
    CAUTION: {
        accent: new vec4(1.0, 0.78, 0.18, 1.0),
        pillBg: new vec4(0.32, 0.24, 0.06, 1.0),
        pillBorder: new vec4(1.0, 0.82, 0.24, 1.0),
        tipBg: new vec4(0.24, 0.18, 0.06, 1.0),
        tipBorder: new vec4(0.92, 0.72, 0.2, 1.0),
        tipText: new vec4(1.0, 0.94, 0.74, 1.0)
    },
    HIGH_RISK: {
        accent: new vec4(1.0, 0.28, 0.3, 1.0),
        pillBg: new vec4(0.34, 0.09, 0.11, 1.0),
        pillBorder: new vec4(1.0, 0.34, 0.36, 1.0),
        tipBg: new vec4(0.26, 0.09, 0.1, 1.0),
        tipBorder: new vec4(0.92, 0.32, 0.34, 1.0),
        tipText: new vec4(1.0, 0.86, 0.84, 1.0)
    }
};

interface ButtonHandle {
    btn: Button;
    content: ElementContent;
}

@component
export class SeatSafePanelUI extends BaseScriptComponent {
    @input
    cardAnchor!: SceneObject;

    @input
    controlAnchor!: SceneObject;

    @input
    logAnchor!: SceneObject;

    @input
    hudAnchor!: SceneObject;

    public onSelectHeight: Event<number> = new Event<number>();
    public onTogglePainArea: Event<void> = new Event<void>();
    public onToggleMeds: Event<void> = new Event<void>();
    public onSelectCondition: Event<MorningCondition> = new Event<MorningCondition>();
    public onSyncApp: Event<void> = new Event<void>();
    public onDismiss: Event<void> = new Event<void>();
    public onSelectContext: Event<SitContext> = new Event<SitContext>();
    public onRecordPain: Event<PainSeverity> = new Event<PainSeverity>();
    public onResetPersonal: Event<void> = new Event<void>();
    public onToggleSpatialMode: Event<void> = new Event<void>();
    public onCycleGuardPreview: Event<void> = new Event<void>();
    public onToggleAudio: Event<void> = new Event<void>();

    private cardHost: SceneObject | null = null;
    private controlHost: SceneObject | null = null;
    private logHost: SceneObject | null = null;
    private hudHost: SceneObject | null = null;

    // Motion Guard HUD refs (BendSafe / StandSafe / PaceSafe)
    private hudBg: RoundedRectangle | null = null;
    private hudBadgeTxt: Text | null = null;
    private hudDetailTxt: Text | null = null;

    // Warning card visual refs
    private cardAccentBar: RoundedRectangle | null = null;
    private badgePillBg: RoundedRectangle | null = null;
    private badgeTextComp: Text | null = null;
    private meterFillBg: RoundedRectangle | null = null;
    private meterFillObj: SceneObject | null = null;
    private meterWidthCm: number = 58;
    private heightCardBg: RoundedRectangle | null = null;
    private heightTextComp: Text | null = null;
    private contextTextComp: Text | null = null;
    private tipBoxBg: RoundedRectangle | null = null;
    private tipTextComp: Text | null = null;

    // Control panel visual refs
    private panelAccentBar: RoundedRectangle | null = null;
    private syncPillBg: RoundedRectangle | null = null;
    private syncStatusComp: Text | null = null;
    private secHeightTxt: Text | null = null;
    private modeToggleHandle: ButtonHandle | null = null;
    private guardPreviewHandle: ButtonHandle | null = null;
    private audioToggleHandle: ButtonHandle | null = null;

    private heightBtns: Record<number, ButtonHandle> = {};
    private condBtns: Record<MorningCondition, ButtonHandle | null> = {
        good: null,
        fair: null,
        poor: null
    };
    private painAreaHandle: ButtonHandle | null = null;
    private medsHandle: ButtonHandle | null = null;

    // Pain log & personalization panel refs
    private logAccentBar: RoundedRectangle | null = null;
    private personalPillBg: RoundedRectangle | null = null;
    private personalStatusComp: Text | null = null;
    private ctxBtns: Record<SitContext, ButtonHandle | null> = {
        home: null,
        cafe: null,
        clinic: null
    };
    private logRowTexts: Text[] = [];

    private built: boolean = false;

    onAwake() {
        this.ensureBuilt();
    }

    public ensureBuilt() {
        if (this.built) return;
        this.built = true;

        const cardParent = this.cardAnchor ? this.cardAnchor : this.getSceneObject();
        const ctrlParent = this.controlAnchor ? this.controlAnchor : this.getSceneObject();
        const logParent = this.logAnchor ? this.logAnchor : this.getSceneObject();
        const hudParent = this.hudAnchor ? this.hudAnchor : cardParent;

        this.buildMotionGuardHUD(hudParent);
        this.buildChairCard(cardParent);
        this.buildControlPanel(ctrlParent);
        this.buildPainLogPanel(logParent);
    }

    public setCardVisible(visible: boolean) {
        if (this.cardHost) {
            this.cardHost.enabled = visible;
        }
    }

    public updateAudioState(enabled: boolean) {
        this.ensureBuilt();
        if (this.audioToggleHandle) {
            this.audioToggleHandle.btn.isOn = enabled;
            this.audioToggleHandle.content.text = enabled ? "Sound: On" : "Sound: Off";
        }
    }

    public updateMotionGuard(
        alert: MotionAlertState,
        overrideMode: MotionAlertType,
        cameraObj?: SceneObject | null,
        useLiveGaze?: boolean
    ) {
        this.ensureBuilt();

        if (this.guardPreviewHandle) {
            const labelMap: Record<MotionAlertType, string> = {
                none: "Guard: Auto",
                bend: "Guard: Bend",
                stand: "Guard: Stand",
                pace: "Guard: Pace"
            };
            this.guardPreviewHandle.content.text = labelMap[overrideMode];
            this.guardPreviewHandle.btn.isOn = overrideMode !== "none";
        }

        if (!this.hudHost) return;
        if (alert.type === "none") {
            this.hudHost.enabled = false;
            return;
        }

        this.hudHost.enabled = true;

        // Place live motion warnings (including live StandSafe even during Guard preview)
        // in the user's current view; keep pure manual preview anchored above the central card.
        const useLiveGazePlacement =
            Boolean(cameraObj) && (useLiveGaze !== undefined ? useLiveGaze : overrideMode === "none");
        if (useLiveGazePlacement && cameraObj) {
            const camTf = cameraObj.getTransform();
            const camPos = camTf.getWorldPosition();
            const lookDir = camTf.back.normalize();
            const camUp = camTf.up.normalize();
            const targetPos = camPos.add(lookDir.uniformScale(128)).add(camUp.uniformScale(35));
            this.hudHost.getTransform().setWorldPosition(targetPos);
            this.hudHost.getTransform().setWorldRotation(camTf.getWorldRotation());
        } else {
            this.hudHost.getTransform().setLocalPosition(vec3.zero());
            this.hudHost.getTransform().setLocalRotation(quat.quatIdentity());
        }
        const bgColor =
            alert.severity === "red"
                ? new vec4(0.32, 0.08, 0.1, 0.98)
                : alert.severity === "amber"
                  ? new vec4(0.3, 0.21, 0.05, 0.98)
                  : new vec4(0.08, 0.2, 0.28, 0.98);
        const borderColor =
            alert.severity === "red"
                ? new vec4(1.0, 0.34, 0.36, 1.0)
                : alert.severity === "amber"
                  ? new vec4(1.0, 0.8, 0.22, 1.0)
                  : new vec4(0.3, 0.88, 1.0, 1.0);

        if (this.hudBg) {
            this.hudBg.backgroundColor = bgColor;
            this.hudBg.borderColor = borderColor;
        }
        if (this.hudBadgeTxt) {
            this.hudBadgeTxt.text = alert.badge;
            this.hudBadgeTxt.textFill.color = borderColor;
        }
        if (this.hudDetailTxt) {
            this.hudDetailTxt.text = alert.detail;
        }
    }

    public updateView(state: SeatSafeState, result: SeatSafeResult) {
        this.ensureBuilt();
        const pal = PALETTES[result.riskLevel];
        const isStairs = state.spatialMode === "stairs";

        if (this.cardAccentBar) {
            this.cardAccentBar.backgroundColor = pal.accent;
        }
        if (this.panelAccentBar) {
            this.panelAccentBar.backgroundColor = pal.accent;
        }
        if (this.logAccentBar) {
            this.logAccentBar.backgroundColor = new vec4(0.32, 0.82, 1.0, 1.0);
        }
        if (this.badgePillBg) {
            this.badgePillBg.backgroundColor = pal.pillBg;
            this.badgePillBg.borderColor = pal.pillBorder;
        }
        if (this.badgeTextComp) {
            this.badgeTextComp.text = result.badgeText;
            this.badgeTextComp.textFill.color = pal.accent;
        }

        if (this.meterFillBg && this.meterFillObj) {
            const ratio = Math.max(0.1, Math.min(1.0, result.riskScore / 10));
            const fillW = Math.max(3.0, this.meterWidthCm * ratio);
            this.meterFillBg.size = new vec2(fillW, 2.0);
            this.meterFillBg.backgroundColor = pal.accent;
            const leftX = -this.meterWidthCm * 0.5 + fillW * 0.5;
            this.meterFillObj.getTransform().setLocalPosition(new vec3(leftX, 0, 0.15));
        }

        if (this.heightCardBg) {
            this.heightCardBg.borderColor =
                result.deficitCm > 0 ? pal.pillBorder : new vec4(0.24, 0.85, 0.58, 1.0);
        }
        if (this.heightTextComp) {
            this.heightTextComp.text = result.heightText;
        }
        if (this.contextTextComp) {
            this.contextTextComp.text = result.contextText;
        }
        if (this.tipBoxBg) {
            this.tipBoxBg.backgroundColor = pal.tipBg;
            this.tipBoxBg.borderColor = pal.tipBorder;
        }
        if (this.tipTextComp) {
            this.tipTextComp.text = result.tipText;
            this.tipTextComp.textFill.color = pal.tipText;
        }

        if (this.syncStatusComp) {
            this.syncStatusComp.text = `${state.syncSource} · AM ${state.morningScore}/100`;
        }
        if (this.syncPillBg) {
            const isLive = state.syncSource.includes("Live");
            const isSample = state.syncSource.includes("PainFree");
            this.syncPillBg.borderColor = isLive
                ? new vec4(0.24, 0.95, 0.58, 1.0)
                : isSample
                  ? new vec4(0.35, 0.82, 1.0, 1.0)
                  : new vec4(0.55, 0.65, 0.78, 1.0);
        }

        if (this.modeToggleHandle) {
            this.modeToggleHandle.btn.isOn = isStairs;
            this.modeToggleHandle.content.text = isStairs ? "Space: Stairs" : "Space: Chair";
        }
        if (this.secHeightTxt) {
            this.secHeightTxt.text = isStairs
                ? "— STEP RISE SIMULATION —"
                : "— CHAIR HEIGHT SIMULATION —";
        }

        // Dynamic labels & active toggle highlights on height/step buttons
        const h30 = this.heightBtns[30];
        const h38 = this.heightBtns[38];
        const h46 = this.heightBtns[46];
        if (h30 && h38 && h46) {
            if (isStairs) {
                h30.content.text = "High 22cm";
                h38.content.text = "Mid 18cm";
                h46.content.text = "Low 14cm";
                h30.btn.isOn = state.stepRiseCm === 22;
                h38.btn.isOn = state.stepRiseCm === 18;
                h46.btn.isOn = state.stepRiseCm === 14;
            } else {
                h30.content.text = "Low 30cm";
                h38.content.text = "Mid 38cm";
                h46.content.text = "Tall 46cm";
                h30.btn.isOn = state.chairHeightCm === 30;
                h38.btn.isOn = state.chairHeightCm === 38;
                h46.btn.isOn = state.chairHeightCm === 46;
            }
        }

        for (const cond of ["good", "fair", "poor"] as MorningCondition[]) {
            const handle = this.condBtns[cond];
            if (handle) {
                handle.btn.isOn = state.morningCondition === cond;
            }
        }
        if (this.painAreaHandle) {
            this.painAreaHandle.btn.isOn = state.painArea === "back";
            this.painAreaHandle.content.text =
                state.painArea === "knee" ? "Area: Knee 45cm" : "Area: Back 43cm";
        }
        if (this.medsHandle) {
            this.medsHandle.btn.isOn = state.medsTaken;
            this.medsHandle.content.text = state.medsTaken ? "Meds: Taken" : "Meds: None";
        }

        // Sync left Pain Log & Personalization panel (separate chair/step personal offsets)
        const activeOffset = getActivePersonalOffset(state);
        if (this.personalStatusComp) {
            const sign = activeOffset >= 0 ? "+" : "";
            const targetLabel = isStairs ? "Max Step" : "Safe Seat";
            this.personalStatusComp.text = `My ${targetLabel}: ${result.safeThresholdCm}cm (Personal ${sign}${activeOffset}cm)`;
        }
        if (this.personalPillBg) {
            this.personalPillBg.borderColor =
                activeOffset > 0
                    ? new vec4(1.0, 0.62, 0.25, 1.0)
                    : activeOffset < 0
                      ? new vec4(0.24, 0.92, 0.58, 1.0)
                      : new vec4(0.36, 0.82, 1.0, 1.0);
        }

        for (const ctx of ["home", "cafe", "clinic"] as SitContext[]) {
            const handle = this.ctxBtns[ctx];
            if (handle) {
                handle.btn.isOn = state.sitContext === ctx;
            }
        }

        for (let i = 0; i < this.logRowTexts.length; i++) {
            const entry = state.painLogs[i];
            if (entry) {
                const ctxTxt = formatContextLabel(entry.context);
                const modeTag = entry.spatialMode === "stairs" ? "Step" : "Seat";
                const sevTxt = formatSeverityLabel(entry.severity);
                const deltaTxt =
                    entry.offsetDeltaCm !== 0
                        ? ` (${entry.offsetDeltaCm > 0 ? "+" : ""}${entry.offsetDeltaCm}cm)`
                        : "";
                this.logRowTexts[i].text =
                    `${entry.timeLabel} · ${ctxTxt} ${modeTag} ${entry.measureCm}cm → ${sevTxt}${deltaTxt} [${entry.syncState}]`;
                this.logRowTexts[i].textFill.color =
                    entry.severity === "sharp"
                        ? new vec4(1.0, 0.55, 0.55, 1.0)
                        : entry.severity === "mild"
                          ? new vec4(1.0, 0.88, 0.45, 1.0)
                          : new vec4(0.62, 0.98, 0.74, 1.0);
            } else {
                this.logRowTexts[i].text =
                    i === 0 ? "No records yet. Tap pain after sitting/stepping." : "—";
                this.logRowTexts[i].textFill.color = new vec4(0.55, 0.65, 0.76, 1.0);
            }
        }
    }

    private buildMotionGuardHUD(parent: SceneObject) {
        this.hudHost = createChildSceneObjectWithParentLayer("MotionGuardHUD", parent);
        this.hudBg = this.addRoundedRect(
            this.hudHost,
            "MotionHudBg",
            72,
            13.5,
            2.6,
            new vec4(0.24, 0.06, 0.08, 0.96),
            true,
            0.28,
            new vec4(1.0, 0.35, 0.35, 1.0)
        );

        const badgeObj = createChildSceneObjectWithParentLayer("MotionHudBadge", this.hudHost);
        badgeObj.getTransform().setLocalPosition(new vec3(0, 2.7, 0.35));
        this.hudBadgeTxt = badgeObj.createComponent("Component.Text") as Text;
        this.applyCrispTextStyle(this.hudBadgeTxt, 104, 800, new vec4(1.0, 0.45, 0.45, 1.0), 0.14);

        const detailObj = createChildSceneObjectWithParentLayer("MotionHudDetail", this.hudHost);
        detailObj.getTransform().setLocalPosition(new vec3(0, -2.7, 0.35));
        this.hudDetailTxt = detailObj.createComponent("Component.Text") as Text;
        this.applyCrispTextStyle(this.hudDetailTxt, 76, 700, new vec4(0.99, 1.0, 1.0, 1.0), 0.12);

        this.hudHost.enabled = false;
    }

    private buildChairCard(parent: SceneObject) {
        this.cardHost = createChildSceneObjectWithParentLayer("ChairWarningCard", parent);
        const frame = this.cardHost.createComponent(Frame.getTypeName()) as Frame;
        frame.innerSize = new vec2(70, 41);
        frame.allowScaling = false;

        const backdropObj = createChildSceneObjectWithParentLayer("CardBackdrop", this.cardHost);
        backdropObj.getTransform().setLocalPosition(new vec3(0, 0, 0.25));
        this.createRoundedRectOn(
            backdropObj,
            68,
            39,
            2.6,
            new vec4(0.05, 0.08, 0.13, 0.9),
            true,
            0.16,
            new vec4(0.32, 0.42, 0.56, 0.65)
        );

        const content = createChildSceneObjectWithParentLayer("CardContent", this.cardHost);
        content.getTransform().setLocalPosition(new vec3(0, 0, 0.9));

        const col = content.createComponent(FlexLayout.getTypeName()) as FlexLayout;
        col.direction = FlexDirection.Column;
        col.width = 64;
        col.height = 36.5;
        col.justifyContent = FlexJustify.SpaceBetween;
        col.alignItems = FlexAlign.Center;
        col.rowGap = 1.0;

        const accentHolder = this.createFlexBox(content, "CardAccentBar", 64, 1.2);
        this.cardAccentBar = this.addRoundedRect(
            accentHolder,
            "CardAccentRect",
            64,
            1.2,
            0.6,
            PALETTES.HIGH_RISK.accent
        );

        const badgeSlot = this.createFlexBox(content, "BadgeSlot", 64, 8.2);
        this.badgePillBg = this.addRoundedRect(
            badgeSlot,
            "BadgePillBg",
            56,
            7.8,
            3.9,
            PALETTES.HIGH_RISK.pillBg,
            true,
            0.24,
            PALETTES.HIGH_RISK.pillBorder
        );
        this.badgeTextComp = this.createOverlayText(
            badgeSlot,
            "BadgeRow",
            136,
            PALETTES.HIGH_RISK.accent,
            0.35,
            800
        );

        const meterSlot = this.createFlexBox(content, "RiskMeterSlot", 64, 2.6);
        this.addRoundedRect(
            meterSlot,
            "MeterTrack",
            this.meterWidthCm,
            2.0,
            1.0,
            new vec4(0.16, 0.2, 0.27, 1.0),
            true,
            0.12,
            new vec4(0.32, 0.38, 0.48, 1.0)
        );
        this.meterFillObj = createChildSceneObjectWithParentLayer("MeterFill", meterSlot);
        this.meterFillObj.getTransform().setLocalPosition(new vec3(0, 0, 0.15));
        this.meterFillBg = this.createRoundedRectOn(
            this.meterFillObj,
            this.meterWidthCm * 0.5,
            2.0,
            1.0,
            PALETTES.HIGH_RISK.accent
        );

        const heightSlot = this.createFlexBox(content, "HeightCardSlot", 64, 7.6);
        this.heightCardBg = this.addRoundedRect(
            heightSlot,
            "HeightCardBg",
            64,
            7.4,
            1.6,
            new vec4(0.1, 0.14, 0.21, 0.98),
            true,
            0.18,
            new vec4(0.38, 0.48, 0.64, 1.0)
        );
        this.heightTextComp = this.createOverlayText(
            heightSlot,
            "HeightRow",
            94,
            new vec4(0.99, 1.0, 1.0, 1.0),
            0.35,
            700
        );

        this.contextTextComp = this.addTextRow(
            content,
            "ContextRow",
            64,
            4.6,
            80,
            new vec4(0.88, 0.96, 1.0, 1.0),
            700
        );

        const tipSlot = this.createFlexBox(content, "TipBannerSlot", 64, 7.2);
        this.tipBoxBg = this.addRoundedRect(
            tipSlot,
            "TipBannerBg",
            64,
            6.9,
            1.5,
            PALETTES.HIGH_RISK.tipBg,
            true,
            0.18,
            PALETTES.HIGH_RISK.tipBorder
        );
        this.tipTextComp = this.createOverlayText(
            tipSlot,
            "TipRow",
            76,
            PALETTES.HIGH_RISK.tipText,
            0.35,
            700
        );

        col.refreshChildren();
    }

    private buildControlPanel(parent: SceneObject) {
        this.controlHost = createChildSceneObjectWithParentLayer("ControlPanel", parent);
        const frame = this.controlHost.createComponent(Frame.getTypeName()) as Frame;
        frame.innerSize = new vec2(62, 72);
        frame.allowScaling = false;

        const backdropObj = createChildSceneObjectWithParentLayer("ControlBackdrop", this.controlHost);
        backdropObj.getTransform().setLocalPosition(new vec3(0, 0, 0.25));
        this.createRoundedRectOn(
            backdropObj,
            60,
            70,
            2.6,
            new vec4(0.05, 0.08, 0.13, 0.9),
            true,
            0.16,
            new vec4(0.32, 0.42, 0.56, 0.65)
        );

        const content = createChildSceneObjectWithParentLayer("ControlContent", this.controlHost);
        content.getTransform().setLocalPosition(new vec3(0, 0, 0.9));

        const col = content.createComponent(FlexLayout.getTypeName()) as FlexLayout;
        col.direction = FlexDirection.Column;
        col.width = 54;
        col.height = 67;
        col.justifyContent = FlexJustify.SpaceBetween;
        col.alignItems = FlexAlign.Stretch;
        col.rowGap = 0.8;

        const topAccent = this.createFlexBox(content, "PanelAccentSlot", 54, 1.0);
        this.panelAccentBar = this.addRoundedRect(
            topAccent,
            "PanelAccentRect",
            54,
            1.0,
            0.5,
            PALETTES.HIGH_RISK.accent
        );

        const titleTxt = this.addTextRow(
            content,
            "PanelTitle",
            54,
            4.5,
            106,
            new vec4(0.99, 1.0, 1.0, 1.0),
            800
        );
        titleTxt.text = "PAINFREE AR · CHECK-IN";

        const syncSlot = this.createFlexBox(content, "SyncPillSlot", 54, 4.4);
        this.syncPillBg = this.addRoundedRect(
            syncSlot,
            "SyncPillBg",
            54,
            4.1,
            2.0,
            new vec4(0.1, 0.15, 0.24, 0.98),
            true,
            0.16,
            new vec4(0.35, 0.82, 1.0, 1.0)
        );
        this.syncStatusComp = this.createOverlayText(
            syncSlot,
            "SyncStatus",
            76,
            new vec4(0.9, 0.98, 1.0, 1.0),
            0.3,
            800
        );

        // Mode & Motion Guard selector row (>= 6cm button height per design brief)
        const modeRow = this.createRow(content, "RowModeGuard", 54, 6.2);
        this.modeToggleHandle = this.createBtn(
            modeRow,
            "ModeToggle",
            "Space: Chair",
            25.8,
            6.0,
            "Secondary",
            true,
            () => this.onToggleSpatialMode.invoke()
        );
        this.guardPreviewHandle = this.createBtn(
            modeRow,
            "GuardPreview",
            "Guard: Auto",
            25.8,
            6.0,
            "Secondary",
            true,
            () => this.onCycleGuardPreview.invoke()
        );

        // Section 1: Chair Height / Step Rise
        this.secHeightTxt = this.addSectionLabel(content, "SecHeight", "CHAIR HEIGHT SIMULATION");
        const row1 = this.createRow(content, "RowHeight", 54, 6.2);
        this.heightBtns[30] = this.createBtn(row1, "Low 30cm", "Low 30cm", 16.8, 6.0, "Secondary", true, () =>
            this.onSelectHeight.invoke(30)
        );
        this.heightBtns[38] = this.createBtn(row1, "Mid 38cm", "Mid 38cm", 16.8, 6.0, "Secondary", true, () =>
            this.onSelectHeight.invoke(38)
        );
        this.heightBtns[46] = this.createBtn(row1, "Safe 46cm", "Tall 46cm", 16.8, 6.0, "Secondary", true, () =>
            this.onSelectHeight.invoke(46)
        );

        // Section 2: Patient Profile
        this.addSectionLabel(content, "SecProfile", "PATIENT PROFILE & MEDICATION");
        const row2 = this.createRow(content, "RowProfile", 54, 6.2);
        this.painAreaHandle = this.createBtn(
            row2,
            "Pain: Knee/Back",
            "Area: Knee 45cm",
            25.8,
            6.0,
            "Secondary",
            true,
            () => this.onTogglePainArea.invoke()
        );
        this.medsHandle = this.createBtn(
            row2,
            "Meds: Toggle",
            "Meds: None",
            25.8,
            6.0,
            "Secondary",
            true,
            () => this.onToggleMeds.invoke()
        );

        // Section 3: Morning Condition
        this.addSectionLabel(content, "SecMorning", "MORNING CONDITION (PAINFREE)");
        const row3 = this.createRow(content, "RowMorning", 54, 6.2);
        this.condBtns.good = this.createBtn(row3, "Good 90", "Good 90", 16.8, 6.0, "Secondary", true, () =>
            this.onSelectCondition.invoke("good")
        );
        this.condBtns.fair = this.createBtn(row3, "Fair 65", "Fair 65", 16.8, 6.0, "Secondary", true, () =>
            this.onSelectCondition.invoke("fair")
        );
        this.condBtns.poor = this.createBtn(row3, "Poor 35", "Poor 35", 16.8, 6.0, "Secondary", true, () =>
            this.onSelectCondition.invoke("poor")
        );

        const divSlot = this.createFlexBox(content, "ActionDividerSlot", 54, 0.7);
        const divObj = createChildSceneObjectWithParentLayer("ActionDivider", divSlot);
        divObj.getTransform().setLocalPosition(new vec3(0, 0, 0.2));
        this.createRoundedRectOn(divObj, 52, 0.45, 0.2, new vec4(0.38, 0.48, 0.64, 0.95));

        const row4 = this.createRow(content, "RowActions", 54, 6.2);
        this.createBtn(
            row4,
            "Sync PainFree App",
            "Sync App",
            20.5,
            6.0,
            "Primary",
            false,
            () => this.onSyncApp.invoke()
        );
        this.audioToggleHandle = this.createBtn(
            row4,
            "AudioToggle",
            "Sound: Off",
            16.5,
            6.0,
            "Secondary",
            true,
            () => this.onToggleAudio.invoke()
        );
        this.createBtn(row4, "Got It", "Got It", 13.8, 6.0, "Secondary", false, () =>
            this.onDismiss.invoke()
        );

        col.refreshChildren();
    }

    private buildPainLogPanel(parent: SceneObject) {
        this.logHost = createChildSceneObjectWithParentLayer("PainLogPanel", parent);
        const frame = this.logHost.createComponent(Frame.getTypeName()) as Frame;
        frame.innerSize = new vec2(62, 72);
        frame.allowScaling = false;

        const backdropObj = createChildSceneObjectWithParentLayer("LogBackdrop", this.logHost);
        backdropObj.getTransform().setLocalPosition(new vec3(0, 0, 0.25));
        this.createRoundedRectOn(
            backdropObj,
            60,
            70,
            2.6,
            new vec4(0.05, 0.08, 0.13, 0.9),
            true,
            0.16,
            new vec4(0.32, 0.42, 0.56, 0.65)
        );

        const content = createChildSceneObjectWithParentLayer("PainLogContent", this.logHost);
        content.getTransform().setLocalPosition(new vec3(0, 0, 0.9));

        const col = content.createComponent(FlexLayout.getTypeName()) as FlexLayout;
        col.direction = FlexDirection.Column;
        col.width = 54;
        col.height = 67;
        col.justifyContent = FlexJustify.SpaceBetween;
        col.alignItems = FlexAlign.Stretch;
        col.rowGap = 0.8;

        const topAccent = this.createFlexBox(content, "LogAccentSlot", 54, 1.0);
        this.logAccentBar = this.addRoundedRect(
            topAccent,
            "LogAccentRect",
            54,
            1.0,
            0.5,
            new vec4(0.32, 0.82, 1.0, 1.0)
        );

        const titleTxt = this.addTextRow(
            content,
            "LogPanelTitle",
            54,
            4.5,
            106,
            new vec4(0.99, 1.0, 1.0, 1.0),
            800
        );
        titleTxt.text = "PAIN LOG & PERSONALIZE";

        const persSlot = this.createFlexBox(content, "PersonalPillSlot", 54, 4.4);
        this.personalPillBg = this.addRoundedRect(
            persSlot,
            "PersonalPillBg",
            54,
            4.1,
            2.0,
            new vec4(0.1, 0.15, 0.24, 0.98),
            true,
            0.16,
            new vec4(0.36, 0.82, 1.0, 1.0)
        );
        this.personalStatusComp = this.createOverlayText(
            persSlot,
            "PersonalBaseStatus",
            74,
            new vec4(0.92, 0.98, 1.0, 1.0),
            0.3,
            800
        );

        this.addSectionLabel(content, "SecSituation", "SITUATION / CONTEXT");
        const ctxRow = this.createRow(content, "RowContext", 54, 6.2);
        this.ctxBtns.home = this.createBtn(ctxRow, "Ctx_Home", "Home", 16.8, 6.0, "Secondary", true, () =>
            this.onSelectContext.invoke("home")
        );
        this.ctxBtns.cafe = this.createBtn(ctxRow, "Ctx_Cafe", "Cafe", 16.8, 6.0, "Secondary", true, () =>
            this.onSelectContext.invoke("cafe")
        );
        this.ctxBtns.clinic = this.createBtn(ctxRow, "Ctx_Clinic", "Clinic", 16.8, 6.0, "Secondary", true, () =>
            this.onSelectContext.invoke("clinic")
        );

        this.addSectionLabel(content, "SecLogPain", "RECORD POST-ACTION PAIN");
        const painRow = this.createRow(content, "RowLogPain", 54, 6.2);
        this.createBtn(painRow, "Pain_None", "No Pain", 16.8, 6.0, "Secondary", false, () =>
            this.onRecordPain.invoke("none")
        );
        this.createBtn(painRow, "Pain_Mild", "Mild (+1cm)", 16.8, 6.0, "Secondary", false, () =>
            this.onRecordPain.invoke("mild")
        );
        this.createBtn(painRow, "Pain_Sharp", "Sharp (+2cm)", 16.8, 6.0, "Primary", false, () =>
            this.onRecordPain.invoke("sharp")
        );

        this.addSectionLabel(content, "SecRecent", "RECENT RECORDS");
        const logCardSlot = this.createFlexBox(content, "LogFeedSlot", 54, 16.8);
        this.addRoundedRect(
            logCardSlot,
            "LogFeedBg",
            54,
            16.4,
            1.6,
            new vec4(0.08, 0.11, 0.17, 0.98),
            true,
            0.16,
            new vec4(0.32, 0.44, 0.6, 1.0)
        );
        const yOffsets = [4.9, 0.0, -4.9];
        this.logRowTexts = [];
        for (let i = 0; i < 3; i++) {
            const rowObj = createChildSceneObjectWithParentLayer(`LogRow_${i}`, logCardSlot);
            rowObj.getTransform().setLocalPosition(new vec3(0, yOffsets[i], 0.3));
            const txt = rowObj.createComponent("Component.Text") as Text;
            this.applyCrispTextStyle(txt, 64, 800, new vec4(0.92, 0.96, 1.0, 1.0), 0.12);
            this.logRowTexts.push(txt);
        }

        const resetRow = this.createRow(content, "RowResetLog", 54, 6.2);
        this.createBtn(resetRow, "ResetPersonal", "Reset Personal Calibration", 54, 6.0, "Secondary", false, () =>
            this.onResetPersonal.invoke()
        );

        col.refreshChildren();
    }

    private applyCrispTextStyle(
        txt: Text,
        fontSize: number,
        weight: number,
        color: vec4,
        outlineSize: number = 0.12
    ) {
        txt.size = fontSize;
        txt.weight = weight;
        txt.horizontalAlignment = HorizontalAlignment.Center;
        txt.verticalAlignment = VerticalAlignment.Center;
        txt.textFill.color = color;
        if (outlineSize > 0 && txt.outlineSettings) {
            txt.outlineSettings.enabled = true;
            txt.outlineSettings.size = outlineSize;
            txt.outlineSettings.fill.color = new vec4(0.02, 0.04, 0.08, 0.92);
        }
    }

    private createFlexBox(parent: SceneObject, name: string, w: number, h: number): SceneObject {
        const obj = createChildSceneObjectWithParentLayer(name, parent);
        const item = obj.createComponent(FlexItem.getTypeName()) as FlexItem;
        item.overrideWidth = w;
        item.overrideHeight = h;
        item.flexShrink = 0;
        return obj;
    }

    private addRoundedRect(
        parent: SceneObject,
        name: string,
        w: number,
        h: number,
        radius: number,
        bgColor: vec4,
        hasBorder: boolean = false,
        borderSize: number = 0.15,
        borderColor?: vec4
    ): RoundedRectangle {
        const obj = createChildSceneObjectWithParentLayer(name, parent);
        return this.createRoundedRectOn(obj, w, h, radius, bgColor, hasBorder, borderSize, borderColor);
    }

    private createRoundedRectOn(
        obj: SceneObject,
        w: number,
        h: number,
        radius: number,
        bgColor: vec4,
        hasBorder: boolean = false,
        borderSize: number = 0.15,
        borderColor?: vec4
    ): RoundedRectangle {
        const rr = obj.createComponent(RoundedRectangle.getTypeName()) as RoundedRectangle;
        rr.size = new vec2(w, h);
        rr.cornerRadius = radius;
        rr.gradient = false;
        rr.backgroundColor = bgColor;
        rr.border = hasBorder;
        if (hasBorder) {
            rr.borderSize = borderSize;
            if (borderColor) {
                rr.borderColor = borderColor;
            }
        }
        return rr;
    }

    private createOverlayText(
        parent: SceneObject,
        name: string,
        fontSize: number,
        color: vec4,
        zOffset: number,
        weight: number = 700
    ): Text {
        const obj = createChildSceneObjectWithParentLayer(name, parent);
        obj.getTransform().setLocalPosition(new vec3(0, 0, zOffset));
        const txt = obj.createComponent("Component.Text") as Text;
        this.applyCrispTextStyle(txt, fontSize, weight, color, 0.12);
        return txt;
    }

    private addSectionLabel(parent: SceneObject, name: string, label: string): Text {
        const slot = this.createFlexBox(parent, `${name}Slot`, 54, 2.8);
        const txt = this.createOverlayText(slot, name, 64, new vec4(0.8, 0.92, 1.0, 1.0), 0.25, 700);
        txt.text = `— ${label} —`;
        return txt;
    }

    private addTextRow(
        parent: SceneObject,
        name: string,
        w: number,
        h: number,
        fontSize: number,
        color: vec4,
        weight: number = 700
    ): Text {
        const slot = this.createFlexBox(parent, `${name}Slot`, w, h);
        return this.createOverlayText(slot, name, fontSize, color, 0.3, weight);
    }

    private createRow(parent: SceneObject, name: string, w: number, h: number): SceneObject {
        const row = this.createFlexBox(parent, name, w, h);
        const layout = row.createComponent(FlexLayout.getTypeName()) as FlexLayout;
        layout.direction = FlexDirection.Row;
        layout.width = w;
        layout.height = h;
        layout.justifyContent = FlexJustify.SpaceBetween;
        layout.alignItems = FlexAlign.Center;
        layout.columnGap = 1.6;
        return row;
    }

    private createBtn(
        parent: SceneObject,
        keyName: string,
        displayLabel: string,
        w: number,
        h: number,
        style: "Primary" | "Secondary" | "Ghost" | "Prism",
        toggleable: boolean,
        onClick: () => void
    ): ButtonHandle {
        const obj = this.createFlexBox(parent, `Btn_${keyName}`, w, h);
        const btn = obj.createComponent(Button.getTypeName()) as Button;
        btn.setVariant({ theme: "System3", shape: "Capsule", style });
        if (toggleable) {
            btn.setIsToggleable(true);
        }
        btn.size = new vec3(w, h, 1);
        btn.initialize();
        const content = addContentToElement(obj, { text: displayLabel, textSize: 74 });
        content.onInitialized.add(() => {
            const tc = content.textComponent;
            if (tc) {
                tc.weight = 800;
            }
        });
        btn.onTriggerUp.add(onClick);
        return { btn, content };
    }
}
