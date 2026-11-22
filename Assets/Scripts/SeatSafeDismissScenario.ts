import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario";
import { expect } from "Leaf.lspkg/Utils/common/Expect";
import { findSceneObjectByName, sleep } from "Leaf.lspkg/Utils/common/Utils";
import { DefaultLeafInteractor } from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor";
import { findInteractablesByName } from "Leaf.lspkg/Interactors/InteractableUtils";

@component
export class SeatSafeDismissScenario extends Scenario {
    async run(): Promise<void> {
        const interactor = new DefaultLeafInteractor();
        await sleep(800);

        const card = findSceneObjectByName("ChairWarningCard");
        expect(card.enabled).toBe(true);

        const btn = findInteractablesByName("Btn_Got It", undefined, true)[0];
        if (!btn) throw new Error("Btn_Got It not found");
        await interactor.trigger(btn);
        await sleep(300);

        expect(card.enabled).toBe(false);
    }
}
