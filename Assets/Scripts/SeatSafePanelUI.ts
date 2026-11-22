import Event from "InteractionKit.lspkg/Utils/Event";
import { Frame } from "UIKit.lspkg/Scripts/Components/Frame/Frame";
import { Button } from "UIKit.lspkg/Scripts/Components/Button/Button";
import { addContentToElement } from "UIKit.lspkg/Scripts/Components/Content/ElementContentFactory";
import { FlexLayout } from "UIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout";
import { FlexItem } from "UIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem";
import {
    FlexDirection,
    FlexJustify,
    FlexAlign
} from "UIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes";
import { createChildSceneObjectWithParentLayer } from "UIKit.lspkg/Scripts/Utility/SceneUtilities";
import { MorningCondition, SeatSafeResult, SeatSafeState } from "./SeatSafeEvaluation";

@component
export class SeatSafePanelUI extends BaseScriptComponent {
    @input
    cardAnchor!: SceneObject;

    @input
    controlAnchor!: SceneObject;

    public onSelectHeight: Event<number> = new Event<number>();
    public onTogglePainArea: Event<void> = new Event<void>();
    public onToggleMeds: Event<void> = new Event<void>();
    public onSelectCondition: Event<MorningCondition> = new Event<MorningCondition>();
    public onSyncApp: Event<void> = new Event<void>();
    public onDismiss: Event<void> = new Event<void>();

    private cardHost: SceneObject | null = null;
    private controlHost: SceneObject | null = null;

    private badgeTextComp: Text | null = null;
    private heightTextComp: Text | null = null;
    private contextTextComp: Text | null = null;
    private tipTextComp: Text | null = null;
    private syncStatusComp: Text | null = null;

    private painAreaBtn: Button | null = null;
    private medsBtn: Button | null = null;

    private built: boolean = false;

    onAwake() {
        this.ensureBuilt();
    }

    public ensureBuilt() {
        if (this.built) return;
        this.built = true;

        const cardParent = this.cardAnchor ? this.cardAnchor : this.getSceneObject();
        const ctrlParent = this.controlAnchor ? this.controlAnchor : this.getSceneObject();

        this.buildChairCard(cardParent);
        this.buildControlPanel(ctrlParent);
    }

    public setCardVisible(visible: boolean) {
        if (this.cardHost) {
            this.cardHost.enabled = visible;
        }
    }

    public updateView(state: SeatSafeState, result: SeatSafeResult) {
        this.ensureBuilt();

        if (this.badgeTextComp) {
            this.badgeTextComp.text = result.badgeText;
            if (result.riskLevel === "SAFE") {
                this.badgeTextComp.textFill.color = new vec4(0.3, 1.0, 0.55, 1.0);
            } else if (result.riskLevel === "CAUTION") {
                this.badgeTextComp.textFill.color = new vec4(1.0, 0.85, 0.25, 1.0);
            } else {
                this.badgeTextComp.textFill.color = new vec4(1.0, 0.35, 0.35, 1.0);
            }
        }
        if (this.heightTextComp) {
            this.heightTextComp.text = result.heightText;
        }
        if (this.contextTextComp) {
            this.contextTextComp.text = result.contextText;
        }
        if (this.tipTextComp) {
            this.tipTextComp.text = result.tipText;
        }
        if (this.syncStatusComp) {
            this.syncStatusComp.text = `Source: ${state.syncSource} | AM Score: ${state.morningScore}/100`;
        }
    }

    private buildChairCard(parent: SceneObject) {
        this.cardHost = createChildSceneObjectWithParentLayer("ChairWarningCard", parent);
        const frame = this.cardHost.createComponent(Frame.getTypeName()) as Frame;
        frame.innerSize = new vec2(62, 30);
        frame.allowScaling = false;

        const content = createChildSceneObjectWithParentLayer("CardContent", this.cardHost);
        content.getTransform().setLocalPosition(new vec3(0, 0, 0.15));

        const col = content.createComponent(FlexLayout.getTypeName()) as FlexLayout;
        col.direction = FlexDirection.Column;
        col.width = 58;
        col.height = 28;
        col.justifyContent = FlexJustify.Center;
        col.alignItems = FlexAlign.Stretch;
        col.rowGap = 1.0;

        this.badgeTextComp = this.addTextRow(content, "BadgeRow", 58, 7.0, 72, new vec4(1, 0.35, 0.35, 1));
        this.heightTextComp = this.addTextRow(content, "HeightRow", 58, 6.0, 52, new vec4(0.95, 0.97, 1, 1));
        this.contextTextComp = this.addTextRow(content, "ContextRow", 58, 5.5, 46, new vec4(0.82, 0.9, 1, 1));
        this.tipTextComp = this.addTextRow(content, "TipRow", 58, 6.0, 42, new vec4(1, 0.94, 0.72, 1));

        col.refreshChildren();
    }

