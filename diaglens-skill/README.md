# DiagLens

DiagLens is a diagnosability scanner for PRs and repositories that reviews failure-relevant paths where runtime evidence is missing. It names the **boundary**, the **missing diagnostic evidence**, and the **concrete failure** that would become hard to diagnose.

DiagLens is not a generic logging linter; it identifies code paths where failures would be hard to explain from runtime evidence. The first version focuses on logs and structured exception context for Python, TypeScript, C#, and C++, leaving full metrics and tracing support for later versions.

## How it works

The plugin ships a single skill, [`diaglens`](skills/diaglens/SKILL.md), which is auto-invoked when you ask for a diagnosability/observability review of changed code or a repository. It runs the structured 5-step workflow described under [Agent Design](#agent-design) and emits PR comments, a ranked markdown report, JSON, or optional SARIF.

Two modes:

- **PR review** — prevent new diagnosability debt before merge.
- **Repository scan** — discover accumulated diagnosability debt in existing systems.

## Try it on your service

Just ask, in plain language, for the review you want — DiagLens does the rest:

- **Review a PR:** *"Review this PR for diagnosability."*
- **Scan a repo:** *"Scan the payment service for diagnosability debt (Python only)."*

| Mode | You give | You get |
|------|----------|---------|
| **PR review** | A pull request or diff | Review comments on changed boundaries — each names the boundary, the missing evidence, and the failure it would make hard to diagnose |
| **Repository scan** | A repo, optionally scoped to a folder/language | A ranked report of the riskiest boundaries and repeated evidence gaps, plus where to fix first (also available as JSON or SARIF) |

**Where the code comes from.** DiagLens reads code from whatever is available, in this order, so you usually don't configure anything:

1. **Your local workspace** — zero setup; used automatically if the service is checked out.
2. **Bluebird** — for an Azure DevOps service when you want call-graph-aware review (fewer false positives). One-time setup: fill in your repo details in [.mcp.json](.mcp.json).
3. **CloudMine** — for an Azure DevOps or GitHub-public service you haven't cloned (or when Bluebird isn't available). DiagLens fetches the source on your behalf (needs `az login` with CloudMine access).

You don't run any queries yourself — DiagLens fetches and analyzes the code for you.

---

The remainder of this document is the design spec the plugin implements.

## Application Scenarios

### 1. PR Review Mode

PR mode prevents new diagnosability debt before merge.

Input: a PR diff plus surrounding repository context.

Output: review comments on changed code that introduces or modifies failure-relevant boundaries.

The agent should comment only when it can name the boundary, the missing evidence, and the concrete failure that would become hard to diagnose.

Example output:

```text
High diagnosability risk: this payment-provider call logs only "payment failed".
Missing evidence: provider, order_id, status_code, latency_ms, retry_count, exception cause.
Why it matters: a timeout or 503 cannot be distinguished from invalid order state.
```

### 2. Repository Scan Mode

Repo mode discovers accumulated diagnosability debt in existing systems.

Input: a repository, optionally scoped to selected services, folders, or languages.

Output: a ranked report of high-risk boundaries, repeated evidence gaps, service-level remediation priorities, and funnel counts showing how the scan moved from files to raw hits to clusters to reviewed findings.

Repository scans must not feed whole repositories or large file sets directly to the LLM. They start with a deterministic pre-scan that inventories supported files, extracts raw boundary/evidence hits, clusters hits into function-level review units, filters noise, assigns deterministic risk scores, and then gives the agent only compact evidence bundles for the highest-risk clusters.

The report should prioritize where to fix first, not list every weak log statement.

Example output:

```text
payment service: high risk
- Stripe calls miss status_code or latency in 7/9 sites.
- DB transaction failures use generic catch blocks in 5 sites.
- Queue producers often omit job_id and correlation_id.
```

## Agent Design

The agent runs a structured review workflow rather than free-form code critique.

### Step 1: Boundary Discovery

The agent first finds code locations where runtime failures require diagnosis.

Target boundaries include external HTTP/RPC calls, DB/cache/queue/filesystem calls, catch blocks, retry loops, timeout handlers, fallbacks, state-changing operations, endpoints, background jobs, webhook handlers, and async consumers.

Python and TypeScript retain the existing boundary-discovery workflow. The C#/C++ extension adds deterministic candidate discovery for:

- **C# (`.cs`, `.csx`)** — `HttpClient`, ADO.NET/Dapper/EF, queue senders/processors, file/stream I/O, typed catches, Polly retries, cancellation/timeouts, controller/minimal APIs, `Task`/async consumers, and state-changing transactions.
- **C++ (`.cc`, `.cpp`, `.cxx`, `.h`, `.hh`, `.hpp`, `.hxx`)** — common HTTP/DB/queue/I/O APIs, typed or catch-all handlers, retry/deadline paths, futures/coroutines/callbacks, error-code flows, and state mutations.

### Step 2: Evidence Extraction

For each boundary, the agent extracts nearby observability signals.

Signals include log statements, exception reporting, structured fields, propagated request IDs, status/error codes, latency measurements, retry counts, timeout values, dependency names, entity IDs, and state-transition context. DiagLens recognizes idiomatic `ILogger` templates, `LoggerMessage`, Serilog/NLog, exception arguments, `Activity`, and `Stopwatch` evidence in C#, plus project logging macros, glog/spdlog/Boost.Log/Quill, `std::exception`, nested exceptions, `std::error_code`, `errno`, and chrono evidence in C++.

