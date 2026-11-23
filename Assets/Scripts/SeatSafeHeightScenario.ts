import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario";
import { expect } from "Leaf.lspkg/Utils/common/Expect";
import { findSceneObjectByName, sleep } from "Leaf.lspkg/Utils/common/Utils";
import { DefaultLeafInteractor } from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor";
import { findInteractablesByName } from "Leaf.lspkg/Interactors/InteractableUtils";

@component
export class SeatSafeHeightScenario extends Scenario {
    async run(): Promise<void> {
        const interactor = new DefaultLeafInteractor();
        await sleep(800);

        // Reset personal calibration so saved +2cm offsets do not distort baseline 46cm->SAFE test
        const resetBtn = findInteractablesByName("Btn_ResetPersonal", undefined, true)[0];
        if (!resetBtn) throw new Error("Btn_ResetPersonal not found");
        await interactor.trigger(resetBtn);
        await sleep(250);

        const safeBtn = findInteractablesByName("Btn_Safe 46cm", undefined, true)[0];
        if (!safeBtn) throw new Error("Btn_Safe 46cm not found");
        await interactor.trigger(safeBtn);
        await sleep(300);

        const badgeObj = findSceneObjectByName("BadgeRow");
        if (!badgeObj) throw new Error("BadgeRow not found");
        const badgeTxt = badgeObj.getComponent("Component.Text") as Text | null;
        if (!badgeTxt) throw new Error("BadgeRow Text component not found");
        expect(badgeTxt.text.includes("SAFE")).toBe(true);

        const midBtn = findInteractablesByName("Btn_Mid 38cm", undefined, true)[0];
        if (!midBtn) throw new Error("Btn_Mid 38cm not found");
        await interactor.trigger(midBtn);
        await sleep(300);
        expect(badgeTxt.text.includes("CAUTION")).toBe(true);

        const lowBtn = findInteractablesByName("Btn_Low 30cm", undefined, true)[0];
        if (!lowBtn) throw new Error("Btn_Low 30cm not found");
        await interactor.trigger(lowBtn);
        await sleep(300);

        expect(badgeTxt.text.includes("HIGH RISK")).toBe(true);
    }
}
