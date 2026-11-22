import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario";
import { expect } from "Leaf.lspkg/Utils/common/Expect";
import { findSceneObjectByName, sleep } from "Leaf.lspkg/Utils/common/Utils";

@component
export class SeatSafeProximityScenario extends Scenario {
    async run(): Promise<void> {
        await sleep(800);
        const card = findSceneObjectByName("ChairWarningCard");
        expect(card).toBeTruthy();
        expect(card.enabled).toBe(true);

        const cam = findSceneObjectByName("Camera Object");
        expect(cam).toBeTruthy();
        const origPos = cam.getTransform().getWorldPosition();

        cam.getTransform().setWorldPosition(new vec3(0, 0, 150));
        await sleep(350);
        expect(card.enabled).toBe(false);

        cam.getTransform().setWorldPosition(origPos);
        await sleep(350);
        expect(card.enabled).toBe(true);
    }
}
