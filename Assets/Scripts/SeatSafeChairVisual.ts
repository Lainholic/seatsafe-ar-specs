import { RiskLevel } from "./SeatSafeEvaluation";

@component
export class SeatSafeChairVisual extends BaseScriptComponent {
    @input
    baseMaterial!: Material;
    private chairRoot: SceneObject | null = null;
    private seatObj: SceneObject | null = null;
    private backObj: SceneObject | null = null;
    private legObjs: SceneObject[] = [];
    private ringObj: SceneObject | null = null;
    private thresholdBarObj: SceneObject | null = null;

    private chairMat: Material | null = null;
    private ringMat: Material | null = null;
    private thresholdMat: Material | null = null;
    private built: boolean = false;

    onAwake() {
        this.ensureBuilt();
    }

    private ensureBuilt() {
        if (this.built) return;
        this.built = true;

        if (!this.baseMaterial) {
            print("SeatSafeChairVisual: baseMaterial @input not wired.");
            return;
        }

        const parent = this.getSceneObject();
        this.chairRoot = global.scene.createSceneObject("ChairGeometry");
        this.chairRoot.setParent(parent);

        this.chairMat = this.baseMaterial.clone();
        this.chairMat.mainPass.baseColor = new vec4(0.32, 0.36, 0.44, 1.0);

        this.ringMat = this.baseMaterial.clone();
        this.ringMat.mainPass.baseColor = new vec4(1.0, 0.25, 0.25, 0.9);

        this.thresholdMat = this.baseMaterial.clone();
        this.thresholdMat.mainPass.baseColor = new vec4(0.3, 0.9, 1.0, 0.75);

        const boxMesh = this.buildBoxMesh();

        // Seat (width 48, thickness 5, depth 48)
        this.seatObj = this.createMeshNode("Seat", this.chairRoot, boxMesh, this.chairMat);
        this.seatObj.getTransform().setLocalScale(new vec3(48, 5, 48));

        // Backrest (width 48, height 40, thickness 5)
        this.backObj = this.createMeshNode("Backrest", this.chairRoot, boxMesh, this.chairMat);
        this.backObj.getTransform().setLocalScale(new vec3(48, 40, 5));

        // 4 Legs (4 x H x 4)
        for (let i = 0; i < 4; i++) {
            const leg = this.createMeshNode(`Leg_${i}`, this.chairRoot, boxMesh, this.chairMat);
            this.legObjs.push(leg);
        }

        // Safety ring floating above seat (56 x 1.5 x 56 hollow ring)
        const ringMesh = this.buildRingMesh(26, 30);
        this.ringObj = this.createMeshNode("SafetyRing", this.chairRoot, ringMesh, this.ringMat);

        // Safe threshold bar (shows target safe height in front of chair)
        this.thresholdBarObj = this.createMeshNode(
            "SafeThresholdBar",
            this.chairRoot,
            boxMesh,
            this.thresholdMat
        );
        this.thresholdBarObj.getTransform().setLocalScale(new vec3(56, 1.5, 2));

        this.updateVisual(30, 45, "HIGH_RISK", true);
    }

    public updateVisual(
        chairHeightCm: number,
        safeThresholdCm: number,
        riskLevel: RiskLevel,
        overlayVisible: boolean
    ) {
        this.ensureBuilt();

        const seatY = chairHeightCm;
        if (this.seatObj) {
            this.seatObj.getTransform().setLocalPosition(new vec3(0, seatY - 2.5, 0));
        }
        if (this.backObj) {
            this.backObj.getTransform().setLocalPosition(new vec3(0, seatY + 20, -21.5));
        }

        const legOffsets = [
            [-20, -20],
            [20, -20],
            [-20, 20],
            [20, 20]
        ];
        const legH = Math.max(5, seatY - 5);
        for (let i = 0; i < this.legObjs.length; i++) {
            const [lx, lz] = legOffsets[i];
            const tf = this.legObjs[i].getTransform();
            tf.setLocalScale(new vec3(4, legH, 4));
            tf.setLocalPosition(new vec3(lx, legH * 0.5, lz));
        }

        if (this.ringObj) {
            this.ringObj.enabled = overlayVisible;
            this.ringObj.getTransform().setLocalPosition(new vec3(0, seatY + 4, 0));
        }

        if (this.thresholdBarObj) {
            this.thresholdBarObj.enabled = overlayVisible;
            this.thresholdBarObj.getTransform().setLocalPosition(new vec3(0, safeThresholdCm, 26));
        }

        if (this.ringMat) {
            if (riskLevel === "SAFE") {
                this.ringMat.mainPass.baseColor = new vec4(0.18, 0.92, 0.45, 0.95);
            } else if (riskLevel === "CAUTION") {
                this.ringMat.mainPass.baseColor = new vec4(1.0, 0.78, 0.15, 0.95);
            } else {
                this.ringMat.mainPass.baseColor = new vec4(1.0, 0.22, 0.22, 0.95);
            }
        }
    }

