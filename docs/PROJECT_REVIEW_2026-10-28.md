# AV-Tracer — project review, 28 October 2026

Repository: [ivaronkun-Ahey/AV-Tracer](https://github.com/ivaronkun-Ahey/AV-Tracer). Follow-up to the [26 October review](PROJECT_REVIEW_2026-10-26.md).

## Overall opinion

**The latest branch has improved substantially. AV-Tracer now has a credible foundation for an AV teaching and diagramming product: clearer signal routing, useful editing tools, lessons, room/rack organization, document exports, and a working production test pipeline. The next milestone should be a stabilization release.**

The most important remaining problems concern trust: a lesson can certify an incorrect solution, entering a lesson can fail to preserve a user's document, and some accepted imports fail when used. Resolve those before promoting automatic assessment as dependable. Professional engineering use also needs verified equipment data and independently checked drawing output.

This is one evidence-based review from five professional perspectives, not five independent human expert opinions. It combines source inspection, local execution of the project checks, targeted probes of real modules, and inspection of the latest GitHub Actions results. No application fixes or PR merge are included in this report.

## Branch coverage

All three remote branches present during this review were checked. These are the application revisions reviewed, before adding this report:

| Branch | Reviewed revision | Assessment |
|---|---|---|
| `main` | [`8302c5e`](https://github.com/ivaronkun-Ahey/AV-Tracer/commit/8302c5ed5450d70731a058d0f554b27907c1b57b) | Still the June application plus the October 26 review. The earlier review's application findings remain relevant here. |
| `claude/inspiring-mccarthy-abbnco` | [`8d3b57c`](https://github.com/ivaronkun-Ahey/AV-Tracer/commit/8d3b57cededcaad3c4e16a2a7f2489ac758ab510) | Already merged; application source matches main. The only tree difference is the previous review document. No separate feature integration is needed. |
| `claude/awesome-einstein-49mvyc` | [`05cf568`](https://github.com/ivaronkun-Ahey/AV-Tracer/commit/05cf568afcb2032a429de1b2304ad6d3ceb8969b) | Active development candidate, 24 commits ahead and zero behind main at inspection. [PR #3](https://github.com/ivaronkun-Ahey/AV-Tracer/pull/3) is open. This is the appropriate development base. |

The current candidate changes 142 files relative to main. Relative to the October 26 reviewed candidate, 123 files changed, with 13,561 additions and 2,025 deletions. It therefore needs a fresh review, not just confirmation that the original defects were addressed. All new findings below refer to `05cf568`; the new lesson features do not exist on main.

## Assessment from five perspectives

| Perspective | What works well | What needs improvement | Recommended next step |
|---|---|---|---|
| AV systems and education | Port-aware traversal, channel isolation, selected-input/matrix routing, receiver-supplied phantom power, and 12 structured lessons make the training loop much stronger. | Grading can confuse equipment present on the canvas with equipment used by a signal. Most equipment specifications remain unverified. | Test wrong-but-plausible student solutions and verify the equipment used in the lessons. |
| Software architecture | One active TypeScript simulation engine, declarative catalog, schema migrations, and a shared drawing model reduce duplication. Calculation and export modules can be tested independently. | Project import and lesson import enforce different invariants. Dictionary keys and traversal limits still affect correctness. | Centralize document validation and return explicit incomplete/unsupported simulation results. |
| Product and UX | Undo/redo, persistent tags, autosave status, keyboard workflows, collapsible panels, rooms, racks, and teacher authoring support useful end-to-end tasks. | Lesson transitions do not always honor the promise to restore the original project. More features also increase onboarding complexity. | Make recovery dependable, then test one beginner and one instructor workflow with real users. |
| QA and reliability | 211 local unit tests pass; CI passes 16 Chromium browser tests against the production image. Tests cover more than snapshots, including explicit acceptance cases. | Successful reference solutions are better covered than misleading alternatives, malformed lessons, storage failure, and traversal boundaries. | Add focused negative and boundary cases for N1–N5 below. |
| Delivery and documentation | Production nginx image, security headers, dependency updates, license checking, Apache-2.0 documentation, and a candid status document are meaningful progress. | The default branch still delivers the older app. Drawing claims in the roadmap exceed the limitations acknowledged in the status document. | Stabilize PR #3, align the claims with validated behavior, then merge and tag a release. |

## What improved since October 26

The previous report should not be treated as the current candidate's unresolved bug list.

| Earlier finding | Candidate status and evidence |
|---|---|
| R1: connected sink passes without a source | Addressed for the reported case: sinks are checked against traced source reachability, with an explicit acceptance test. |
| R2: paths through management ports/wrong amplifier channels | Reported cases addressed by port-aware transfer rules and acceptance tests. Selected inputs, matrix routes, stereo paths, and bidirectional network links are now modeled. This does not establish real codec/network interoperability. |
| R3: microphone supplies its own phantom power | Addressed for the reported case: the connected receiving input supplies phantom power; missing supply produces an error. |
| R4: YX15P modeled as a passive speaker | Corrected catalog entry; concert example uses a passive EV model; legacy project migration handles the earlier representation. Verification of the broader catalog remains unfinished. |
| R5: duplicate imported identities | Ordinary duplicate IDs are rejected and format migrations/bounds exist. **Partially closed:** empty IDs and special dictionary keys remain problematic; see N3. |
| R6: undo leaves a cable targeting a removed device | Reported case addressed: pending operations are cleared and reducer connection checks reject missing endpoints. |
| R7: tags change after deletion | Addressed: device tags persist and can be edited, with stability tests. |
| R8: CSV preserves formula-leading text | Addressed in CSV serialization and tests. Spreadsheet application execution was not repeated in this review. |

Additional improvements include schema version 4, 5 MB project file limits, 67 equipment templates, 12 lessons, teacher authoring, room/rack views, PDF/SVG/DXF/VSDX output, and visible simulation limitations. The frontend suite grew from 66 to 211 tests. Production deployment and browser testing now exist where the earlier review found gaps.

## Confirmed findings

Priorities: **P1** means fix before releasing the affected workflow as dependable; **P2** means address during stabilization. These are product priorities, not security severity ratings. All five findings were reproduced using the candidate's actual TypeScript modules. Storage cases used an in-memory implementation of the browser Storage methods and real reducers/session functions.

### N1 — P1: AV-over-IP lesson accepts a solution without AV-over-IP

**Reproduction:** in `av-over-ip`, use the stock Sony camera, LG display, and Netgear switch. Connect `cam.hdmi_out` directly to `tv.hdmi_in_1` with a 3 m cable. Leave the switch disconnected. Do not add an encoder or decoder.

`evaluateLesson` returned `solved: true`, with all three checks passing, including “Видео идёт через сетевой коммутатор” (“Video goes through a network switch”). The stated goal requires encoder → switch → decoder.

**Cause:** [`checks.ts:46–64`](https://github.com/ivaronkun-Ahey/AV-Tracer/blob/05cf568afcb2032a429de1b2304ad6d3ceb8969b/frontend/src/learning/checks.ts#L46-L64) counts matching devices anywhere in the document for `uses`; `reaches` independently checks the camera-to-display path. Neither proves that the switch participates in that path.

**Improve:** add a path criterion such as ordered `via` selectors or required transfer stages, then express this lesson's encoder/switch/decoder requirement using it. Keep `uses` for inventory requirements. For each lesson, test plausible shortcuts as well as the reference solution.

**Acceptance:** direct HDMI plus an unused switch fails; the intended network path passes; disconnected required devices never satisfy a path requirement.

### N2 — P1: Entering a lesson can fail to preserve the original project

**Reproduction A:** create a document with a named room, a 42U rack, and title-block metadata, but no devices. Start the first lesson, then exit. No recovery stash is created. The resulting document has `rooms: []`, `racks: []`, and `meta: {}` instead of the original content.

**Reproduction B:** start with a three-device document and make the stash write throw a storage/quota error. Starting the lesson continues; exiting does not restore the original document and no error toast is emitted.

**Cause:** [`session.ts:12–19`](https://github.com/ivaronkun-Ahey/AV-Tracer/blob/05cf568afcb2032a429de1b2304ad6d3ceb8969b/frontend/src/learning/session.ts#L12-L19) treats zero devices as an empty project and swallows storage failures. [`startLessonSession`](https://github.com/ivaronkun-Ahey/AV-Tracer/blob/05cf568afcb2032a429de1b2304ad6d3ceb8969b/frontend/src/learning/session.ts#L42-L57) proceeds regardless. Undo can temporarily recover the original in the same session, but that history is not persisted across reload; ordinary autosave can replace the previous document with the lesson document.

**Improve:** define meaningful document content across devices, connections, rooms, racks, and metadata. Make entering a lesson transactional: validate the lesson, successfully preserve the current document, then replace it. On storage failure retain the document and offer a download/retry. Remove the recovery stash only after validation and restoration succeed.

**Acceptance:** room-only, rack-only, and metadata-only projects survive start → reload → exit; a failed stash write leaves the original project active with an actionable error. Include custom-lesson/progress saving in persistence status, since those writes currently also swallow errors in `store/index.ts`.

### N3 — P2: Accepted project IDs can crash simulation or evade uniqueness checks

**Reproduction A:** use `constructor` as a camera's device ID and update its outgoing connection accordingly. `parseProjectDoc` returns `ok: true`; `runSimulation` throws `TypeError: edges[from].push is not a function`. The same happens with `__proto__`.

**Reproduction B:** import two devices both having `id: ""`, with no connections. The parser accepts them.

**Cause:** [`buildEdges`](https://github.com/ivaronkun-Ahey/AV-Tracer/blob/05cf568afcb2032a429de1b2304ad6d3ceb8969b/frontend/src/sim/signalPaths.ts#L184-L195) uses a normal object as a dictionary and assumes a truthy existing entry is an array. In [`projectSchema.ts`](https://github.com/ivaronkun-Ahey/AV-Tracer/blob/05cf568afcb2032a429de1b2304ad6d3ceb8969b/frontend/src/data/projectSchema.ts#L124-L148), a duplicate empty string is returned but then tested for truthiness. Identifier strings have a maximum length, but no minimum length.

**Improve:** require nonempty identifiers, compare duplicate results explicitly with `undefined`, and use `Map` or null-prototype dictionaries consistently for external identifiers. Apply the same policy to lesson-created documents. This is a reproduced robustness failure; this review does not claim remote code execution.

**Acceptance:** empty/duplicate IDs produce a clear import error; special object-property names are either safely supported or rejected at the boundary; no accepted ID crashes graph construction.

### N4 — P2: Invalid lesson wiring is accepted on import and throws when started

**Reproduction:** copy the AV-over-IP lesson's solution into its start document and change the first connection's source to `cam.missing_port`. `parseLessons` accepts the file because the equipment exists. Building the start document then throws `нет порта «cam.missing_port»` (“port does not exist”).

**Cause:** [`parseLessons` / `parseLesson`](https://github.com/ivaronkun-Ahey/AV-Tracer/blob/05cf568afcb2032a429de1b2304ad6d3ceb8969b/frontend/src/learning/lessonSchema.ts#L93-L110) validate shapes and catalog references, but do not construct and validate the documents. Port resolution happens later in `buildDoc`. The [import handler](https://github.com/ivaronkun-Ahey/AV-Tracer/blob/05cf568afcb2032a429de1b2304ad6d3ceb8969b/frontend/src/components/LessonsDialog.tsx#L71-L95) reports success and stores the lesson; the [start handler](https://github.com/ivaronkun-Ahey/AV-Tracer/blob/05cf568afcb2032a429de1b2304ad6d3ceb8969b/frontend/src/components/LessonsDialog.tsx#L51-L57) has no error handling for this failure.

The teacher editor already checks that its reference solution passes and its start does not. File import bypasses those checks. Lesson device-ID uniqueness and project-size invariants should also be shared, rather than relying on the separate project-file importer.

**Improve:** validate start and solution documents, endpoints, identities, bounds, and lesson solvability before saving an imported lesson. Reuse the same validator for editor output, file import, and persisted lesson loading. Catch a failed lesson start and retain the user's project.

**Acceptance:** missing devices/ports and duplicate device IDs are rejected with the lesson name and offending reference; accepted lessons start safely; unsolvable reference solutions are rejected.

### N5 — P2: Traversal limits silently become false “no signal” diagnoses

**Reproduction:** build a synthetic document with one stock camera and 129 stock displays, each connected from the camera's HDMI output to a display input by a short cable. This is an algorithm boundary probe within the accepted document model, not a claim that passive HDMI fan-out is physically valid.

The engine returns 128 flows and `no_signal` for the 129th display (`tv128`), with no truncation warning. The missing path is caused by the internal limit, not a different wiring condition for that display.

**Cause:** [`tracePaths:216–228`](https://github.com/ivaronkun-Ahey/AV-Tracer/blob/05cf568afcb2032a429de1b2304ad6d3ceb8969b/frontend/src/sim/signalPaths.ts#L216-L228) returns early at 128 paths or 20,000 steps without reporting incomplete traversal. The engine subsequently treats unvisited sinks as unreachable. A highly branching network can hit the same path budget.

**Improve:** keep resource limits, but return a completeness flag and reason. Separate reachability analysis from enumerating every explanatory path where practical. Incomplete analysis must not produce an unqualified pass or definitive failure for an unexamined sink, or award lesson credit.

**Acceptance:** test below/at/above both limits; results clearly identify incomplete analysis and preserve trustworthy conclusions for examined paths.

## Further improvements and product direction

### Verify a small equipment subset thoroughly

Only two of the 67 catalog templates currently carry manufacturer source metadata: Shure Beta 87A and Yorkville YX15P. The repository also explicitly says that the 21 rack-height entries are unverified. See the [catalog limitations](https://github.com/ivaronkun-Ahey/AV-Tracer/blob/05cf568afcb2032a429de1b2304ad6d3ceb8969b/docs/STATUS.md#L106-L112).

Prioritize devices used in the 12 lessons and shipped examples. Record source URL, checked date, relevant ports, routing assumptions, power/phantom requirements, and rack dimensions. Distinguish verified manufacturer data from generic teaching models in the UI and exported equipment schedules. A smaller dependable catalog is sufficient for an initial training release.

### Align drawing claims with evidence

The shared vector drawing model and four export formats are valuable. However, [STATUS](https://github.com/ivaronkun-Ahey/AV-Tracer/blob/05cf568afcb2032a429de1b2304ad6d3ceb8969b/docs/STATUS.md#L116-L130) acknowledges unverified title-block dimensions, font substitutions, and use of form 3 on table sheets. The [roadmap's completed drawing section](https://github.com/ivaronkun-Ahey/AV-Tracer/blob/05cf568afcb2032a429de1b2304ad6d3ceb8969b/docs/ROADMAP.md#L22-L38) still lists form 5/6 and the intended standards font. These descriptions need to agree.

Treat exports as draft engineering documents until an appropriate drafting specialist checks representative outputs against the intended requirements. Add approved visual references for Cyrillic text, long names, multi-page tables, mixed page sizes, and rack dimensions. Document which exports have been opened and edited successfully in each supported target application. The repository reports parser/LibreOffice checks, but explicitly says native AutoCAD, nanoCAD, and Visio were not tested; this review did not independently certify those formats or standards compliance.

### Preserve the browser-first architecture and measure the next bottleneck

The core runs in the browser; the backend currently exposes root/health endpoints and is a future extension point. Accounts, collaboration, and AI are not needed to resolve the confirmed issues above. Add server functionality when a tested instructor workflow requires shared storage or assessment records.

The local build emits a main JavaScript chunk of about **1.13 MB / 349 KB gzip**, with separate larger optional layout/font chunks. This is a build-size observation, not measured page latency. Profile startup and edit/simulate/export interactions on representative 100-, 500-, and larger-device projects before choosing optimizations. Consider a worker for simulation only if measurements justify it. Add Firefox/WebKit and real touch-device checks before promising broad browser/mobile support; current CI runs Chromium.

### Validate the teaching experience with people

After stabilization, run a small pilot with AV beginners and instructors. Ask learners to build a basic PA chain, diagnose a wrong input/phantom problem, and explain why the fix works. Ask instructors to create, export, import, and revise a lesson. Measure task completion without help, misleading pass/fail results, recovery success, and time to the first working system. Those outcomes should guide feature priorities.

## Recommended sequence

| Stage | Work | Evidence required to finish |
|---|---|---|
| 1. Protect work and assessment | Fix N1 and N2; expose persistence errors. | Incorrect network shortcut fails; all meaningful document types survive lesson transitions and reload; failed preservation does not replace the document. |
| 2. Harden boundaries | Fix N3–N5 and add regression cases. | Invalid imports are rejected before use; accepted lessons start; truncation is visible and cannot be graded as a complete result. |
| 3. Establish release scope | Verify the lesson equipment subset; align drawing claims; update PR description to current schema/test counts. | Published feature claims match tested behavior; each critical equipment assumption has provenance. |
| 4. Release | Re-run CI on the final PR head, review and merge PR #3, tag a version, and follow the production instructions from a clean checkout. | Default branch delivers the intended app; migration/save/reopen/export smoke checks pass for the release. |
| 5. Learn before expanding | Run the instructor/learner pilot and profile realistic projects. | Prioritized improvements are backed by observed user difficulties and measured performance. |

PR #3 is much stronger than main, but the P1 findings warrant correction before a release that relies on lesson grading or promises automatic project restoration. This review does not merge the PR.

## Validation record and limits

Local runtime: Node **22.21.0**, npm **10.9.4**, Python **3.9.6**. Candidate snapshot: `05cf568afcb2032a429de1b2304ad6d3ceb8969b`.

| Check | Result |
|---|---|
| `npm ci --ignore-scripts` | Passed with the committed lockfile. |
| `npm run lint` | Passed. |
| `npm run typecheck` | Passed. |
| `npm run licenses:check` | Passed; 110 production packages checked. |
| `npm test -- --run` | **211 passed in 16 files.** |
| `npm run build` | Passed; bundle-size warning and non-fatal Rollup annotation warnings. |
| `npm audit --json` and `npm audit --omit=dev --json` | Both reported **0 known vulnerabilities** at review time. This is dependency-advisory evidence, not a complete security audit. |
| Backend `python -m pytest -q` | **2 passed** locally. |
| Real-module review probes | N1–N5 reproduced; no application source changes required. |
| Exact-head GitHub Actions | [Run 40741717502](https://github.com/ivaronkun-Ahey/AV-Tracer/actions/runs/40741717502) succeeded for `05cf568`: frontend, backend, and production-image E2E jobs. E2E logs report **16 passed in 39.6 seconds**. |

The production browser suite and Docker checks above were inspected in CI, not independently rerun locally. The prior main/June validation was not rerun because their application trees are unchanged; see the earlier report for those results. Hardware behavior, all catalog specifications, standards compliance, native CAD/Visio interoperability, large-project performance, screen-reader accessibility, and backend dependency vulnerabilities were not independently validated in this pass.

**Recommended milestone:** a dependable first training release built from the latest branch, with reliable project recovery, meaningful lesson grading, verified lesson equipment, and clearly scoped drawing exports.
