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
        const chair = findSceneObjectByName("SeatSafeChair");
        const cam = findSceneObjectByName("Camera Object");
        if (!card) throw new Error("ChairWarningCard not found");
        if (!chair) throw new Error("SeatSafeChair not found");
        if (!cam) throw new Error("Camera Object not found");

        const chairPos = chair.getTransform().getWorldPosition();
        const devTracking = cam.getComponent("Component.DeviceTracking") as DeviceTracking | null;
        const origPos = cam.getTransform().getWorldPosition();

        if (devTracking) {
            devTracking.enabled = false;
        }
        try {
            cam.getTransform().setWorldPosition(new vec3(chairPos.x, 0, chairPos.z + 120));
            await sleep(350);
            expect(card.enabled).toBe(true);

            const btn = findInteractablesByName("Btn_Got It", undefined, true)[0];
            if (!btn) throw new Error("Btn_Got It not found");
            await interactor.trigger(btn);
            await sleep(300);
            expect(card.enabled).toBe(false);

            // Retreat beyond 2.5m and return within 2.0m -> card must re-reveal
            cam.getTransform().setWorldPosition(new vec3(chairPos.x, 0, chairPos.z + 300));
            await sleep(350);
            expect(card.enabled).toBe(false);

            cam.getTransform().setWorldPosition(new vec3(chairPos.x, 0, chairPos.z + 120));
            await sleep(350);
            expect(card.enabled).toBe(true);
        } finally {
            cam.getTransform().setWorldPosition(origPos);
            if (devTracking) {
                devTracking.enabled = true;
            }
        }
    }
}
