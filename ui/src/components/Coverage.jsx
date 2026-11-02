import React, { useMemo, useState } from 'react';

// Spec, mock and snippet coverage. All three are measured against the same
// thing, the adaptor's OpenAPI spec in openfn-api-specs:
//   spec      how complete the spec is (a claim, from its provenance)
//   mock      spec operations openfn-mocker's guide examples exercise / all spec operations
//   snippets  spec resources with at least one snippet / all spec resources

const ORIGIN_LABEL = {
  'found-openapi': 'Vendor OpenAPI',
  converted: 'Converted from vendor spec',
  generated: 'Written from docs',
  synthesized: 'Reconstructed from adaptor',
};

const NOT_MEASURED = {
  'no-mock': "openfn-mocker doesn't mock this system yet, so its snippets can't be run",
  'no-spec': 'no spec in openfn-api-specs to measure against',
  'no-resources': 'the spec lists no operations',
};

export function specLabel(spec) {
  if (!spec) return { text: 'No spec', tone: 'none' };
  if (spec.completeness === 'complete' && spec.coverage === 'subset') return { text: 'Subset', tone: 'warn' };
  if (spec.completeness === 'complete') return { text: 'Complete', tone: 'good' };
  if (spec.completeness === 'best-effort') return { text: 'Best effort', tone: 'warn' };
  return { text: 'Not claimed', tone: 'none' };
}

const TONE = {
  good: 'bg-emerald-100 text-emerald-800',
  warn: 'bg-amber-100 text-amber-800',
  bad: 'bg-rose-100 text-rose-800',
  none: 'bg-slate-100 text-slate-600',
};

