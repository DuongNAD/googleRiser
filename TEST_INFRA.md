# E2E Test Infra: SME AutoPilot (#BuildwithGoogleAI AI Riser Vietnam 2026)

## Test Philosophy
- **Requirement-driven**: Test suite derived strictly from `ORIGINAL_REQUEST.md` and `PROJECT.md § Feature Inventory`.
- **Opaque-box verification**: Exercise the system through its external REST API, SSE endpoints, and UI contracts as end users and judges would.
- **Methodology**: Category-Partition + Boundary Value Analysis (BVA) + Pairwise Combinatorial Testing + Real-World SME Workload Scenarios.
- **Zero-Friction Testability**: Dual-mode testing verifying both Mock/Demo Mode (100% out-of-the-box offline pass) and Live API mode compatibility.

## Feature Inventory & Test Mapping
| # | Feature | Requirement Source | Tier 1 (Feature) | Tier 2 (Boundary) | Tier 3 (Pairwise) | Tier 4 (Workload) |
|---|---------|-------------------|:----------------:|:-----------------:|:-----------------:|:-----------------:|
| F1 | VietQR & Bill Forensics | ORIGINAL_REQUEST §1 | 5 | 5 | ✓ | ✓ |
| F2 | Product Studio & VN Copy | ORIGINAL_REQUEST §1 | 5 | 5 | ✓ | ✓ |
| F3 | Voice & Chatbot Assistant | ORIGINAL_REQUEST §1 | 5 | 5 | ✓ | ✓ |
| F4 | Google Sheets Bi-Sync | ORIGINAL_REQUEST §2 | 5 | 5 | ✓ | ✓ |
| F5 | Gmail & Calendar Alerts | ORIGINAL_REQUEST §2 | 5 | 5 | ✓ | ✓ |
| F6 | Google Maps Route Matrix | ORIGINAL_REQUEST §2 | 5 | 5 | ✓ | ✓ |
| F7 | Firebase Auth & Firestore | ORIGINAL_REQUEST §2 | 5 | 5 | ✓ | ✓ |
| F8 | Zero-Config Mock/Demo Mode | ORIGINAL_REQUEST §2 | 5 | 5 | ✓ | ✓ |
| F9 | Express Backend & Health | ORIGINAL_REQUEST §3 | 5 | 5 | ✓ | ✓ |
| F10 | React+Vite Frontend SPA | ORIGINAL_REQUEST §3 | 5 | 5 | ✓ | ✓ |
| F11 | Dashboard & Dropzone | ORIGINAL_REQUEST §3 | 5 | 5 | ✓ | ✓ |
| F12 | Order Management UI | ORIGINAL_REQUEST §3 | 5 | 5 | ✓ | ✓ |
| F13 | Product Studio Workbench | ORIGINAL_REQUEST §3 | 5 | 5 | ✓ | ✓ |
| F14 | Voice Assistant Widget | ORIGINAL_REQUEST §3 | 5 | 5 | ✓ | ✓ |
| F15 | Cloud Run & Docker | ORIGINAL_REQUEST §4 | 5 | 5 | ✓ | ✓ |
| F16 | Submission Guide & Prompts | ORIGINAL_REQUEST §5 | 5 | 5 | ✓ | ✓ |

## Test Architecture
- **Test Runner**: Node.js / ts-node / vitest executable test runner (`tests/runner.ts` and `npm test`).
- **Test Case Organization**:
  - `tests/tier1_features/`: Dedicated test files for each feature F1–F16 (minimum 5 tests per feature).
  - `tests/tier2_boundaries/`: Edge cases, corrupted receipts, zero inventory, invalid phone numbers, network timeout fallbacks, malformed audio buffers.
  - `tests/tier3_combinations/`: Cross-feature flows (e.g., Voice Order -> Tool Call -> Inventory Decrement -> Google Sheets Sync -> Gmail Invoice -> Maps Route).
  - `tests/tier4_scenarios/`: End-to-end Vietnamese SME business workflows (Fashion Boutique Live Sales, F&B Rush Hour Takeout, Cosmetics Promotion Campaign).
  - `tests/tier5_adversarial/`: White-box coverage hardening, prompt injection resistance, forged receipt visual fuzzing, concurrent write conflicts.

## Real-World Application Scenarios (Tier 4)
| # | Scenario | Features Exercised | Complexity |
|---|----------|--------------------|------------|
| S1 | **Boutique Live Sale & Instant VietQR Audit**: Customer sends bank transfer slip during TikTok Live. SME AutoPilot audits the slip, flags forged timestamp, alerts seller before shipping. | F1, F3, F4, F7, F8, F11 | High |
| S2 | **Omni-Channel Voice Order & Google Sheets Sync**: Customer orders 2 Áo Dài via voice call in Central accent. Assistant checks stock via function call, reserves inventory, creates order, appends to Google Sheets, and dispatches invoice via Gmail. | F3, F4, F5, F8, F12, F14 | High |
| S3 | **Product Launch Studio & Marketing Blitz**: Seller uploads raw dress photo. Product Studio extracts attributes, generates Imagen 3 studio background, produces localized copy for FB, TikTok Shop, Zalo, and schedules Calendar livestream event. | F2, F5, F8, F10, F13 | High |
| S4 | **Multi-Stop Motorbike Delivery Dispatch**: Merchant receives 5 orders across Hanoi districts. System calculates shipping fees via Google Maps API, optimizes delivery sequence for shipper, and updates tracking status. | F4, F6, F8, F9, F12 | High |
| S5 | **Out-of-the-Box Judge Evaluation Tour**: Evaluation run starting in Demo Mode, exercising all 7 UI views, checking health probes, toggling Mock/Live switch, verifying zero runtime errors. | F8, F9, F10, F11, F15, F16 | High |

## Coverage Thresholds
- **Tier 1 (Feature Coverage)**: ≥ 80 test cases (≥5 per feature across 16 features).
- **Tier 2 (Boundary & Corner)**: ≥ 80 test cases.
- **Tier 3 (Cross-Feature Pairwise)**: ≥ 25 integration tests.
- **Tier 4 (Real-World Workloads)**: ≥ 5 comprehensive scenario pipelines.
- **Total Minimum Target**: ≥ 190 automated test cases.
- **Acceptance Gate**: 100% test pass rate with exit code 0.
