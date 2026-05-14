import React, { useMemo } from 'react';

const PILLARS = [
  {
    id: 'operations',
    label: 'Operations',
    description: 'Parsed JSDoc for each API function (ast.json).',
    check: (a) => a.operationCount > 0,
  },
  {
    id: 'credentials',
    label: 'Credentials',
    description: 'JSON Schema describing required credentials.',
    check: (a) => a.hasConfigurationSchema,
  },
  {
    id: 'snippets',
    label: 'Snippets',
    description: 'CREATE / SEARCH usage examples per adapter.',
    check: (a) => a.snippetCount > 0,
  },
  {
    id: 'triggers',
    label: 'Triggers',
    description: 'Vendor events the adapter can react to.',
    check: (a) => a.triggerCount > 0,
  },
  {
    id: 'dataSchemas',
    label: 'Data schemas',
    description: 'Payload shape that arrives with each trigger.',
    check: (a) => a.dataSchemaCount > 0,
  },
  {
    id: 'metadata',
    label: 'Source metadata',
    description: 'Vendor links + spec sources (metadata.json).',
    check: (a) => a.hasMetadata,
  },
];

const STATUS_ORDER = ['complete', 'partial', 'stub', 'unset'];
const STATUS_TINT = {
  complete: 'bg-emerald-100 text-emerald-800',
  partial: 'bg-amber-100 text-amber-800',
  stub: 'bg-slate-200 text-slate-700',
  unset: 'bg-slate-100 text-slate-500',
};

const SOURCE_KINDS = [
  'openapi',
  'wsdl',
  'graphql-schema',
  'asyncapi',
  'postman-collection',
  'json-schema',
  'docs-index',
  'docs-page',
  'sdk-repo',
  'changelog',
  'sandbox',
];

export default function SystemOverview({ adapters, onSelect }) {
  const stats = useMemo(() => computeStats(adapters), [adapters]);

  if (adapters.length === 0) {
    return <div className="p-8 text-slate-400">No adapters loaded.</div>;
  }

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-slate-200 px-8 py-6">
        <h1 className="text-2xl font-semibold text-slate-900">
          Adapter Library — Overview
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          A bird's-eye assessment of how complete our adapter coverage is across{' '}
          <strong>{stats.totalAdapters}</strong> adapters. Each pillar below is
          one slice of "what we know about a connected system."
        </p>
      </header>

      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="max-w-5xl space-y-8">
          <CompletenessSection stats={stats} />
          <PillarSection
            stats={stats}
            adapters={adapters}
            onSelect={onSelect}
          />
          <div className="grid gap-6 md:grid-cols-2">
            <StatusSection stats={stats} />
            <ApiStyleSection stats={stats} />
          </div>
          <SourceCoverageSection stats={stats} />
          <NeedsAttentionSection
            stats={stats}
            adapters={adapters}
            onSelect={onSelect}
          />
        </div>
      </div>
    </div>
  );
}

function computeStats(adapters) {
  const totalAdapters = adapters.length;

  const pillarCounts = Object.fromEntries(
    PILLARS.map((p) => [p.id, adapters.filter((a) => p.check(a)).length])
  );

  const pillarsPerAdapter = adapters.map(
    (a) => PILLARS.filter((p) => p.check(a)).length
  );
  const overallScore =
    pillarsPerAdapter.reduce((s, n) => s + n, 0) /
    (totalAdapters * PILLARS.length);

  const statusCounts = STATUS_ORDER.reduce((acc, s) => {
    acc[s] = 0;
    return acc;
  }, {});
  for (const a of adapters) {
    const s = a.status || 'unset';
    statusCounts[s] = (statusCounts[s] || 0) + 1;
  }

  const apiStyleCounts = {};
  for (const a of adapters) {
    const k = a.apiStyle || 'unknown';
    apiStyleCounts[k] = (apiStyleCounts[k] || 0) + 1;
  }

  const sourceCounts = Object.fromEntries(SOURCE_KINDS.map((k) => [k, 0]));
  for (const a of adapters) {
    for (const k of a.sourceKinds || []) {
      if (k in sourceCounts) sourceCounts[k] += 1;
      else sourceCounts[k] = 1;
    }
  }

  const totals = {
    operations: sum(adapters, 'operationCount'),
    snippets: sum(adapters, 'snippetCount'),
    triggers: sum(adapters, 'triggerCount'),
    dataSchemas: sum(adapters, 'dataSchemaCount'),
  };

  const empty = adapters.filter(
    (a) =>
      !a.hasMetadata &&
      a.operationCount === 0 &&
      a.snippetCount === 0 &&
      a.triggerCount === 0
  );

  const missingMetadata = adapters.filter((a) => !a.hasMetadata);
  const missingCredentials = adapters.filter((a) => !a.hasConfigurationSchema);

  return {
    totalAdapters,
    pillarCounts,
    overallScore,
    statusCounts,
    apiStyleCounts,
    sourceCounts,
    totals,
    empty,
    missingMetadata,
    missingCredentials,
  };
}

function sum(list, key) {
  return list.reduce((acc, a) => acc + (a[key] || 0), 0);
}

function CompletenessSection({ stats }) {
  const pct = Math.round(stats.overallScore * 100);
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Overall completeness
        </h2>
        <div className="text-sm text-slate-500">
          {PILLARS.length} pillars × {stats.totalAdapters} adapters
        </div>
      </div>
      <div className="mt-3 flex items-baseline gap-3">
        <span className="text-5xl font-semibold text-slate-900">{pct}%</span>
        <span className="text-sm text-slate-500">
          of the six pillars are filled in, on average
        </span>
      </div>
      <div className="mt-4 h-2 w-full overflow-hidden rounded bg-slate-100">
        <div
          className="h-full bg-emerald-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Tally label="Operations" value={stats.totals.operations} />
        <Tally label="Snippets" value={stats.totals.snippets} />
        <Tally label="Triggers" value={stats.totals.triggers} />
        <Tally label="Data schemas" value={stats.totals.dataSchemas} />
      </div>
    </section>
  );
}