### Step 3: Sufficiency Judgment

The agent judges whether the available evidence can explain a realistic failure at that boundary.

The judgment should be boundary-specific: an HTTP dependency call needs dependency, operation, status/error code, latency, request/correlation ID, and exception cause, while a queue producer needs queue name, message/job ID, entity ID, enqueue result, and exception cause.

### Step 4: Risk Ranking

For PR review, the agent ranks changed boundaries by operational impact. For repository scans, ranking starts from the deterministic pre-scan score, then contextual review adjusts only the final emitted risk and confidence when caller or wrapper evidence changes the diagnosis.

High-risk sites combine state mutation, external dependency, swallowed exception, retry/fallback logic, user-facing request paths, or weak generic telemetry.

### Step 5: Actionable Output

The agent outputs a concise diagnosis, missing evidence list, failure implication, and suggested instrumentation.

The suggestion should explain what evidence to emit and why it matters, not simply ask for more logs.

## Implementation Shape

The easiest implementation is an agent with deterministic tools underneath.

Use tree-sitter, Semgrep, regular expressions, or language-server queries to extract candidate boundaries and observability statements. In repository-scan mode, run that extraction over the full resolved scope before any LLM review. Persist or report the funnel: file inventory, raw hits, function-level clusters, noise-filtered clusters, scored clusters, LLM-triaged clusters, deep-reviewed clusters, findings, and reviewed-not-emitted items.

Function-level clustering collapses many line-level hits into the smallest source region where a failure can be understood: normally a method/function/constructor/lambda, route handler, webhook handler, queue/background consumer, or scheduled-job callback. A cluster keeps the boundary categories, evidence categories, source range, hit counts, and nearby caller/wrapper links, but repeated `await`, `Task`, `Update`, `Set`, or logging hits are not treated as separate findings.

Risk scoring is deterministic and is used to allocate token budget, not to replace final judgment. Score each cluster as boundary risk plus evidence weakness plus impact modifiers minus evidence credits. External calls, persistent storage, queue consumers, durable state mutation, fail-soft returns, swallowed exceptions, retry/fallback paths, and user-facing endpoints raise the score. Structured exception/error-code evidence, status codes, operation/entity IDs, correlation IDs, latency, terminal retry outcome, timeout classification, and verified caller/wrapper evidence lower the score. The agent then reviews only compact evidence bundles for ranked clusters rather than entire files.

This keeps detection reproducible while using the agent for context-sensitive reasoning and concise review output.

Python and TypeScript continue to use that existing workflow unchanged. For C# and C++,
the shipped deterministic [candidate-pattern catalog](skills/diaglens/references/csharp-cpp-patterns.json)
seeds the same contextual agent judgment. This C#/C++ path is source-level, skill-guided
analysis, not a compiled semantic analyzer: pattern matches are candidates rather than
findings, and overloaded calls, wrappers, macros, templates, generated code, and dynamic
dispatch may require lower confidence. The MVP supports all four languages, logs and
exception/error-code context, PR comments, repo markdown reports, JSON output, and optional
SARIF export.

## Evaluation

The first evaluation should reuse our paper's RQ1 setup: remove human-written observability code and test whether DiagLens detects the missing source-level diagnostic evidence.

### Primary Evaluation: RQ1-Style Stripped-Code Detection

Construct instances by taking functions or files with human-written observability, removing their observability statements, and giving the stripped code to DiagLens.

The removed observability statements serve as the reference for where evidence was expected and which diagnostic concepts were present.

DiagLens succeeds when it reports the missing failure-relevant boundary and names the diagnostic evidence that was removed.

Map the paper's RQ1 metrics directly:

```text
Position F1 -> whether DiagLens localizes the right business location or failure boundary.
KeyBag F1  -> whether DiagLens recovers the removed diagnostic concepts, variables, keys, and context.
```

DiagLens output should be structured as JSON so Position F1 and KeyBag F1 can be computed without interpreting free-form comments.

Example output schema:

```json
{
  "boundary": "external_http_call",
  "location": "payment/service.py:132",
  "missing_evidence": ["provider", "order_id", "status_code", "latency_ms"],
  "failure_implication": "cannot distinguish provider timeout from invalid order state"
}
```


### Baseline Comparison

Compare DiagLens against a generic LLM reviewer, an observability-prompted LLM reviewer, Semgrep/static-rule detectors, and a scanner agent without structured boundary extraction.

The key question is whether DiagLens detects diagnosis-oriented missing evidence better than tools that only notice missing logs.

### Product-Facing Follow-Up Evaluation

After the RQ1-style evaluation works, evaluate the two application scenarios directly.

For PR mode, use real PRs, agent-generated PRs, and injected diagnosability-defect PRs.

Metrics: comment correctness, actionability, developer acceptance rate, fix correctness, and review-noise rate.

For repo mode, use human-audited repository samples and measure whether the top-ranked issues are worth fixing.

Metrics: top-k precision, high-risk recall@k, NDCG, duplicate rate, and false-positive burden.


## Claim Boundary

DiagLens does not prove functional correctness or complete observability.

The first intended claim is narrower: on RQ1-style stripped-code instances, DiagLens identifies missing source-level diagnostic evidence with higher Position F1 and KeyBag F1 than generic review baselines.

A later runtime claim should be made only after RQ2-style fault injection shows that DiagLens-guided fixes improve strict fault-specific runtime evidence under covered faults.
