---
status: approved
---

# Design brief: SeatSafe AR (PainFree Chair Check) (default)

<!-- Filled in by plan-lens from the learner's interview. Use the learner's words. Mark any value they didn't choose as (default). -->

## The one spatial moment
When a patient with knee or lower-back pain approaches a chair to sit down, the glasses combine the chair's seat height with the patient's daily state (pain area, whether they took their medication, and their morning condition) and display a clear pain-risk evaluation and height-difference guide directly over the seat before they commit to sitting.

## Why it belongs on glasses
- Uses: shares your view, draws in the world, leaves your body free.
- Why it's better than the phone or laptop version: A patient often uses a cane, walker, or handrail with their hands and cannot hold up a phone to measure a chair before sitting. Glasses keep both hands free and place the safety check directly on the chair in front of them.

## Product or overlay
- Type: overlay (conceptual overlay on a real chair, connected to the patient's existing PainFree app/API for daily condition & medication scores, demonstrated with virtual chairs in preview) (default)
- What the real version would sense: Real chair seat height (cm), distance from the patient to the chair, and live daily condition score & medication log synced from the patient's existing PainFree app.
- Stand-in for the preview: Because preview cannot measure real furniture and an external local/cloud PainFree server may not be running during judging, the Lens attempts to fetch the patient's condition score & medication status from a configurable PainFree API endpoint (`fetch` with safe timeout) and falls back cleanly to built-in sample PainFree app data—plus large pinch buttons on the side panel let the user test Good/Fair/Poor scores, medication Taken/Not Taken, and Low/Mid/Safe chair heights directly in preview (default).

## Where things live
- Where the user is looking during the main task: Standing 0.8 to 1.2 m in front of the chair, looking slightly down toward the seat.
- Virtual test chair: Anchored on the floor (`y = 0`), approx. 50 x 50 cm footprint, seat height switchable (30 / 38 / 46 cm) (default).
- Seat safety ring & height bar: Floating 5 cm above the chair seat (`~55 x 55 cm`), glowing green (safe), yellow (caution), or red (high pain risk) (default).
- Pain prediction card: Floating 35 cm above the seat (within comfortable ~1 m view, bright high-contrast text on translucent panel—no pure black), showing seat height, deficit in cm, an overall risk evaluation score/grade (Safe / Caution / High Risk) calculated from chair height + pain area + medication status + morning condition, and expected post-sit joint load (e.g., "Seat 30 cm · 15 cm too low · High Risk (8/10) · No meds + Poor morning condition: high knee/back strain") (default).
- Control panel (Daily check-in & Height selector): Placed to the right side of the chair at waist/chest height (~95 cm above floor, within arm's reach ~65 cm away) with large pinch buttons for chair height test, pain area, medication status, and morning condition (default).

## Hands and input
- Chair height test buttons (Low 30 cm / Mid 38 cm / Safe 46 cm): Large pinch buttons on the side control panel to simulate different real-world chairs (default).
- Patient profile toggle (Knee Pain / Lower-Back Pain): Large pinch button that adjusts the safe height threshold (45 cm for Knee, 43 cm for Back) and tailors the pain-warning text (default).
- Medication status toggle (Meds Taken / Not Taken): Large pinch button indicating whether the patient has taken pain medication; adjusts the risk evaluation and adds a warning if unmedicated (higher immediate pain risk) or medicated (reminds not to overstrain joints even if pain feels dulled) (default).
- Sync from PainFree App button ("Sync App"): Attempts a live `fetch` from the PainFree app endpoint (with clean fallback to sample PainFree score data) and displays the synced morning condition score & medication status (default).
- Morning condition selector (Good 90 / Fair 65 / Poor 35): Three large pinch buttons to override or simulate the morning condition score from the PainFree app, dynamically adjusting the overall risk grade and safe threshold margin (default).
- Dismiss / Acknowledge button ("Got it"): Large pinch button to hide the warning once the user has seen it (default).
- Targets are big (at least 10 x 6 cm) and highlight when aimed at.
- Voice (if any) and the button that does the same job: None required (all actions use large pinch buttons) (default).

## When things show
- Seat safety ring & pain prediction card: Show automatically when the user walks within 2.0 m of the chair, and hide automatically when the user steps back beyond 2.5 m or pinches "Got it" (default).
- If something needs attention out of view: A short soft alert chime plays once when entering within 1.5 m of a "High Risk" low chair (default).

## Done criteria
Each one can be checked in Lens Studio's preview.
1. Walking within 2.0 m of the chair in Interactive Preview automatically reveals the seat safety ring and pain prediction card above the chair.
2. Pinching the height buttons switches the virtual chair between Low (30 cm → red warning + chime + high strain text), Medium (38 cm → yellow caution), and Safe (46 cm → green safe indicator).
3. Pinching the patient profile, medication status (Taken / Not Taken), and morning condition (Good / Fair / Poor) buttons dynamically updates the overall risk evaluation grade/score and expected post-sit pain explanation on the card above the chair.
4. Stepping back beyond 2.5 m (or pinching "Got it") hides the overlay so it does not clutter the user's view.

## Out of scope
- Real-time camera depth scanning or AI object recognition of physical chairs in a real room.
- Persistent patient medical records or cloud sync across sessions.
- Multi-user shared sessions.

## Risks and open questions
- Feel unproven: Real-world depth measurement accuracy on physical chairs, comfort while walking with a cane, and outdoor additive display readability can only be verified on actual SPECS hardware.

## Build notes for CLAD
- Build for SPECS so it runs and can be demonstrated in Lens Studio's preview. No SPECS device is available.
- Use Spectacles Interaction Kit (SIK) and UI Kit for all interactions, so they work with the mouse in Interactive Preview and with LEAF.
- Build any stand-in exactly as described above, and keep it obvious in the scene.
- Use real-world scale in centimeters. Keep content inside the user's view during the main task.
- The display is additive: black renders as transparent. Don't rely on black or very dark content to be seen; keep text light and readable from where the user stands.
- Get the basic flow working first, then add detail.
- Write LEAF scenarios for each done criterion, run them in preview, and report which pass. Say which criteria have no test.
- Don't record, identify, or follow people.

## After the build: judge it
This part is for you, after CLAD finishes.

1. **Does it work?** Ask your agent which LEAF tests passed and which done criteria have no test.
2. **Walk around it.** Open the preview in Interactive Preview. Use WASD to move, Q and E to go down and up, and right-drag (or hold Shift) to look around. Clicking acts as a pinch. Stand where a user would and look at the task.
3. **Ask the three questions.**
   - Does it use what I'm looking at?
   - Does it put something in my space, where it belongs?
   - Does it free my hands or let me keep my eyes up?
   - Would it be just as good on a phone? If so, what would make it need the glasses?
4. **Check comfort.**
   - Everything I need is in view while I do the task. Nothing sits at the edges, behind me, or stuck to my face.
   - Every control is within reach of someone standing there.
   - Text reads easily from where I stand. No dark UI disappearing.
   - Things show when needed and get out of the way.
5. **Label what you know.** Write "logic proven" next to anything the tests and preview show working, and "feel unproven" next to anything only real glasses could tell you (comfort over time, real hand tracking, real recognition).
6. **Fix with design notes, not code.** Tell your agent what to change in design terms, for example: "Move the step card 15 cm lower and next to the pan. Make the Next button twice as big. Re-run the tests." If a fix takes under a minute, like nudging a panel, do it yourself in the scene.
7. **Submit.** Record a video under 3 minutes of your Lens in the preview, public on YouTube. Make your repo public with your Lens Studio project and this `devpost/` folder. Details are on the hackathon site: https://learn-specs.devpost.com/resources