export function Chip({ tone = 'none', children, title }) {
  return (
    <span title={title} className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${TONE[tone]}`}>
      {children}
    </span>
  );
}

export function Bar({ percent, className = '' }) {
  const w = Math.max(0, Math.min(100, percent || 0));
  return (
    <div className={`h-1.5 w-full overflow-hidden rounded bg-slate-100 ${className}`}>
      <div className="h-full bg-slate-700" style={{ width: `${w > 0 && w < 1 ? 1 : w}%` }} />
    </div>
  );
}

const fmtPct = (p) => (p === null || p === undefined ? '—' : `${p < 10 && p > 0 ? p.toFixed(1) : Math.round(p)}%`);

/** The per-adaptor card on the Overview tab. */
export function CoverageCard({ coverage }) {
  if (!coverage) return null;
  const { spec, mock, snippets } = coverage;
  const sl = specLabel(spec);
  return (
    <section className="rounded border border-slate-200 bg-white p-4 md:col-span-2">
      <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">Coverage</h2>
      <p className="mb-4 text-xs text-slate-500">
        Measured against this adaptor's spec in{' '}
        <a className="text-sky-600 underline" href="https://github.com/brandonjackson/openfn-api-specs" target="_blank" rel="noreferrer">
          openfn-api-specs
        </a>
        .
      </p>
      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-800">Spec</span>
            <Chip tone={sl.tone}>{sl.text}</Chip>
            {spec?.stale && <Chip tone="bad" title="Not re-checked against upstream in 90+ days">Stale</Chip>}
          </div>
          {spec ? (
            <div className="mt-2 space-y-0.5 text-xs text-slate-600">
              <div>{ORIGIN_LABEL[spec.origin] || spec.origin || 'Unknown origin'}</div>
              {spec.completeness === 'best-effort' && spec.completenessReason && <div>Why: {spec.completenessReason}</div>}
              <div>
                {spec.operations ?? '?'} operations in {spec.resourceGroups ?? '?'} resources
              </div>
              {spec.lastCheckedAt && <div>Last checked {spec.lastCheckedAt}</div>}
            </div>
          ) : (
            <div className="mt-2 text-xs text-slate-500">No spec in openfn-api-specs yet.</div>
          )}
        </div>

        <div>
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-medium text-slate-800">Mock</span>
            <span className="font-mono text-sm text-slate-700">{mock ? fmtPct(mock.percent) : spec ? '0%' : '—'}</span>
          </div>
          <Bar percent={mock?.percent ?? 0} className="mt-2" />
          <div className="mt-2 space-y-0.5 text-xs text-slate-600">
            {mock ? (
              <>
                <div>
                  {mock.exercised} of {mock.specOperations} spec operations exercised
                </div>
                <div>
                  {mock.verified} of {mock.routes} mock routes verified against the spec
                </div>
              </>
            ) : (
              <div className="text-slate-500">Not mocked by openfn-mocker yet.</div>
            )}
          </div>
        </div>

        <div>
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-medium text-slate-800">Snippets</span>
            <span className="font-mono text-sm text-slate-700">
              {snippets?.measured ? fmtPct(snippets.percent) : '—'}
            </span>
          </div>
          <Bar percent={snippets?.measured ? snippets.percent : 0} className="mt-2" />
          <div className="mt-2 space-y-0.5 text-xs text-slate-600">
            {!snippets && <div className="text-slate-500">Nothing to measure against.</div>}
            {snippets && !snippets.measured && (
              <div className="text-slate-500">Not measured: {NOT_MEASURED[snippets.reason] || snippets.reason}.</div>
            )}
            {snippets?.measured && (
              <>
                <div>
                  {snippets.covered} of {snippets.resourceGroups} resources have a snippet
                </div>
                {snippets.snippetCount > 0 && (
                  <div>
                    {snippets.ranClean} of {snippets.snippetCount} snippets ran clean against the mock
                  </div>
                )}
                {snippets.resources?.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {snippets.resources.map((r) => (
                      <Chip key={r}>{r}</Chip>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

const SORTS = {
  name: (a, b) => (a.label || a.name).localeCompare(b.label || b.name),
  mock: (a, b) => (b.coverage?.mock?.percent ?? -1) - (a.coverage?.mock?.percent ?? -1),
  snippets: (a, b) => snippetSortValue(b) - snippetSortValue(a),
};
const snippetSortValue = (a) => (a.coverage?.snippets?.measured ? a.coverage.snippets.percent : -1);

/** The cross-adaptor section on the library Overview page. */
export function CoverageOverviewSection({ adapters, onSelect }) {
  const [sort, setSort] = useState('name');
  const stats = useMemo(() => {
    const withSpec = adapters.filter((a) => a.coverage?.spec);
    const specCounts = { Complete: 0, Subset: 0, 'Best effort': 0, 'Not claimed': 0 };
    let stale = 0;
    for (const a of withSpec) {
      specCounts[specLabel(a.coverage.spec).text]++;
      if (a.coverage.spec.stale) stale++;
    }
    // Mock: every spec counts, so an unmocked adaptor is 0 of its operations.
    const mockOps = withSpec.reduce((n, a) => n + (a.coverage.spec.operations || 0), 0);
    const mockHit = withSpec.reduce((n, a) => n + (a.coverage.mock?.exercised || 0), 0);
    const mocked = withSpec.filter((a) => a.coverage.mock).length;
    // Snippets: measured adaptors only (including those with no snippets, at 0).
    const measured = adapters.filter((a) => a.coverage?.snippets?.measured);
    const snipGroups = measured.reduce((n, a) => n + a.coverage.snippets.resourceGroups, 0);
    const snipHit = measured.reduce((n, a) => n + a.coverage.snippets.covered, 0);
    const notMeasured = adapters.filter((a) => a.coverage?.snippets && !a.coverage.snippets.measured).length;
    return {
      withSpec: withSpec.length,
      specCounts,
      stale,
      mock: { ops: mockOps, hit: mockHit, mocked, percent: mockOps ? (mockHit / mockOps) * 100 : 0 },
      snippets: { groups: snipGroups, hit: snipHit, measured: measured.length, notMeasured, percent: snipGroups ? (snipHit / snipGroups) * 100 : 0 },
    };
  }, [adapters]);

  const rows = useMemo(() => [...adapters].sort(SORTS[sort]), [adapters, sort]);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Spec, mock and snippet coverage</h2>
      <p className="mt-1 max-w-3xl text-sm text-slate-600">
        Every number is measured against the adaptor's spec in openfn-api-specs. Mock coverage is the share of spec
        operations openfn-mocker's examples exercise; snippet coverage is the share of spec resources with at least one
        snippet, found by running every snippet against the mock.
      </p>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <div className="rounded border border-slate-100 bg-slate-50 p-3">
          <div className="text-xs uppercase tracking-wider text-slate-500">Specs</div>
          <div className="mt-1 text-2xl font-semibold text-slate-900">
            {stats.specCounts.Complete} <span className="text-sm font-normal text-slate-500">of {stats.withSpec} complete</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            <Chip tone="good">{stats.specCounts.Complete} complete</Chip>
            <Chip tone="warn">{stats.specCounts['Best effort']} best effort</Chip>
            {stats.specCounts.Subset > 0 && <Chip tone="warn">{stats.specCounts.Subset} subset</Chip>}
            <Chip>{stats.specCounts['Not claimed']} not claimed</Chip>
            {stats.stale > 0 && <Chip tone="bad">{stats.stale} stale</Chip>}
          </div>
        </div>
        <div className="rounded border border-slate-100 bg-slate-50 p-3">
          <div className="text-xs uppercase tracking-wider text-slate-500">Mocks</div>
          <div className="mt-1 text-2xl font-semibold text-slate-900">{fmtPct(stats.mock.percent)}</div>
          <Bar percent={stats.mock.percent} className="mt-1" />
          <div className="mt-2 text-xs text-slate-600">
            {stats.mock.hit.toLocaleString()} of {stats.mock.ops.toLocaleString()} spec operations; {stats.mock.mocked} of{' '}
            {stats.withSpec} adaptors mocked
          </div>
        </div>
        <div className="rounded border border-slate-100 bg-slate-50 p-3">
          <div className="text-xs uppercase tracking-wider text-slate-500">Snippets</div>
          <div className="mt-1 text-2xl font-semibold text-slate-900">{fmtPct(stats.snippets.percent)}</div>
          <Bar percent={stats.snippets.percent} className="mt-1" />
          <div className="mt-2 text-xs text-slate-600">
            {stats.snippets.hit.toLocaleString()} of {stats.snippets.groups.toLocaleString()} resources across{' '}
            {stats.snippets.measured} adaptors
            {stats.snippets.notMeasured > 0 && `; ${stats.snippets.notMeasured} not measurable (no mock)`}
          </div>
        </div>
      </div>

      <div className="mt-6 flex items-center gap-2 text-xs text-slate-500">
        Sort by
        {Object.keys(SORTS).map((k) => (
          <button
            key={k}
            onClick={() => setSort(k)}
            className={`rounded px-2 py-0.5 ${sort === k ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
          >
            {k}
          </button>
        ))}
      </div>
      <div className="mt-2 max-h-[28rem] overflow-y-auto rounded border border-slate-100">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-white text-left text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-3 py-2 font-medium">Adaptor</th>
              <th className="px-3 py-2 font-medium">Spec</th>
              <th className="px-3 py-2 font-medium">Mock</th>
              <th className="px-3 py-2 font-medium">Snippets</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => {
              const c = a.coverage || {};
              const sl = specLabel(c.spec);
              return (
                <tr key={a.name} onClick={() => onSelect(a.name)} className="cursor-pointer border-t border-slate-50 hover:bg-slate-50">
                  <td className="px-3 py-1.5 text-slate-800">{a.label || a.name}</td>
                  <td className="px-3 py-1.5">
                    <Chip tone={sl.tone}>{sl.text}</Chip> {c.spec?.stale && <Chip tone="bad">Stale</Chip>}
                  </td>
                  <td className="px-3 py-1.5">
                    <Cell
                      percent={c.mock ? c.mock.percent : c.spec ? 0 : null}
                      detail={c.mock ? `${c.mock.exercised}/${c.mock.specOperations} ops` : c.spec ? 'not mocked' : ''}
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    {c.snippets?.measured ? (
                      <Cell percent={c.snippets.percent} detail={`${c.snippets.covered}/${c.snippets.resourceGroups} resources`} />
                    ) : (
                      <span className="text-xs text-slate-400">{c.snippets ? 'not measured' : '—'}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Cell({ percent, detail }) {
  if (percent === null || percent === undefined) return <span className="text-xs text-slate-400">—</span>;
  return (
    <div className="flex items-center gap-2">
      <span className="w-10 text-right font-mono text-xs text-slate-700">{fmtPct(percent)}</span>
      <Bar percent={percent} className="w-16" />
      <span className="whitespace-nowrap text-xs text-slate-500">{detail}</span>
    </div>
  );
}
