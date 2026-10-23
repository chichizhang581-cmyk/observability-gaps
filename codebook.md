# Observability Gap Codebook

You are coding a merged pull request (PR) that improves production observability. Read the
PR metadata, the changed files, the diff, and the base-version code around each hunk. Decide
**where the diagnostic evidence chain was broken before this PR**, and assign exactly one of
four categories.

**Terms.** *Diagnostic evidence* is any runtime information about the service: logs,
exception context, metrics, traces, health signals and alerts. *Operators* are the engineers
who run and diagnose the service (service owners, on-call engineers). Customers and tenant
administrators are not operators.

## Scope

Code only PRs where **all** net changes are one observability improvement plus its direct
support (configuration wiring, helpers, tests, documentation). Otherwise stop and record why:

- **No enhancement.** The PR does not change what operators can observe about the running
  service. This includes:
  - business data written through logging or alert APIs, such as audit records of user
    reports, customer-facing security alerts, or reports for tenant administrators;
  - maintenance that leaves capability unchanged, such as renewing metric expiry dates,
    retiring a flag that was already on everywhere, moving a value to another field,
    rewording messages, or refactoring;
  - logging that belongs to a brand-new feature rather than to existing behavior;
  - test or CI output only, or deleting telemetry.
- **Mixed.** The PR also changes business behavior, results, state, or execution and
  recovery policy, however small or related the change is. Changes to monitoring components
  themselves (probes, collectors, exporters) count as observability changes, not business
  behavior.
- **Multiple improvements.** The PR contains two or more improvements that could each stand
  on their own, even if they serve one overall goal. Applying the same improvement in many
  places is still one improvement.

## The evidence chain

Diagnostic evidence passes through four links:

1. **Produced.** The system emits the information at all.
2. **Correct.** What it emits is accurate and unambiguous.
3. **Delivered.** It is collected, transported, stored and retained.
4. **Usable.** Operators can query it, classify it, alert on it, or judge health from it.

The category records the link that this PR repairs. "Produced" means emitted: evidence that
the code computes but then discards (a swallowed exception, a wrapper that drops the inner
exception) was not produced.

The category describes the gap as the fix reveals it. It does not claim the gap was visible
before the fix; that is judged separately from the base code.

**Judge by what was broken, not by what was edited.** An exception type, log call, metric
API, span or file name in the diff does not decide the category on its own. Compare what
operators could observe in the base version with what they can observe after the PR, and
ask what the change is for. Do not rely on the PR title, keywords or the author's
description in place of the diff.

## Decision procedure

Ask the questions in order and stop at the first match.

1. Did the base code already produce this information?
   - Yes, but it was wrong → **cat2**.
   - Yes, and it was correct → go to question 3.
   - No → go to question 2.
2. The information was missing. Is the gap tied to a specific point in the code?
   - Yes: a catch block, error return, timeout, cancellation, retry, fallback or recovery
     path, or the code where a specific known misbehavior arises, fails to record what is
     needed to explain what happens there → **cat1**.
   - No: nothing in the code is wrong; the PR adds visibility of normal operation, progress,
     performance, aggregate behavior or the execution chain → **cat3**.
3. The information existed and was correct. Did it fail to reach operators, or could they
   not act on it? → **cat4**.

The questions are ordered, so every coded PR receives exactly one category. If a PR seems to
fit two, the first matching question decides.

If none of the four categories applies, set `category` to `other`, describe the gap, and
explain why no category fits. Do not force a fit.

---

## cat1 Missing failure evidence

**Definition.** At a specific point in the code where something fails (an error, timeout,
cancellation, retry, fallback or recovery), the evidence needed to explain it was never
produced or was discarded before being emitted. Without it, the cause, the path or the
recovery outcome could not be distinguished, correlated or reconstructed. Because the gap is
tied to an identifiable point, it can be judged from the code alone.

**Includes**
- adding the cause, exception chain, stack, error code, operation or object identifiers,
  request correlation or state to the record of a failure;
- making a timeout, retry or recovery mechanism explainable: configured limit vs actual
  time, timeout vs cancellation, retry count, the reason retries ran out, or how long
  something stayed stuck;
- adding dimensions to a failure metric that identify which failure occurred;
- logging on the normal path when its purpose is to trace a specific misbehavior.

**Excludes**
- The failure is already recorded but goes into the wrong monitoring bucket or cannot be
  queried → cat4.
- The failure record exists but its content is garbled → cat2.
- Retries added to a monitoring probe to reduce false alarms → cat4.

**Examples**
- A session can sit in a deferred-cleanup queue indefinitely and is re-queued silently on
  lock failure or when the database is offline. The PR records when the delay started, the
  reason for each re-queue, and a one-time alert when a threshold is passed.
- Before each mailbox-in-transit retry, the PR logs the mailbox state and a retry marker.
  Before this, only one exception path was logged, so neither the number of attempts nor the
  state at each attempt could be reconstructed.
- The PR logs every set and reset of a calendar sharing flag with its old value, new value
  and caller, because the flag is being lost silently. The log sits on the normal path, but
  its purpose is a failure investigation.
- An audit-write failure metric always reported one fixed scenario. The PR adds record-type
  and operation dimensions, so it now shows which record type and operation failed.

---

## cat2 Distorted evidence

**Definition.** The system already tried to produce the evidence, but a fault you can point
to in formatting, parameter binding, encoding or conversion, value assignment, or the code
that builds or passes that record made it wrong, ambiguous or lost. The fix restores the
intended evidence. The base code must show the intent: a field, placeholder, parameter or
event that was meant to carry the information.

