import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario";
import { expect } from "Leaf.lspkg/Utils/common/Expect";
import { findSceneObjectByName, sleep } from "Leaf.lspkg/Utils/common/Utils";

@component
export class SeatSafeProximityScenario extends Scenario {
    async run(): Promise<void> {
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
