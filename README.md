# SeatSafe AR (PainFree Mobility Guardian)

> **Learn AR with SPECS — Round 2 Submission**
> Proactive, hands-free seat height, stair rise, and posture-risk guidance built for Snap SPECS AR glasses.
>
> **Demo Video (YouTube, 1080p 60fps):** https://youtu.be/Z70OyHdCLnc

## Overview

For people living with chronic knee or lower-back pain, sitting on a seat that is too low or climbing an overly steep stair riser can trigger sharp flare-ups—yet many patients hold a cane, walker, or handrail and cannot hold up a smartphone to check before committing.

**SeatSafe AR** places high-contrast spatial safety cues directly on the seat or staircase inside the wearer's field of view, combining geometry with the patient's daily condition (pain area, medication status, morning stiffness, and personal pain history).

See the full design rationale and done criteria in [`devpost/design-brief.md`](devpost/design-brief.md).

---

## Core Features

- **Proximity-Triggered AR Cockpit (`SeatSafe`)**: Automatically reveals a 3D safety ring, cyan safe-threshold bar, dual vertical height-gap pillars, and a central warning card (`SAFE` / `CAUTION` / `HIGH RISK`, score 1–10) when walking within `2.0 m`, and hides cleanly beyond `2.5 m` or when pinching **Got It**.
- **Dynamic Patient Context (`PAINFREE AR · CHECK-IN`)**:
  - **Seat Height Simulation**: `Low 30 cm`, `Mid 38 cm`, `Tall 46 cm`.
  - **Pain Area**: Knee Pain (`45 cm` safe baseline) vs. Lower-Back Pain (`43 cm` safe baseline).
  - **Medication Status**: `Meds: None` vs. `Meds: Taken` (reminds wearers not to overstrain joints even when medication masks pain).
  - **Morning Condition & App Sync**: `Good 90` / `Fair 65` / `Poor 35` (+2 cm stiffness safety margin) plus an opt-in `Sync App` endpoint (`painFreeApiUrl` defaults to offline `""` so no background network request fires unless explicitly configured; when blank or unreachable, falls back cleanly to built-in `PainFree Sample` data).
  - **In-Panel Audio Toggle**: `Sound: Off / On` (muted by default; when enabled, plays a soft chime once per approach within `1.5 m` of high-risk hazards).
- **One-Tap Pain Log & Adaptive Personalization (`PAIN LOG & PERSONALIZE`)**:
  - Tag situation (`Home` / `Cafe` / `Clinic`) and log post-action pain (`No Pain -1 cm`, `Mild +1 cm`, `Sharp +2 cm`).
  - Separately calibrates and persists personal seat (`chairOffsetCm`) and stair (`stepOffsetCm`) offsets locally across sessions via `PersistentStorageSystem`, with a 3-line recent log feed and one-tap reset.
- **StepSafe — 3D Stairs & Handrail Guidance**:
  - Switch `Space: Chair` ↔ `Space: Stairs` to evaluate `14 cm`, `18 cm`, and `22 cm` step risers with color-coded step edges and a sloped cyan handrail guide.
- **Motion Guards (`MotionGuardHUD`)**:
  - **StandSafe**: Detects rapid vertical standing rise and displays a live 3-second pause countdown to help prevent orthostatic dizziness.
  - **BendSafe**: Detects deep forward torso bending (downward pitch + crouching) and advises bending knees instead of the lower back.
  - **PaceSafe**: Tracks prolonged stillness (`>= 30 s`) and reminds the wearer to shift weight, stretch gently, and check medication.
  - Includes a `Guard: Auto / Bend / Stand / Pace` preview toggle for interactive testing.

---

## Running in Lens Studio

1. Open `learn-specs.esproj` in **Lens Studio** (configured for Snap SPECS / UIKit 4.0 / Spectacles Interaction Kit).
2. In **Interactive Preview** (`Preview 1`):
   - Move with **`W` / `A` / `S` / `D`**, look around with **right-click drag**, and pinch UI buttons by **left-clicking**.
   - Walk within `2.0 m` of the virtual chair to trigger the central warning card, or step past `2.5 m` to auto-hide.
   - Use the **right panel** (`PAINFREE AR · CHECK-IN`) to test seat heights, stairs mode, pain area, medication, morning scores, motion guards, sound toggle, and `Got It`.
   - Use the **left panel** (`PAIN LOG & PERSONALIZE`) to log pain and watch your personal safe threshold adapt live.

---

## Project Structure

```text
learn-specs/
├── learn-specs.esproj
├── devpost/
│   └── design-brief.md               # Approved SPECS design brief & done criteria
├── Assets/
│   ├── Scene.scene                   # SPECS 3-panel AR cockpit, 3D chair/stairs, controllers
│   ├── Materials/
│   │   └── SeatSafeSimplePBR.mat     # PBR material for procedural 3D chair, rings & stairs
│   ├── GeneratedSFX/                 # Optional soft UI click, safe chime & high-risk alert audio
│   └── Scripts/
│       ├── SeatSafeEvaluation.ts     # Pure risk scoring, StepSafe, Motion Guard & PainFree API helpers
│       ├── SeatSafeMain.ts           # Proximity logic, sensors, persistence, audio & orchestration
│       ├── SeatSafePanelUI.ts        # UIKit 4.0 3-panel cockpit + MotionGuardHUD builder
│       ├── SeatSafeChairVisual.ts    # Procedural 3D chair, rings, height gauges & 3-step stairs
│       ├── LeafIndex.ts              # LEAF test scenario registry
│       └── SeatSafe*Scenario.ts      # Automated LEAF verification scenarios
└── Packages/                         # Lens Studio UIKit, InteractionKit (SIK), LEAF, Motion, Icons
```

---

## Verification & Honest Limitations

- **Verified in Lens Studio Preview & Unit Regression Tests**: TypeScript compilation (`0` errors), runtime logs (`0` errors), interactive SIK pinch interactions across all 3 panels, pure domain & edge-case regression checks (chair/stair offset isolation, strict API parsing/timeouts, StandSafe/BendSafe/PaceSafe guards), and visual 1st-person SPECS 27 FOV readability checks.
- **Preview Stand-In & Unproven on Physical Hardware**: Real-world physical chair depth detection, cane/walker ergonomics, and outdoor optical waveguide contrast are simulated with virtual 3D furniture in Lens Studio Preview and remain to be validated on physical SPECS hardware.