function PillarSection({ stats, adapters, onSelect }) {
  const total = stats.totalAdapters;
  return (
    <section>
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
        Coverage by pillar
      </h2>
      <ul className="space-y-2">
        {PILLARS.map((p) => {
          const count = stats.pillarCounts[p.id] || 0;
          const pct = total ? Math.round((count / total) * 100) : 0;
          return (
            <li
              key={p.id}
              className="rounded border border-slate-200 bg-white p-4"
            >
              <div className="flex items-baseline justify-between gap-3">
                <div>
                  <div className="font-medium text-slate-900">{p.label}</div>
                  <div className="text-xs text-slate-500">{p.description}</div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-sm font-mono text-slate-700">
                    {count} / {total}
                  </div>
                  <div className="text-xs text-slate-500">{pct}%</div>
                </div>
              </div>
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded bg-slate-100">
                <div
                  className="h-full bg-slate-700"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function StatusSection({ stats }) {
  const total = stats.totalAdapters;
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
        Self-reported status
      </h2>
      <ul className="space-y-1.5 text-sm">
        {STATUS_ORDER.map((s) => {
          const count = stats.statusCounts[s] || 0;
          const pct = total ? Math.round((count / total) * 100) : 0;
          return (
            <li key={s} className="flex items-center gap-3">
              <span
                className={`w-20 shrink-0 rounded px-2 py-0.5 text-center text-xs font-mono ${STATUS_TINT[s]}`}
              >
                {s}
              </span>
              <div className="flex-1 h-1.5 overflow-hidden rounded bg-slate-100">
                <div
                  className="h-full bg-slate-700"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="w-16 text-right font-mono text-xs text-slate-600">
                {count} ({pct}%)
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function ApiStyleSection({ stats }) {
  const entries = Object.entries(stats.apiStyleCounts).sort(
    (a, b) => b[1] - a[1]
  );
  const total = stats.totalAdapters;
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
        API style
      </h2>
      <ul className="space-y-1.5 text-sm">
        {entries.map(([style, count]) => {
          const pct = total ? Math.round((count / total) * 100) : 0;
          return (
            <li key={style} className="flex items-center gap-3">
              <span className="w-20 shrink-0 rounded bg-slate-100 px-2 py-0.5 text-center text-xs font-mono text-slate-700">
                {style}
              </span>
              <div className="flex-1 h-1.5 overflow-hidden rounded bg-slate-100">
                <div
                  className="h-full bg-slate-700"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="w-16 text-right font-mono text-xs text-slate-600">
                {count} ({pct}%)
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function SourceCoverageSection({ stats }) {
  const total = stats.totalAdapters;
  const entries = Object.entries(stats.sourceCounts)
    .filter(([, c]) => c > 0)
    .sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return null;
  return (
    <section>
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
        Source coverage (adapters with at least one URL of each kind)
      </h2>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {entries.map(([kind, count]) => {
          const pct = total ? Math.round((count / total) * 100) : 0;
          return (
            <li
              key={kind}
              className="flex items-center gap-3 rounded border border-slate-200 bg-white px-3 py-2"
            >
              <span className="w-32 shrink-0 truncate rounded bg-slate-100 px-2 py-0.5 text-center text-xs font-mono text-slate-700">
                {kind}
              </span>
              <div className="flex-1 h-1.5 overflow-hidden rounded bg-slate-100">
                <div
                  className="h-full bg-slate-700"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="w-16 text-right font-mono text-xs text-slate-600">
                {count} ({pct}%)
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function NeedsAttentionSection({ stats, adapters, onSelect }) {
  const skeletal = adapters
    .filter(
      (a) =>
        a.operationCount === 0 &&
        a.snippetCount === 0 &&
        a.triggerCount === 0
    )
    .slice(0, 12);
  const noMetadata = stats.missingMetadata.slice(0, 12);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
        Needs attention
      </h2>
      <div className="grid gap-6 md:grid-cols-2">
        <AttentionList
          title="No operations, snippets, or triggers"
          subtitle={`${
            adapters.filter(
              (a) =>
                a.operationCount === 0 &&
                a.snippetCount === 0 &&
                a.triggerCount === 0
            ).length
          } adapter(s)`}
          items={skeletal}
          onSelect={onSelect}
        />
        <AttentionList
          title="Missing metadata.json"
          subtitle={`${stats.missingMetadata.length} adapter(s)`}
          items={noMetadata}
          onSelect={onSelect}
        />
      </div>
    </section>
  );
}

function AttentionList({ title, subtitle, items, onSelect }) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <div className="text-sm font-medium text-slate-800">{title}</div>
        <div className="text-xs text-slate-500">{subtitle}</div>
      </div>
      {items.length === 0 ? (
        <div className="text-sm text-emerald-700">None — nice.</div>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {items.map((a) => (
            <li key={a.name}>
              <button
                onClick={() => onSelect(a.name)}
                className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700 hover:bg-slate-200 hover:text-slate-900"
              >
                {a.label || a.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Tally({ label, value }) {
  return (
    <div className="rounded border border-slate-100 bg-slate-50 px-3 py-2">
      <div className="text-2xl font-semibold text-slate-900">{value}</div>
      <div className="text-xs uppercase tracking-wider text-slate-500">
        {label}
      </div>
    </div>
  );
}
