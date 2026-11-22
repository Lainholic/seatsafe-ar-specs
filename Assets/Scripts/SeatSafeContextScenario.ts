import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario";
import { expect } from "Leaf.lspkg/Utils/common/Expect";
import { findSceneObjectByName, sleep } from "Leaf.lspkg/Utils/common/Utils";
import { DefaultLeafInteractor } from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor";
import { findInteractablesByName } from "Leaf.lspkg/Interactors/InteractableUtils";

@component
export class SeatSafePatientContextScenario extends Scenario {
    async run(): Promise<void> {
        const interactor = new DefaultLeafInteractor();
        await sleep(800);

        for (const name of ["Btn_Pain: Knee/Back", "Btn_Meds: Toggle", "Btn_Good 90"]) {
            const btn = findInteractablesByName(name, undefined, true)[0];
            if (!btn) throw new Error(`${name} not found`);
            await interactor.trigger(btn);
            await sleep(250);
        }

        const ctxObj = findSceneObjectByName("ContextRow");
        const ctxTxt = ctxObj.getComponent("Component.Text") as Text;
        expect(ctxTxt.text.includes("Back Pain")).toBe(true);
        expect(ctxTxt.text.includes("Meds: Taken")).toBe(true);
        expect(ctxTxt.text.includes("90/100")).toBe(true);
    }
}
