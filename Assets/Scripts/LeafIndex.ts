import { scenariosIndex } from "Leaf.lspkg/Scenarios/decorator/ScenarioIndexDecorator";
import { ScenarioMetadata } from "Leaf.lspkg/Scenarios/scenario/ScenarioMetadata";
import { SeatSafeProximityScenario } from "./SeatSafeLeafScenarios";
import { SeatSafeHeightScenario } from "./SeatSafeHeightScenario";
import { SeatSafePatientContextScenario } from "./SeatSafeContextScenario";
import { SeatSafeDismissScenario } from "./SeatSafeDismissScenario";
import { SeatSafePainLogScenario } from "./SeatSafePainLogScenario";

@component
export class LeafIndex extends BaseScriptComponent {
    @scenariosIndex
    static scenariosIndex: ScenarioMetadata[] = [
        { id: "seatsafe-proximity", typename: SeatSafeProximityScenario.getTypeName() },
        { id: "seatsafe-height", typename: SeatSafeHeightScenario.getTypeName() },
        { id: "seatsafe-context", typename: SeatSafePatientContextScenario.getTypeName() },
        { id: "seatsafe-dismiss", typename: SeatSafeDismissScenario.getTypeName() },
        { id: "seatsafe-painlog", typename: SeatSafePainLogScenario.getTypeName() }
    ];
}
