import { RiskLevel, SpatialMode } from "./SeatSafeEvaluation";

@component
export class SeatSafeChairVisual extends BaseScriptComponent {
    @input
    baseMaterial!: Material;

    // Chair geometry group
    private chairRoot: SceneObject | null = null;
    private seatObj: SceneObject | null = null;
    private seatCushionObj: SceneObject | null = null;
    private backObj: SceneObject | null = null;
    private backPadObj: SceneObject | null = null;
    private legObjs: SceneObject[] = [];
    private floorRingObj: SceneObject | null = null;
    private ringObj: SceneObject | null = null;
    private thresholdBarObj: SceneObject | null = null;
    private gapPillarL: SceneObject | null = null;
    private gapPillarR: SceneObject | null = null;

    // Stairs (StepSafe) geometry group
    private stairsRoot: SceneObject | null = null;
    private stepBodyObjs: SceneObject[] = [];
    private stepTreadObjs: SceneObject[] = [];
    private stepEdgeObjs: SceneObject[] = [];
    private handrailPostFront: SceneObject | null = null;
    private handrailPostBack: SceneObject | null = null;
    private handrailBar: SceneObject | null = null;

    private frameMat: Material | null = null;
    private cushionMat: Material | null = null;
    private floorRingMat: Material | null = null;
    private ringMat: Material | null = null;
    private thresholdMat: Material | null = null;
    private gapMat: Material | null = null;
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

        this.frameMat = this.baseMaterial.clone();
        this.frameMat.mainPass.baseColor = new vec4(0.24, 0.29, 0.38, 1.0);

        this.cushionMat = this.baseMaterial.clone();
        this.cushionMat.mainPass.baseColor = new vec4(0.68, 0.74, 0.82, 1.0);

        this.floorRingMat = this.baseMaterial.clone();
        this.floorRingMat.mainPass.baseColor = new vec4(0.32, 0.56, 0.72, 0.65);

        this.ringMat = this.baseMaterial.clone();
        this.ringMat.mainPass.baseColor = new vec4(1.0, 0.28, 0.3, 0.95);

        this.thresholdMat = this.baseMaterial.clone();
        this.thresholdMat.mainPass.baseColor = new vec4(0.25, 0.92, 1.0, 0.95);

        this.gapMat = this.baseMaterial.clone();
        this.gapMat.mainPass.baseColor = new vec4(1.0, 0.45, 0.25, 0.85);

        const boxMesh = this.buildBoxMesh();

        // ─── 1. CHAIR GEOMETRY ───────────────────────────────────────────────
        this.chairRoot = global.scene.createSceneObject("ChairGeometry");
        this.chairRoot.setParent(parent);

        this.seatObj = this.createMeshNode("Seat", this.chairRoot, boxMesh, this.frameMat);
        this.seatObj.getTransform().setLocalScale(new vec3(48, 4.0, 48));

        this.seatCushionObj = this.createMeshNode(
            "SeatCushion",
            this.chairRoot,
            boxMesh,
            this.cushionMat
        );
        this.seatCushionObj.getTransform().setLocalScale(new vec3(45, 2.2, 45));

        this.backObj = this.createMeshNode("Backrest", this.chairRoot, boxMesh, this.frameMat);
        this.backObj.getTransform().setLocalScale(new vec3(48, 40, 4.0));

        this.backPadObj = this.createMeshNode("BackPad", this.chairRoot, boxMesh, this.cushionMat);
        this.backPadObj.getTransform().setLocalScale(new vec3(43, 34, 2.2));

        for (let i = 0; i < 4; i++) {
            const leg = this.createMeshNode(`Leg_${i}`, this.chairRoot, boxMesh, this.frameMat);
            this.legObjs.push(leg);
        }

        const floorRingMesh = this.buildRingMesh(31, 33, 0.6);
        this.floorRingObj = this.createMeshNode(
            "FloorAnchorRing",
            this.chairRoot,
            floorRingMesh,
            this.floorRingMat
        );
        this.floorRingObj.getTransform().setLocalPosition(new vec3(0, 0.8, 0));

        const ringMesh = this.buildRingMesh(26, 30.5, 1.8);
        this.ringObj = this.createMeshNode("SafetyRing", this.chairRoot, ringMesh, this.ringMat);

        this.thresholdBarObj = this.createMeshNode(
            "SafeThresholdBar",
            this.chairRoot,
            boxMesh,
            this.thresholdMat
        );
        this.thresholdBarObj.getTransform().setLocalScale(new vec3(58, 1.8, 2.2));

        this.gapPillarL = this.createMeshNode("HeightGapLeft", this.chairRoot, boxMesh, this.gapMat);
        this.gapPillarR = this.createMeshNode("HeightGapRight", this.chairRoot, boxMesh, this.gapMat);

        // ─── 2. STAIRS GEOMETRY (StepSafe) ───────────────────────────────────
        this.stairsRoot = global.scene.createSceneObject("StairsGeometry");
        this.stairsRoot.setParent(parent);

