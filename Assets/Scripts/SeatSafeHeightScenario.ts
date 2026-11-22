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

        const safeBtn = findInteractablesByName("Btn_Safe 46cm", undefined, true)[0];
        if (!safeBtn) throw new Error("Btn_Safe 46cm not found");
        await interactor.trigger(safeBtn);
        await sleep(300);

        const badgeObj = findSceneObjectByName("BadgeRow");
        const badgeTxt = badgeObj.getComponent("Component.Text") as Text;
        expect(badgeTxt.text.includes("SAFE")).toBe(true);

        const lowBtn = findInteractablesByName("Btn_Low 30cm", undefined, true)[0];
        if (!lowBtn) throw new Error("Btn_Low 30cm not found");
        await interactor.trigger(lowBtn);
        await sleep(300);

        expect(badgeTxt.text.includes("HIGH RISK")).toBe(true);
    }
}
