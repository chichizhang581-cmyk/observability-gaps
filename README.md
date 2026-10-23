# Observability Gaps: Data Availability Materials

This package accompanies the ICSE 2027 NIER submission on observability gaps.
It contains the frozen annotation and evaluation materials and anonymous,
structured outcomes from the main RQ2 experiment. It does not include evaluated
production code, patches, scan reports, target descriptions, or target-to-source
identifiers. The separate category-3/category-4 extension and human-review
overlays are not included in the outcome table.

## Materials and paper correspondence

The section references below use topic names rather than manuscript section
numbers, which may change during editing.

| Material | Description | Paper section/topic |
| --- | --- | --- |
| `codebook.md` | Final annotation codebook and four-category presentation. | RQ1: annotation procedure and taxonomy of observability gaps |
| `rubric.md` | Frozen reference-aspect extraction, content grading, and position-matching rubric. | RQ2: ground truth and detection matching |
| `diaglens-skill/` | Complete identifier-anonymized distribution of frozen DiagLens **v1.1.0**, including skill instructions, language patterns, plugin metadata, and synthetic regression fixtures. | Approach: DiagLens design and scanning workflow |
| `prompts/observability-annotation-v2.txt` | Original executed annotation prompt, version `observability-annotation-v2`. | RQ1: agent annotation |
| `prompts/scan.txt` | Frozen blind scanning template; placeholders are intentionally uninstantiated. | RQ2: DiagLens scanning |
| `prompts/aspect-extraction.txt` | Frozen independent reference-aspect extraction prompt. | RQ2: ground-truth construction |
| `prompts/content-judgment.txt` | Frozen independent finding-content judgment prompt. | RQ2: matching and grading |
| `per-target-outcomes.csv` | One anonymous structured row for each of the 223 main RQ2 targets. | RQ2: experimental results |
| `verification.json` | Aggregate consistency checks, sanitization summary, and byte-copy verification. | Data availability and artifact integrity |
| `SHA256SUMS` | SHA-256 checksums for every other file in this directory. | Data availability and artifact integrity |

The codebook, rubric, and four prompt files are copied byte-for-byte from their
designated final sources. Their original language is preserved. The annotation
prompt uses the executed leaf-type vocabulary; the codebook presents the final
four-category aggregation. This is not a revised annotation prompt. The rubric's
historical introductory cohort and execution notes describe the original
re-evaluation stage; its matching rules were reused unchanged for the final
223-target cohort. Those historical notes have not been rewritten as final
cohort statistics.

Ground truth is derived from RQ1 annotations anchored in pre-change code.
The patch is a fix reference, not an alternative patch-derived ground truth.
Reference extraction and content judgment use separate workflows.

## DiagLens version and distribution changes

The skill is version **v1.1.0**. Its entry point is
`diaglens-skill/skills/diaglens/SKILL.md`. All files from the frozen skill
directory are present. The included source fixtures are synthetic regression
fixtures shipped with the skill, not code from experimental targets.

Only identifying metadata and environment references were changed in this
distribution: contributor names and contact fields, an internal repository
homepage, affiliation references, internal service endpoints, and a local
snapshot path. Service endpoints now use non-routable `example.invalid`
placeholders. Product names and tool identifiers required to interpret the
workflow are retained; they do not identify the study's authors or organization.
Scanning criteria, risk scoring, language patterns, and matching rules were not
changed. The original skill regression tests are included.

`diaglens-skill/SNAPSHOT_MANIFEST.json` describes the **anonymized distribution**,
with freshly computed hashes, rather than claiming that redacted files have the
original frozen bytes. It excludes itself from its file-hash set.
The original snapshot metadata and private provenance are not distributed.

Optional remote code-access adapters require the reader's own authorized
configuration; the distributed placeholders are not working service endpoints.
The skill also specifies a local-workspace fallback. This package alone cannot
replay scans of the withheld production targets.

## Outcome table

The CSV is UTF-8, has a header, and contains exactly 223 rows.
`target_id` values run from `T001` through `T223`. Assignment uses an opaque
permutation, not source identifier or chronological order. The private mapping
is not included in this package or its repository submission.

| Field | Values and interpretation |
| --- | --- |
| `target_id` | Anonymous target identifier; no source identifier is encoded. |
| `problem_category` | `cat1` = Missing failure evidence; `cat2` = Distorted evidence. These are the two categories in the main RQ2 cohort. |
| `improvement_type` | Frozen leaf type: `failure_context`, `timeout_recovery`, or `representation_repair`. The first two aggregate to `cat1`; the third to `cat2`. |
| `stage_d_support` | `yes` denotes the frozen Stage D pre-change-evidence eligibility label. All 223 targets satisfy it. |
| `scan_status` | `completed` means the target has a completed frozen RQ2 evaluation; `unavailable` means the pipeline did not reach that state. It is a target-level outcome, not a raw process exit code. |
| `finding_count` | Number of final findings for a completed target. Zero is a completed empty report. Blank means unavailable, not zero findings. |
| `best_content_grade` | Maximum final content grade among the target's findings: 0, 1, or 2. Blank for an empty completed report or unavailable target; use `scan_status` and `finding_count` to distinguish these. |
| `strict_hit` | `true` iff at least one individual finding has grade 2 and matches the primary position criterion: same file and within +/-10 lines. Otherwise `false`. |
| `lenient_hit` | `true` iff at least one individual finding has grade 1 or 2 and meets that same position criterion. Otherwise `false`. Includes strict hits. |

Grade 2 requires the same boundary, the same gap, and all core aspects.
Grade 1 covers a related/partial or adjacent gap at the same boundary.
Grade 0 denotes an unrelated gap or a different boundary. Content and position
cannot be borrowed from different findings to construct a hit. The supplementary
same-function criterion is not used for the two primary hit fields.

Unavailable targets have both hit flags set to `false` for the full-cohort
denominator only; this does not assert an observed scanner miss. Do not interpret
a target's best content grade as a position match or as the distribution of all
its findings.

## Frozen-result checks

The table has **206 completed** and **17 unavailable** targets. The completed
targets contain **393 findings**, with final grades **342 / 47 / 4** for
grades 0 / 1 / 2, respectively. Forty completed targets have empty reports.
There are **2 strict** and **22 lenient** target hits.

| Primary measure | Completed-target denominator | Full-cohort denominator |
| --- | --- | --- |
| Strict Recall | 2 / 206 = 0.970874% | 2 / 223 = 0.896861% |
| Lenient Recall | 22 / 206 = 10.679612% | 22 / 223 = 9.865471% |

The CSV directly supports the target counts, findings total, and two Recall
denominators. The full grade distribution is checked against the frozen
finding-level source and recorded in `verification.json`; it cannot be
reconstructed from a per-target maximum alone. No human-adjusted grades or
results from the independent extension replace these frozen model outcomes.

## Privacy and integrity

No evaluated code, diff, report prose, reason/justification field, actual target
source identifier, author identity, affiliation, internal URL, or absolute
filesystem path is included in the outcome table. The other materials were also
screened for identifying strings. Generic schema examples (such as the example
integer in a prompt's `pr_id` field) and uninstantiated template variables are
not experimental target identifiers.

The complete skill is included for methodological inspection; its synthetic
code examples must not be mistaken for disclosed production code. There is no
target-to-source mapping in this directory or ZIP. No service is started and no
new model call or experiment run is needed to inspect these materials.

Verify the extracted directory with a SHA-256 utility against `SHA256SUMS`.
The enclosing ZIP has a separate checksum receipt outside the ZIP to avoid
self-referential hashing.
