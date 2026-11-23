import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario";
import { expect } from "Leaf.lspkg/Utils/common/Expect";
import { findSceneObjectByName, sleep } from "Leaf.lspkg/Utils/common/Utils";
import { DefaultLeafInteractor } from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor";
import { findInteractablesByName } from "Leaf.lspkg/Interactors/InteractableUtils";

@component
export class SeatSafePainLogScenario extends Scenario {
    async run(): Promise<void> {
        const interactor = new DefaultLeafInteractor();
        await sleep(800);

        // Start from clean calibration so personal +2cm assertion is deterministic
        const resetBtn = findInteractablesByName("Btn_ResetPersonal", undefined, true)[0];
        if (!resetBtn) throw new Error("Btn_ResetPersonal not found");
        await interactor.trigger(resetBtn);
        await sleep(250);

        const cafeBtn = findInteractablesByName("Btn_Ctx_Cafe", undefined, true)[0];
        if (!cafeBtn) throw new Error("Btn_Ctx_Cafe not found");
        await interactor.trigger(cafeBtn);
        await sleep(250);

        const sharpBtn = findInteractablesByName("Btn_Pain_Sharp", undefined, true)[0];
        if (!sharpBtn) throw new Error("Btn_Pain_Sharp not found");
        await interactor.trigger(sharpBtn);
        await sleep(450);

        const personalObj = findSceneObjectByName("PersonalBaseStatus");
        if (!personalObj) throw new Error("PersonalBaseStatus not found");
        const personalTxt = personalObj.getComponent("Component.Text") as Text | null;
        if (!personalTxt) throw new Error("PersonalBaseStatus Text not found");
        expect(personalTxt.text.includes("Personal +2cm")).toBe(true);

        const log0Obj = findSceneObjectByName("LogRow_0");
        if (!log0Obj) throw new Error("LogRow_0 not found");
        const log0Txt = log0Obj.getComponent("Component.Text") as Text | null;
        if (!log0Txt) throw new Error("LogRow_0 Text not found");
        expect(log0Txt.text.includes("Cafe")).toBe(true);
        expect(log0Txt.text.includes("Sharp")).toBe(true);

        // Restore clean baseline after test
        await interactor.trigger(resetBtn);
        await sleep(250);
    }
}