        for (let i = 0; i < 3; i++) {
            const body = this.createMeshNode(`StepBody_${i}`, this.stairsRoot, boxMesh, this.frameMat);
            const tread = this.createMeshNode(`StepTread_${i}`, this.stairsRoot, boxMesh, this.cushionMat);
            const edge = this.createMeshNode(`StepEdge_${i}`, this.stairsRoot, boxMesh, this.ringMat);
            this.stepBodyObjs.push(body);
            this.stepTreadObjs.push(tread);
            this.stepEdgeObjs.push(edge);
        }

        // Cyan AR handrail guide on the right side of the steps
        this.handrailPostFront = this.createMeshNode(
            "HandrailPostFront",
            this.stairsRoot,
            boxMesh,
            this.thresholdMat
        );
        this.handrailPostBack = this.createMeshNode(
            "HandrailPostBack",
            this.stairsRoot,
            boxMesh,
            this.thresholdMat
        );
        this.handrailBar = this.createMeshNode(
            "HandrailBar",
            this.stairsRoot,
            boxMesh,
            this.thresholdMat
        );

        this.stairsRoot.enabled = false;
        this.updateVisual("chair", 30, 45, "HIGH_RISK", true);
    }

    public updateVisual(
        mode: SpatialMode,
        measureCm: number,
        safeThresholdCm: number,
        riskLevel: RiskLevel,
        overlayVisible: boolean
    ) {
        this.ensureBuilt();

        const statusColor =
            riskLevel === "SAFE"
                ? new vec4(0.18, 0.92, 0.52, 0.96)
                : riskLevel === "CAUTION"
                  ? new vec4(1.0, 0.78, 0.16, 0.96)
                  : new vec4(1.0, 0.25, 0.28, 0.96);

        if (this.ringMat) {
            this.ringMat.mainPass.baseColor = statusColor;
        }
        if (this.gapMat) {
            this.gapMat.mainPass.baseColor = statusColor;
        }
        if (this.thresholdMat) {
            this.thresholdMat.mainPass.baseColor =
                riskLevel === "SAFE"
                    ? new vec4(0.24, 0.95, 0.62, 0.95)
                    : new vec4(0.24, 0.92, 1.0, 0.95);
        }

        if (this.chairRoot) {
            this.chairRoot.enabled = mode === "chair";
        }
        if (this.stairsRoot) {
            this.stairsRoot.enabled = mode === "stairs";
        }

        if (mode === "stairs") {
            this.updateStairsLayout(measureCm, overlayVisible);
            return;
        }

        // Chair layout update
        const seatY = measureCm;
        if (this.seatObj) {
            this.seatObj.getTransform().setLocalPosition(new vec3(0, seatY - 3.2, 0));
        }
        if (this.seatCushionObj) {
            this.seatCushionObj.getTransform().setLocalPosition(new vec3(0, seatY - 0.8, 0));
        }
        if (this.backObj) {
            this.backObj.getTransform().setLocalPosition(new vec3(0, seatY + 20, -22));
        }
        if (this.backPadObj) {
            this.backPadObj.getTransform().setLocalPosition(new vec3(0, seatY + 20.5, -19.2));
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
            tf.setLocalScale(new vec3(3.8, legH, 3.8));
            tf.setLocalPosition(new vec3(lx, legH * 0.5, lz));
        }

        if (this.ringObj) {
            this.ringObj.enabled = overlayVisible;
            this.ringObj.getTransform().setLocalPosition(new vec3(0, seatY + 4.2, 0));
        }

        if (this.thresholdBarObj) {
            this.thresholdBarObj.enabled = overlayVisible;
            this.thresholdBarObj.getTransform().setLocalPosition(new vec3(0, safeThresholdCm, 26));
        }

        const gap = Math.max(0, safeThresholdCm - seatY);
        const showGap = overlayVisible && gap >= 2;
        if (this.gapPillarL && this.gapPillarR) {
            this.gapPillarL.enabled = showGap;
            this.gapPillarR.enabled = showGap;
            if (showGap) {
                const midY = seatY + gap * 0.5;
                this.gapPillarL.getTransform().setLocalScale(new vec3(1.8, gap, 1.8));
                this.gapPillarL.getTransform().setLocalPosition(new vec3(-26, midY, 26));
                this.gapPillarR.getTransform().setLocalScale(new vec3(1.8, gap, 1.8));
                this.gapPillarR.getTransform().setLocalPosition(new vec3(26, midY, 26));
            }
        }
    }

    private updateStairsLayout(stepRiseCm: number, overlayVisible: boolean) {
        const width = 66;
        const depth = 24;
        const startZ = 24;

        for (let i = 0; i < 3; i++) {
            const topY = stepRiseCm * (i + 1);
            const zCenter = startZ - i * depth;

            const body = this.stepBodyObjs[i];
            body.getTransform().setLocalScale(new vec3(width, topY - 1.5, depth));
            body.getTransform().setLocalPosition(new vec3(0, (topY - 1.5) * 0.5, zCenter));

            const tread = this.stepTreadObjs[i];
            tread.getTransform().setLocalScale(new vec3(width + 1, 2.0, depth + 1));
            tread.getTransform().setLocalPosition(new vec3(0, topY - 0.8, zCenter));

            const edge = this.stepEdgeObjs[i];
            edge.enabled = overlayVisible;
            edge.getTransform().setLocalScale(new vec3(width + 2.5, 2.2, 2.4));
            edge.getTransform().setLocalPosition(new vec3(0, topY + 0.3, zCenter + depth * 0.5));
        }

        // Handrail on right side (x = +35)
        const railX = 35;
        const frontBaseY = stepRiseCm;
        const backBaseY = stepRiseCm * 3;
        const postH = 42;
        const frontZ = startZ;
        const backZ = startZ - 2 * depth;

        if (this.handrailPostFront && this.handrailPostBack && this.handrailBar) {
            this.handrailPostFront.enabled = overlayVisible;
            this.handrailPostBack.enabled = overlayVisible;
            this.handrailBar.enabled = overlayVisible;

            this.handrailPostFront.getTransform().setLocalScale(new vec3(2.4, postH, 2.4));
            this.handrailPostFront
                .getTransform()
                .setLocalPosition(new vec3(railX, frontBaseY + postH * 0.5, frontZ));

            this.handrailPostBack.getTransform().setLocalScale(new vec3(2.4, postH, 2.4));
            this.handrailPostBack
                .getTransform()
                .setLocalPosition(new vec3(railX, backBaseY + postH * 0.5, backZ));

            const dy = backBaseY - frontBaseY;
            const dz = frontZ - backZ;
            const barLen = Math.sqrt(dy * dy + dz * dz) + 8;
            const slopeRad = Math.atan2(dy, dz);

            this.handrailBar.getTransform().setLocalScale(new vec3(3.0, 3.0, barLen));
            this.handrailBar
                .getTransform()
                .setLocalPosition(
                    new vec3(railX, (frontBaseY + backBaseY) * 0.5 + postH, (frontZ + backZ) * 0.5)
                );
            this.handrailBar.getTransform().setLocalRotation(quat.fromEulerAngles(slopeRad, 0, 0));
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
            { name: "normal", components: 3 },
            { name: "texture0", components: 2 }
        ]);
        builder.topology = MeshTopology.Triangles;
        builder.indexType = MeshIndexType.UInt16;

        const h = 0.5;
        const uvs: Array<[number, number]> = [[0, 0], [1, 0], [1, 1], [0, 1]];
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
            for (let k = 0; k < face.v.length; k++) {
                const p = face.v[k];
                const uv = uvs[k];
                builder.appendVerticesInterleaved([
                    p[0], p[1], p[2],
                    face.n[0], face.n[1], face.n[2],
                    uv[0], uv[1]
                ]);
            }
            builder.appendIndices([base, base + 1, base + 2, base, base + 2, base + 3]);
        }

        builder.updateMesh();
        return builder.getMesh();
    }

    private buildRingMesh(innerR: number, outerR: number, halfH: number): RenderMesh {
        const builder = new MeshBuilder([
            { name: "position", components: 3 },
            { name: "normal", components: 3 },
            { name: "texture0", components: 2 }
        ]);
        builder.topology = MeshTopology.Triangles;
        builder.indexType = MeshIndexType.UInt16;

        const segs = 36;
        for (let i = 0; i <= segs; i++) {
            const u = i / segs;
            const a = u * Math.PI * 2;
            const ca = Math.cos(a);
            const sa = Math.sin(a);
            // Distinct V coordinates across all 4 ring edges so every face has non-zero UV area
            // 0: top-inner, 1: top-outer, 2: bottom-outer, 3: bottom-inner
            builder.appendVerticesInterleaved([innerR * ca, halfH, innerR * sa, 0, 1, 0, u, 0.0]);
            builder.appendVerticesInterleaved([outerR * ca, halfH, outerR * sa, 0, 1, 0, u, 0.33]);
            builder.appendVerticesInterleaved([outerR * ca, -halfH, outerR * sa, ca, 0, sa, u, 0.67]);
            builder.appendVerticesInterleaved([innerR * ca, -halfH, innerR * sa, -ca, 0, -sa, u, 1.0]);
        }

        for (let i = 0; i < segs; i++) {
            const b = i * 4;
            const n = (i + 1) * 4;
            // Top surface (+Y outward CCW winding)
            builder.appendIndices([b, n + 1, b + 1, b, n, n + 1]);
            // Outer vertical rim (visible from outside)
            builder.appendIndices([b + 1, n + 2, b + 2, b + 1, n + 1, n + 2]);
            // Inner vertical rim (visible from inside)
            builder.appendIndices([b, b + 3, n + 3, b, n + 3, n]);
            // Bottom surface (-Y outward)
            builder.appendIndices([b + 3, b + 2, n + 2, b + 3, n + 2, n + 3]);
        }

        builder.updateMesh();
        return builder.getMesh();
    }
}