    private createMeshNode(
        name: string,
        parent: SceneObject,
        mesh: RenderMesh,
        mat: Material
    ): SceneObject {
        const obj = global.scene.createSceneObject(name);
        obj.setParent(parent);
        const rmv = obj.createComponent("Component.RenderMeshVisual") as RenderMeshVisual;
        rmv.mesh = mesh;
        rmv.mainMaterial = mat;
        return obj;
    }

    private buildBoxMesh(): RenderMesh {
        const builder = new MeshBuilder([
            { name: "position", components: 3 },
            { name: "normal", components: 3 }
        ]);
        builder.topology = MeshTopology.Triangles;
        builder.indexType = MeshIndexType.UInt16;

        const h = 0.5;
        const faces: Array<{ n: [number, number, number]; v: Array<[number, number, number]> }> = [
            { n: [0, 0, 1], v: [[-h, -h, h], [h, -h, h], [h, h, h], [-h, h, h]] },
            { n: [0, 0, -1], v: [[h, -h, -h], [-h, -h, -h], [-h, h, -h], [h, h, -h]] },
            { n: [0, 1, 0], v: [[-h, h, h], [h, h, h], [h, h, -h], [-h, h, -h]] },
            { n: [0, -1, 0], v: [[-h, -h, -h], [h, -h, -h], [h, -h, h], [-h, -h, h]] },
            { n: [1, 0, 0], v: [[h, -h, h], [h, -h, -h], [h, h, -h], [h, h, h]] },
            { n: [-1, 0, 0], v: [[-h, -h, -h], [-h, -h, h], [-h, h, h], [-h, h, -h]] }
        ];

        for (let f = 0; f < faces.length; f++) {
            const face = faces[f];
            const base = f * 4;
            for (const p of face.v) {
                builder.appendVerticesInterleaved([p[0], p[1], p[2], face.n[0], face.n[1], face.n[2]]);
            }
            builder.appendIndices([base, base + 1, base + 2, base, base + 2, base + 3]);
        }

        builder.updateMesh();
        return builder.getMesh();
    }

    private buildRingMesh(innerR: number, outerR: number): RenderMesh {
        const builder = new MeshBuilder([
            { name: "position", components: 3 },
            { name: "normal", components: 3 }
        ]);
        builder.topology = MeshTopology.Triangles;
        builder.indexType = MeshIndexType.UInt16;

        const segs = 32;
        const halfH = 1.6;
        for (let i = 0; i <= segs; i++) {
            const a = (i / segs) * Math.PI * 2;
            const ca = Math.cos(a);
            const sa = Math.sin(a);
            builder.appendVerticesInterleaved([innerR * ca, halfH, innerR * sa, 0, 1, 0]);
            builder.appendVerticesInterleaved([outerR * ca, halfH, outerR * sa, 0, 1, 0]);
            builder.appendVerticesInterleaved([outerR * ca, -halfH, outerR * sa, ca, 0, sa]);
        }

        for (let i = 0; i < segs; i++) {
            const b = i * 3;
            const n = (i + 1) * 3;
            // Top ring surface
            builder.appendIndices([b, b + 1, n + 1, b, n + 1, n]);
            // Outer vertical rim (visible from front/side)
            builder.appendIndices([b + 1, b + 2, n + 2, b + 1, n + 2, n + 1]);
            builder.appendIndices([b + 1, n + 2, b + 2, b + 1, n + 1, n + 2]);
        }

        builder.updateMesh();
        return builder.getMesh();
    }
}
