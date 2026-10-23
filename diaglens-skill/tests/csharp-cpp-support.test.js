'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const pluginRoot = path.join(__dirname, '..');
const skillRoot = path.join(pluginRoot, 'skills', 'diaglens');
const patterns = JSON.parse(fs.readFileSync(
  path.join(skillRoot, 'references', 'csharp-cpp-patterns.json'),
  'utf8',
));
const expectations = JSON.parse(fs.readFileSync(
  path.join(__dirname, 'fixtures', 'csharp-cpp-expectations.json'),
  'utf8',
));
const skill = fs.readFileSync(path.join(skillRoot, 'SKILL.md'), 'utf8');
const readme = fs.readFileSync(path.join(pluginRoot, 'README.md'), 'utf8');

function matchesAny(source, expressions) {
  return expressions.some((expression) => new RegExp(expression, 'im').test(source));
}

test('language catalog is scoped exclusively to C# and C++ extensions', () => {
  assert.deepStrictEqual(Object.keys(patterns.languages).sort(), ['cpp', 'csharp']);
  assert.deepStrictEqual(patterns.languages.csharp.extensions, ['.cs', '.csx']);
  assert.deepStrictEqual(
    patterns.languages.cpp.extensions,
    ['.cc', '.cpp', '.cxx', '.h', '.hh', '.hpp', '.hxx'],
  );
});

test('C# logging patterns distinguish LoggerMessage attributes from EventId evidence', () => {
  const csharp = patterns.languages.csharp.evidence_patterns;
  assert.ok(matchesAny('[LoggerMessage(EventId = 42)]', csharp.logging));
  assert.ok(!matchesAny('[EventId(42)]', csharp.logging));
  assert.ok(matchesAny('var eventId = new EventId(42);', csharp.structured_fields));
});

test('fixture boundaries and evidence are discoverable by the declared language patterns', () => {
  for (const [fixtureName, expected] of Object.entries(expectations)) {
    const source = fs.readFileSync(path.join(__dirname, 'fixtures', fixtureName), 'utf8');
    const language = patterns.languages[expected.language];

    for (const boundary of expected.boundaries) {
      assert.ok(
        matchesAny(source, language.boundary_patterns[boundary]),
        `${fixtureName} did not match boundary ${boundary}`,
      );
    }
    for (const evidence of expected.evidence) {
      assert.ok(
        matchesAny(source, language.evidence_patterns[evidence]),
        `${fixtureName} did not match evidence ${evidence}`,
      );
    }
  }
});

test('all patterns compile and every language covers core failure and evidence categories', () => {
  const coreBoundaries = [
    'external_http_call',
    'db_call',
    'queue_producer',
    'queue_consumer',
    'filesystem_io',
    'catch_block',
    'retry_loop',
    'timeout_handler',
    'state_change',
    'endpoint',
    'webhook',
    'async_consumer',
  ];
  const coreEvidence = [
    'logging',
    'structured_fields',
    'exception_context',
    'status_error',
    'correlation',
    'latency',
    'retry_timeout',
    'state_context',
  ];

  for (const [languageName, language] of Object.entries(patterns.languages)) {
    for (const category of coreBoundaries) {
      assert.ok(language.boundary_patterns[category]?.length, `${languageName} lacks ${category}`);
    }
    for (const category of coreEvidence) {
      assert.ok(language.evidence_patterns[category]?.length, `${languageName} lacks ${category}`);
    }
    for (const expressions of [
      ...Object.values(language.boundary_patterns),
      ...Object.values(language.evidence_patterns),
    ]) {
      for (const expression of expressions) {
        assert.doesNotThrow(() => new RegExp(expression, 'im'), `${languageName}: ${expression}`);
      }
    }
  }
});

test('skill and README preserve Python/TypeScript and add C#/C++ source analysis', () => {
  for (const text of [skill, readme]) {
    for (const language of ['Python', 'TypeScript', 'C#', 'C++']) {
      assert.match(text, new RegExp(language.replace(/[+#]/g, '\\$&')));
    }
    assert.match(text, /source-level/i);
  }
  assert.match(skill, /csharp-cpp-patterns\.json/);
  assert.match(skill, /Repository-scan deterministic pre-scan/);
  assert.match(skill, /Function-level clustering/);
  assert.match(skill, /risk_score = boundary_risk \+ evidence_weakness \+ impact_modifiers - evidence_credits/);
  assert.match(readme, /must not feed whole repositories or large file sets directly to the LLM/);
  assert.match(skill, /Python and TypeScript continue to use the existing[\s\S]*not routed through this catalog/);
  assert.match(skill, /ItemPath endswith "\.tsx"/);
  assert.match(skill, /\.csx/);
  assert.match(skill, /\.hxx/);
  assert.match(skill, /ILogger/);
  assert.match(skill, /spdlog/);
  assert.match(patterns.purpose, /Python and TypeScript.*intentionally excluded/);
});