    private buildControlPanel(parent: SceneObject) {
        this.controlHost = createChildSceneObjectWithParentLayer("ControlPanel", parent);
        const frame = this.controlHost.createComponent(Frame.getTypeName()) as Frame;
        frame.innerSize = new vec2(54, 46);
        frame.allowScaling = false;

        const content = createChildSceneObjectWithParentLayer("ControlContent", this.controlHost);
        content.getTransform().setLocalPosition(new vec3(0, 0, 0.15));

        const col = content.createComponent(FlexLayout.getTypeName()) as FlexLayout;
        col.direction = FlexDirection.Column;
        col.width = 50;
        col.height = 42;
        col.justifyContent = FlexJustify.Start;
        col.alignItems = FlexAlign.Stretch;
        col.rowGap = 1.5;

        this.addTextRow(content, "PanelTitle", 50, 5.5, 58, new vec4(0.95, 0.98, 1, 1)).text =
            "SeatSafe AR · Daily Check";
        this.syncStatusComp = this.addTextRow(
            content,
            "SyncStatus",
            50,
            4.5,
            42,
            new vec4(0.7, 0.9, 1, 1)
        );

        // Row 1: Chair Height
        const row1 = this.createRow(content, "RowHeight", 50, 6.5);
        this.createBtn(row1, "Low 30cm", 15, 5.5, "Secondary", () => this.onSelectHeight.invoke(30));
        this.createBtn(row1, "Mid 38cm", 15, 5.5, "Secondary", () => this.onSelectHeight.invoke(38));
        this.createBtn(row1, "Safe 46cm", 15, 5.5, "Primary", () => this.onSelectHeight.invoke(46));

        // Row 2: Patient Profile & Meds
        const row2 = this.createRow(content, "RowProfile", 50, 6.5);
        this.painAreaBtn = this.createBtn(row2, "Pain: Knee/Back", 23, 5.5, "Secondary", () =>
            this.onTogglePainArea.invoke()
        );
        this.medsBtn = this.createBtn(row2, "Meds: Toggle", 23, 5.5, "Secondary", () =>
            this.onToggleMeds.invoke()
        );

        // Row 3: Morning Condition Score
        const row3 = this.createRow(content, "RowMorning", 50, 6.5);
        this.createBtn(row3, "Good 90", 15, 5.5, "Secondary", () =>
            this.onSelectCondition.invoke("good")
        );
        this.createBtn(row3, "Fair 65", 15, 5.5, "Secondary", () =>
            this.onSelectCondition.invoke("fair")
        );
        this.createBtn(row3, "Poor 35", 15, 5.5, "Secondary", () =>
            this.onSelectCondition.invoke("poor")
        );

        // Row 4: PainFree App Sync & Dismiss
        const row4 = this.createRow(content, "RowActions", 50, 6.5);
        this.createBtn(row4, "Sync PainFree App", 26, 5.5, "Primary", () => this.onSyncApp.invoke());
        this.createBtn(row4, "Got It", 20, 5.5, "Ghost", () => this.onDismiss.invoke());

        col.refreshChildren();
    }

    private addTextRow(
        parent: SceneObject,
        name: string,
        w: number,
        h: number,
        fontSize: number,
        color: vec4
    ): Text {
        const obj = createChildSceneObjectWithParentLayer(name, parent);
        const item = obj.createComponent(FlexItem.getTypeName()) as FlexItem;
        item.overrideWidth = w;
        item.overrideHeight = h;
        item.flexShrink = 0;

        const txt = obj.createComponent("Component.Text") as Text;
        txt.size = fontSize;
        txt.horizontalAlignment = HorizontalAlignment.Center;
        txt.verticalAlignment = VerticalAlignment.Center;
        txt.textFill.color = color;
        return txt;
    }

    private createRow(parent: SceneObject, name: string, w: number, h: number): SceneObject {
        const row = createChildSceneObjectWithParentLayer(name, parent);
        const item = row.createComponent(FlexItem.getTypeName()) as FlexItem;
        item.overrideWidth = w;
        item.overrideHeight = h;
        item.flexShrink = 0;

        const layout = row.createComponent(FlexLayout.getTypeName()) as FlexLayout;
        layout.direction = FlexDirection.Row;
        layout.width = w;
        layout.height = h;
        layout.justifyContent = FlexJustify.SpaceBetween;
        layout.alignItems = FlexAlign.Center;
        layout.columnGap = 1.5;
        return row;
    }

    private createBtn(
        parent: SceneObject,
        label: string,
        w: number,
        h: number,
        style: "Primary" | "Secondary" | "Ghost",
        onClick: () => void
    ): Button {
        const obj = createChildSceneObjectWithParentLayer(`Btn_${label}`, parent);
        const item = obj.createComponent(FlexItem.getTypeName()) as FlexItem;
        item.overrideWidth = w;
        item.overrideHeight = h;
        item.flexShrink = 0;

        const btn = obj.createComponent(Button.getTypeName()) as Button;
        btn.setVariant({ theme: "System3", shape: "Rectangle", style });
        btn.size = new vec3(w, h, 1);
        btn.initialize();
        addContentToElement(obj, { text: label });
        btn.onTriggerUp.add(onClick);
        return btn;
    }
}