**Includes**
- a placeholder that doesn't match its argument, a wrong format specifier, or a wrong
  identifier conversion;
- several values joined into one field, or a value overwritten, when a single value was
  intended;
- fields left empty by a wiring bug, or values redacted by mistake;
- an event emitted when the condition it reports did not happen.

**Excludes**
- Information that was never recorded and is now added for the first time → cat1 or cat3.
- Correct evidence that downstream monitoring classifies wrongly, for example an error put
  in the server-error bucket when it is a client error → cat4. The test: in cat2 the
  recorded fact itself is wrong; in cat4 the fact is right, but how it is used is wrong.
- Moving a value to another field with no change in content or trigger → no enhancement.
- The pipeline that carries all records (collector, exporter, transport, storage) loses
  them → cat4. cat2 covers faults in how one specific record is built or passed.

**Examples**
- An error tracker appended each error code to the same field, so a batch with several
  errors produced one combined string. Switching to a single-value write makes the field
  groupable by error code again.
- A diagnostic report formatted a 32-bit value with a 16-bit format specifier, which
  truncated it.
- Tenant identifiers were converted with the wrong GUID converter, so logs carried wrong
  tenant IDs.
- A message-drop event also fired for messages that had been delivered successfully. The fix
  emits it only when delivery actually failed.

---

## cat3 Invisible runtime behavior

**Definition.** Normal operation, progress, performance, aggregate behavior or the execution
chain could not be seen because no evidence of it was produced. The PR adds that visibility.
Unlike cat1, the gap is not tied to a specific point in the code where something fails:
nothing in the code is wrong, and whether the behavior should be observed depends on what
operators need to ask.

**Includes**
- timings or counts per component or dependency, cache hit/miss and latency, I/O
  statistics;
- progress and state logs for normal processing;
- spans, parent-child span relations, and propagating shared context so that the steps of
  one run can be correlated;
- new aggregation dimensions on existing metrics.

**Excludes**
- Visibility added to explain a specific failure or recovery → cat1, whatever the carrier.
- A value that already exists and only needs to become a queryable column or label → cat4.
- Using a tracing API only to get an identifier that is then written into a log → judge by
  the purpose of the log.
- Correlation identifiers added for a specific failure investigation → cat1. General
  correlation that serves all requests stays in cat3.

**Examples**
- Time spent in authentication, directory and store dependencies is added up per request
  and emitted as a dependency list. Before, only the total request time was recorded.
- A directory cache lookup gains a sampled metric for hits, misses and latency. Before, the
  lookup was silent.
- A search pipeline gains storage I/O statistics (bytes read, blocks read, decryption time,
  call counts), and the base mapper had a TODO for exactly these fields.
- A background assistant keeps its own scenario, so every step of one mailbox run shares a
  single activity ID.

---

## cat4 Evidence not delivered or not usable

**Definition.** The evidence was produced and was correct, but it was not reliably
collected, transported, stored or retained, or operators could not act on it: it could not
be queried, it went into the wrong monitoring bucket, it did not feed a health verdict or
alert, or it was never presented. Record which of the two applies in `broken_link`
(`delivered` or `usable`), so the category can be split when reporting.

**Includes**
- **Delivery:** fixing a collector, adding an exporter or sink, fixing telemetry loss,
  changing retention.
- **Usability:** turning an existing value into a queryable column or label; routing an
  action that was already recorded to the query surface operators use.
- **Classification:** moving existing errors between client and server buckets for QoS or
  SLA; making probes distinguish "target unhealthy" (Failure) from "probe broken" (Error);
  mapping event sources out of an UNKNOWN bucket.
- **Health verdicts and alerting:** alert rules on existing signals, health summaries,
  dashboards, and probe changes that make a verdict more reliable without adding diagnostics.

**Excludes**
- Adding a metric or log that did not exist → cat1 or cat3. An alert built on an existing
  metric is cat4.
- Error logging added at a failure point inside a telemetry component → cat1. Judge by the
  content, not by the component's name.
- Business alerts or reports for customers → no enhancement.

**Examples**
- A native statistics collection call used a wrong struct size and device path, so
  collection failed. Fixing the call restores the data.
- A service wrote logs only to local files. The PR adds a central telemetry exporter
  alongside them.
- A fallback action was already logged when it ran. The PR carries it into the
  message-trace detail query, where operators look.
- A traffic subtype existed only inside a JSON payload. The PR emits it as its own queryable
  column.
- Several active-monitoring probes threw a generic exception, so a failing target could not
  be told apart from a broken probe. They now throw a dedicated probe-failure exception.
- Two "missing meeting parameter" error codes are moved into the client-error bucket, so
  they no longer count against the server SLA.
- An SMTP health probe gains retries, so transient failures stop raising false alarms.

---

## Output

Return one JSON object:

```json
{
  "scope": "coded | no_enhancement | mixed | multiple_improvements",
  "scope_reason": "one sentence",
  "category": "cat1 | cat2 | cat3 | cat4 | other | ",
  "broken_link": "produced | correct | delivered | usable | ",
  "confidence": "high | low",
  "before": "what operators could observe in the base version",
  "after": "what they can observe after the PR",
  "category_reason": "why this link, citing the base code and the diff",
  "base_evidence": [{"path": "", "location": "", "excerpt": ""}]
}
```

Leave `category` and `broken_link` empty unless `scope` is `coded`. If materials are missing
or the category is uncertain, set `confidence` to `low` and explain in `category_reason`
instead of guessing.
