# AV-Tracer project and branch review

Reviewed on **26 October 2026**. Repository: [ivaronkun-Ahey/AV-Tracer](https://github.com/ivaronkun-Ahey/AV-Tracer).

## Overall opinion

**AV-Tracer is a promising, usable prototype for learning AV connections and producing system diagrams. The October branch is a substantial improvement and should be the basis for continued development. Its signal results still need correctness work before users can rely on them for training assessments or professional system verification.**

The strongest assets are the focused visual workflow, recognizable equipment, offline operation, and the latest branch's diagram/documentation exports. The largest weakness is that a successful simulation can describe a system that would not carry the intended signal. Make a small set of scenarios trustworthy before adding more equipment, accounts, databases, or AI features.

This is a code-based review with several engineering perspectives, not an external human expert panel. Findings below distinguish reproduced behavior, source-based observations, and product recommendations. No application fixes were made as part of this review.

## Branch coverage

All three remote branches present at the start of the review were inspected. References below are pinned to the reviewed commits so they remain meaningful after branches change.

| Branch | Reviewed commit | Relationship to main | Assessment |
|---|---|---|---|
| `main` | [`a8dcc0f`](https://github.com/ivaronkun-Ahey/AV-Tracer/commit/a8dcc0f6f8cb8f0b0fae17fe759834987a0c3246), 12 June 2026 Moscow time | Default branch | Working older prototype; misses the October improvements. |
| `claude/inspiring-mccarthy-abbnco` | [`8d3b57c`](https://github.com/ivaronkun-Ahey/AV-Tracer/commit/8d3b57cededcaad3c4e16a2a7f2489ac758ab510), 12 June Moscow time | Already merged through PR #2; identical source tree to main; one merge commit behind | No separate feature set remains to integrate. Its strengths and weaknesses are those of main. |
| `claude/awesome-einstein-49mvyc` | [`3c973d1`](https://github.com/ivaronkun-Ahey/AV-Tracer/commit/3c973d12306add2d9285f6d376a945de6fec8495), 23 October 2026 | Five commits ahead, zero behind main | Best development base: improved simulation/editor, CI, auto-layout, exports, one active engine, validated JSON catalog. Resolve correctness issues before releasing it. |

The earlier simulator branch from PR #1 is no longer a live remote branch; its merged work is included in main's history. Existing PRs #1 and #2 were checked for merge context. No open PR for the October branch was returned during this review.

## Opinions from five perspectives

| Perspective | What is working well | What is working poorly | Best next investment |
|---|---|---|---|
| AV systems / training | Concrete models, visible wiring, gain/resolution checks, cable and amplifier/load feedback make abstract concepts tangible. | Source reachability, phantom supply, internal routing, and at least one stock speaker entry can teach incorrect behavior. | Manufacturer-backed acceptance cases and a port-aware signal model. |
| Software architecture | One active TypeScript engine; mostly pure calculation/export modules; centralized Redux state; schema-based catalog loading. | Device-level traversal loses channel information; editable documents lack identity guarantees and format versions. | Explicit signal transfer rules, document invariants, stable identities, and migrations. |
| Product / UX | Examples, Russian labels, contextual properties, undo/redo, fit-to-view, auto-layout, and export support a coherent workflow. | Fixed side panels consume 600px; drag/canvas interactions have no complete keyboard alternative; autosave failures are invisible. | Make one beginner PA workflow easy to complete, recover, and explain. |
| QA / reliability | Latest lint, types, 66 frontend tests, fixtures, and backend smoke tests pass; CI is present and green. | Passing tests miss reproduced physical and editor defects; generated expected results are not independent evidence of AV correctness. | Independent domain assertions plus a small browser workflow suite. |
| Delivery / security | Browser-only core reduces infrastructure needs; unused frontend dependencies were removed; latest backend CORS uses its allowlist. | Default branch is older; packages have audit findings; supplied Docker setup is for development; CSV export can preserve formulas. | Release the corrected latest work, update dependencies, and provide a static production deployment path. |

## What is genuinely strong

1. **A focused interaction loop.** Add equipment, connect ports, configure properties, simulate, then save/export. This is easier to understand than the much larger platform described in the historical planning documents.
2. **The latest architecture removes duplicated active simulation engines.** Main can use either Python or browser logic; October makes the TypeScript engine authoritative and archives Python. This removes a major source of inconsistent results. See [latest README architecture](https://github.com/ivaronkun-Ahey/AV-Tracer/blob/3c973d12306add2d9285f6d376a945de6fec8495/README.md#L175-L185).
3. **Editing improved substantially.** Left-to-right labeled ports, occupied-port checks, snap-to-grid, larger port targets, grouped property undo, and one history step per drag address real usability problems. Layout is loaded on demand.
4. **Imports and catalog maintenance have a sound foundation.** Zod validates project/autosave shapes, dangling imported connections are reported, and catalog parsing rejects duplicate catalog and port identifiers. Moving 60 equipment entries into JSON makes review and maintenance easier.
5. **Exports create practical value beyond simulation.** PNG, printable documentation, a bill of materials, and cable schedules are useful deliverables. Export calculations are testable pure functions, and print-table text is HTML-escaped.
6. **CI is useful and working.** The reviewed October head has a [successful CI run](https://github.com/ivaronkun-Ahey/AV-Tracer/actions/runs/39900829379). Local validation independently passed its checks; the missing cases described below explain why green CI is not enough by itself.

## Highest-priority correctness findings

Priority convention: **P1** = fix before presenting simulation results as trustworthy; **P2** = address during stabilization; **P3** = useful subsequent improvement. These are project priorities, not claims that every issue is an exploitable security vulnerability.

### R1 — P1: A connected speaker can pass without any signal source

**Present on main and latest. Reproduced on latest.** With stock SQ-5 connected to JBL PRX815W, but no microphone or other source connected to the mixer, the engine returned:

```json
{"valid":true,"signal_flows":[],"warnings":[],"errors":[]}
```

The [sink check](https://github.com/ivaronkun-Ahey/AV-Tracer/blob/3c973d12306add2d9285f6d376a945de6fec8495/frontend/src/sim/engine.ts#L495-L505) counts incoming cables instead of checking whether a supported source reaches the sink. A cable is not evidence of signal availability.

**Improve:** compute source reachability for each signal domain and sink. Distinguish physical connection, reachable source, and supported transfer. A source-free mixer-to-speaker system must report `no_signal`; a complete microphone-to-mixer-to-speaker system must pass when its settings are correct.

### R2 — P1: Traversal invents paths through unrelated ports and channels

**Architectural limitation present on main; concrete false-positive cases reproduced on latest.** The [graph and traversal](https://github.com/ivaronkun-Ahey/AV-Tracer/blob/3c973d12306add2d9285f6d376a945de6fec8495/frontend/src/sim/engine.ts#L118-L174) operate at device level. Destination acceptance checks whether the device has any media ports, rather than whether the actual incoming port supports that media transfer.

Two reproduced examples returned `ok` paths:

- Sony camera HDMI → NVX encoder → Cisco switch → ATEM Mini Pro **Ethernet port** → ATEM HDMI → display.
- Crown XLS 2502 receiving signal on **left input**, with the traced speaker attached to **right output**.

The engine's LAN restriction is applied to the outgoing endpoint only. Types and catalog schemas support routing metadata, but the stock catalog does not populate it and the simulator does not consume it.

**Improve:** trace port/channel states and explicit device transfer rules. Separate management networking from media transport; support stereo/channel mapping, selected inputs, and matrix routing deliberately. Use cycle protection that preserves alternate paths: the current global visited-device set can suppress reconverging routes. Test both orientations of bidirectional switch links as well.

### R3 — P1: Phantom power is checked on the microphone instead of its supply

**Present on main and latest. Reproduced on latest.** Beta 87A → SQ-5 → JBL, with mixer phantom power disabled and the microphone's default phantom flag enabled, returned `valid:true`, an `ok` path at `-4.8 dBu`, and no warning.

The [phantom check](https://github.com/ivaronkun-Ahey/AV-Tracer/blob/3c973d12306add2d9285f6d376a945de6fec8495/frontend/src/sim/engine.ts#L337-L349) reads the requiring device's own property. [Shure's guide](https://www.shure.com/en-US/docs/guide/BETA87A) specifies phantom power for the Beta 87A and describes mixer supply and balanced microphone wiring.

**Improve:** model supply at the receiving input or explicit external supply and check the connected path. Acceptance: mixer phantom off flags the connected condenser; enabling a compatible supply resolves it. The microphone should express a requirement, not manufacture its own supply.

### R4 — P1: The supplied concert example uses an incorrectly modeled speaker

**Present on main and latest; verified against manufacturer specifications.** The [YX15P catalog entry](https://github.com/ivaronkun-Ahey/AV-Tracer/blob/3c973d12306add2d9285f6d376a945de6fec8495/frontend/src/data/catalog.json#L267-L276) describes a passive, 8Ω, 400W speaker with Speakon. The [concert example](https://github.com/ivaronkun-Ahey/AV-Tracer/blob/3c973d12306add2d9285f6d376a945de6fec8495/frontend/src/data/examples.ts#L94-L102) connects it to a power amplifier.

[Yorkville identifies YX15P as active](https://www.yorkville.com/legacy/product/yx15p), with an integrated 200W amplifier and XLR/TRS inputs. This is a material catalog error, not merely a naming issue.

**Improve:** correct the powered model and migrate affected saved projects deliberately. For the passive concert scenario, choose a documented passive model, such as [YX15](https://www.yorkville.com/loudspeakers/yx/product/yx15/) with its own verified ratings. Record manufacturer URL, verification date, and modeled assumptions for each template. Test critical catalog behavior in addition to schema shape.

## Editor, file, and export findings

### R5 — P2: Imported documents permit duplicate identities

**Confirmed on latest.** Probes accepted duplicate device IDs, duplicate connection IDs, and duplicate port IDs within a device. [Project validation](https://github.com/ivaronkun-Ahey/AV-Tracer/blob/3c973d12306add2d9285f6d376a945de6fec8495/frontend/src/data/projectSchema.ts#L18-L74) validates shapes and endpoint existence, but not these uniqueness rules. Rendering keys collide; some updates find the first match while deletion removes all matches.

**Improve:** reject collisions before loading state. Require globally unique device/connection IDs and unique port IDs per device; add focused regression cases. Add `schemaVersion` and explicit migrations before document formats evolve further.

### R6 — P2: Undo/deletion can leave a connection referencing a removed device

**Present on main and latest; reproduced in latest reducer.** Add a mixer, add a microphone, begin a cable from the microphone, undo its addition, then complete the cable on the mixer. A connection is created whose source no longer exists.

[Undo/redo](https://github.com/ivaronkun-Ahey/AV-Tracer/blob/3c973d12306add2d9285f6d376a945de6fec8495/frontend/src/features/canvasSlice.ts#L254-L281) and device removal retain `connectionInProgress`; [completion](https://github.com/ivaronkun-Ahey/AV-Tracer/blob/3c973d12306add2d9285f6d376a945de6fec8495/frontend/src/features/canvasSlice.ts#L179-L211) only checks busy ports if endpoints exist. Rendering hides the dangling cable, making the invalid state less visible.

**Improve:** clear pending operations when document/history changes invalidate them. Reject absent endpoints, unsupported directions, and incompatible wiring in the reducer, even when UI checks already exist.

### R7 — P2: Device tags change after normal editing

**New export/documentation issue on latest.** [Tags are regenerated from array order](https://github.com/ivaronkun-Ahey/AV-Tracer/blob/3c973d12306add2d9285f6d376a945de6fec8495/frontend/src/data/deviceTags.ts#L30-L38). Reproduction: two microphones are MIC-01 and MIC-02; delete MIC-01, and the surviving device becomes MIC-01. Diagrams, BOMs, and cable endpoints use these tags, so a later export can disagree with already printed documentation or field labels.

**Improve:** persist a unique, editable device tag. Allocate new numbers without renumbering surviving devices. Test deletion, reorder, undo, and save/reopen stability.

### R8 — P2: CSV output retains spreadsheet formulas from imported text

**Confirmed output on latest; spreadsheet execution was not tested.** Import a valid device with model `=1+1`; BOM export emits that literal formula-leading cell. [CSV escaping](https://github.com/ivaronkun-Ahey/AV-Tracer/blob/3c973d12306add2d9285f6d376a945de6fec8495/frontend/src/features/exportDocs.ts#L108-L122) handles delimiters and quotes, but does not neutralize formulas.

Opening CSV derived from a shared project in spreadsheet software may interpret such strings as formulas. This is conditional on imported content and how the CSV is opened.

**Improve:** neutralize formula-leading text cells before CSV encoding while retaining numeric columns as numbers. Test `=`, `+`, `-`, `@`, and leading control characters. Keep the existing HTML escaping for print output.

## Security and delivery readiness

**Dependency updates are needed.** Explicit npm audit JSON snapshots collected during this review reported:

| Snapshot | Low | Moderate | High | Critical | Total affected package entries |
|---|---:|---:|---:|---:|---:|
| Main, full dependency graph | 1 | 6 | 22 | 2 | 31 |
| Latest, full dependency graph | 1 | 5 | 17 | 2 | 25 |
| Latest, `--omit=dev` | 0 | 1 | 1 | 0 | 2 |

These are audit package counts, including transitive dependencies and propagated severity, not counts of demonstrated exploitable application bugs. Registry responses can change. The two latest production-graph entries were `zod` and transitive `yaml`; the critical full-graph entries were development packages `vitest` and `tinypool`.

The [Vitest advisory](https://github.com/advisories/GHSA-5xrq-8626-4rwp) has specific UI/API exposure and Windows conditions; this review did not demonstrate exploitation in AV-Tracer. The [Zod advisory](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) concerns resource exhaustion during oversized validation. Project files currently have no overall file-size/device-count limit.

**Action:** update dependencies in controlled batches, inspect the actual advisories and affected execution paths, rerun checks, and add dependency/security automation. Bound import size and document complexity. Do not blindly apply a forced major-version upgrade based on audit totals.

**Production packaging is incomplete.** The supplied [Compose setup](https://github.com/ivaronkun-Ahey/AV-Tracer/blob/3c973d12306add2d9285f6d376a945de6fec8495/docker-compose.yml) uses backend reload mode and a frontend development Dockerfile. Vite binds to all interfaces by default. Keep this as a development setup and add a documented static build/deploy path. Make the currently unused backend optional instead of a prerequisite for the recommended launch.

**Default-branch release matters.** Users cloning main receive the June application, without October CI, validation, exports, and architecture changes. Stabilize the October work, merge through a reviewed PR, and tag a release. Afterward, remove merged branches if desired. This review did not merge or delete any existing branch.

**Documentation needs a current-status page.** The active [MVP guide](https://github.com/ivaronkun-Ahey/AV-Tracer/blob/3c973d12306add2d9285f6d376a945de6fec8495/docs/AVTrainer_MVP_Development_Guide.md#L20-L27) still describes database/authentication/learning infrastructure. The runtime is a browser editor plus health-only backend scaffold. Mark older plans historical and publish implemented/planned/unsupported functionality in one concise document. Choose and document the project's intended license; no LICENSE file was present in either reviewed tree.

## UX and performance improvements

- **Collapsible/resizable panels:** permanent 280px and 320px drawers consume 600px before the canvas. Add toolbar overflow and small-screen behavior. The app's initial desktop screen was visually inspected; a full responsive usability study was not performed.
- **Keyboard access:** add an “Add to diagram” action to equipment cards and a keyboard-operable device/connection list. Canvas-only port interactions need an alternative.
- **Visible saving state:** autosave catches storage failures silently and waits 400ms. Show unsaved/saved/error state and flush appropriately when the page becomes hidden. Keep explicit file export as recovery.
- **Measure larger projects before optimizing:** the latest production build emits an initial JS chunk around 901KB, 280KB gzip, plus a lazily loaded ELK chunk around 1.44MB, 438KB gzip. This is a build observation, not a measured latency claim. Establish load/interaction budgets, profile 100–500 devices, then split or optimize where measurements justify it.
- **Explain result confidence:** distinguish checked, warning, unsupported, and estimated behavior. The engine currently omits network capacity, codec interoperability, Dante subscriptions/clocking, HDCP/EDID, frame rate, and more detailed electrical/acoustic behavior. Cable limits and signal levels are simplified assumptions. Clearly show that scope in the product.

## Recommended implementation sequence

| Stage | Work | Completion evidence |
|---|---|---|
| 1. Make one scenario trustworthy | Fix R1–R4; validate basic PA and one video path; correct catalog sources. | Independently specified tests reject source-free, phantom-off, management-port, and wrong-channel cases; corrected concert example matches manufacturer data. |
| 2. Protect documents | Fix R5–R8; persist tags; add format version/migrations and import bounds. | Duplicate identities rejected; no dangling cable after history/removal; tags survive edits and roundtrips; formula-leading text exports safely. |
| 3. Establish release confidence | Update dependencies; add browser smoke tests and production build/deploy instructions; clarify current scope. | Existing checks pass, new acceptance cases pass, advisory triage is recorded, example projects save/reopen/export correctly. |
| 4. Release latest work | Review and merge corrected October branch; tag release; simplify onboarding. | Fresh default-branch clone gets the intended app and one documented launch path works. |
| 5. Expand with user evidence | Pilot with a small group of AV beginners/instructors; add requested lessons and features. | Users can build, diagnose, save, reopen, and explain a basic system without help. Track task completion and misleading simulation results. |

Keep the browser-first core. Add server-side accounts/storage only when a demonstrated workflow needs them. If simulation later runs on a server, reuse the TypeScript domain module and its acceptance cases instead of recreating the rules in Python.

## Validation and limits of this review

Local tools: Node **22.21.0**, npm **10.9.4**, Python **3.9.6**. Repository CI uses Node 20 and Python 3.11; its latest exact-commit run also passed.

| Check | Main / merged June tree | Latest October tree |
|---|---|---|
| Locked install, `npm ci --ignore-scripts` | Passed | Passed |
| `npm run build` | Passed; bundle-size warning | Passed; bundle-size warning |
| `npm test -- --run` | **16 tests passed**, 2 files | **66 tests passed**, 8 files |
| `npm run lint` | **Fails: missing ESLint configuration** | Passed |
| `npm run typecheck` | No dedicated script; build runs TypeScript | Passed |
| Backend tests | No checked-in backend test suite | **2 pytest tests passed** |
| API probes | Malformed device returns 500; missing endpoint connection can return `valid:true` | Root/health 200; simulation endpoint 404 as intended; expected CORS origin behavior |
| Real-engine/reducer probes | Selected historical behavior inspected | R1–R3 and R5–R8 reproduced with scratch scripts using real modules |
| Manufacturer verification | Shared catalog error identified | Yorkville and Shure references checked |
| UI | Source inspection | Initial desktop view inspected in running app |

The old main API issues follow from accepting arbitrary dictionaries: `{ "devices": [{}], "connections": [] }` returned 500 with detail `'id'`; a connection between nonexistent devices returned 200 with `valid:true`. October deliberately removes `/api/simulate`; these are historical-main findings, not unresolved bugs in the latest backend.

Fixture snapshots are useful regression protection, but [their update script](https://github.com/ivaronkun-Ahey/AV-Tracer/blob/3c973d12306add2d9285f6d376a945de6fec8495/frontend/scripts/update-sim-fixtures.ts#L14-L18) generates expected results using the engine itself. Review those diffs deliberately and supplement them with independent domain cases. No browser end-to-end suite was found; browser save/print workflows, Docker execution, large-project performance, backend dependency auditing, and real hardware behavior were not validated here.

**Recommended next milestone:** a small, verifiably correct AV training/editor release based on the October branch, with stable project files and clear limits on what simulation proves.
