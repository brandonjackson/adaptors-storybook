import React, { useMemo, useState } from 'react';

const FILTERS = ['ALL', 'webhook', 'polling'];

export default function Triggers({ triggers }) {
  const [filter, setFilter] = useState('ALL');

  if (!triggers) {
    return (
      <div className="max-w-2xl rounded border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
        <strong className="text-slate-700">Triggers</strong> — not yet captured
        for this adapter. Drop a <code>triggers.json</code> in the package
        folder.
      </div>
    );
  }

  const items = triggers.triggers || [];

  const counts = useMemo(() => {
    const c = { webhook: 0, polling: 0, other: 0 };
    for (const t of items) {
      if (t.mechanism === 'webhook') c.webhook += 1;
      else if (t.mechanism === 'polling') c.polling += 1;
      else c.other += 1;
    }
    return c;
  }, [items]);

  const visible =
    filter === 'ALL' ? items : items.filter((t) => t.mechanism === filter);

  return (
    <div className="max-w-4xl">
      {triggers.notes && (
        <p className="mb-4 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {triggers.notes}
        </p>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <span>
          {items.length} trigger{items.length === 1 ? '' : 's'}
          {items.length > 0 && (
            <>
              {' '}
              · {counts.webhook} webhook · {counts.polling} polling
            </>
          )}
        </span>
        {triggers.source && (
          <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono uppercase text-slate-600">
            source: {triggers.source}
            {triggers.scrapedAt ? ` (${triggers.scrapedAt})` : ''}
          </span>
        )}
        {items.length > 0 && (
          <div className="ml-auto flex gap-1">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={[
                  'rounded px-2 py-1 text-xs font-medium uppercase tracking-wider transition-colors',
                  f === filter
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                ].join(' ')}
              >
                {f}
              </button>
            ))}
          </div>
        )}
      </div>

      {items.length === 0 ? (
        <div className="rounded border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
          No triggers defined for this adapter.
        </div>
      ) : (
        <ul className="space-y-3">
          {visible.map((t, i) => (
            <li
              key={`${t.name}/${i}`}
              className="overflow-hidden rounded border border-slate-200 bg-white"
            >
              <header className="flex items-baseline justify-between gap-3 border-b border-slate-100 bg-slate-50 px-4 py-2">
                <h3 className="text-sm font-semibold text-slate-800">
                  {t.name}
                </h3>
                <div className="flex items-center gap-1.5">
                  <MechanismBadge mechanism={t.mechanism} />
                  {t.openfnPattern && (
                    <PatternBadge pattern={t.openfnPattern} />
                  )}
                </div>
              </header>
              {t.description && (
                <p className="px-4 pt-3 text-sm text-slate-600">
                  {t.description}
                </p>
              )}
              {t.output && <Output output={t.output} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MechanismBadge({ mechanism }) {
  if (mechanism === 'webhook') {
    return (
      <span
        title="Vendor pushes events to a webhook URL"
        className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-mono uppercase text-emerald-800"
      >
        webhook
      </span>
    );
  }
  if (mechanism === 'polling') {
    return (
      <span
        title="Trigger checks the vendor API on a schedule"
        className="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-mono uppercase text-sky-800"
      >
        polling
      </span>
    );
  }
  return (
    <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-mono uppercase text-slate-600">
      {mechanism || 'unknown'}
    </span>
  );
}

function PatternBadge({ pattern }) {
  return (
    <span
      title={`OpenFn workflow trigger: ${pattern}`}
      className="rounded border border-slate-300 px-1.5 py-0.5 text-[10px] font-mono uppercase text-slate-600"
    >
      openfn:{pattern}
    </span>
  );
}

function Output({ output }) {
  return (
    <div className="border-t border-slate-100 px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        Output → next step
      </div>
      {output.summary && (
        <div className="mt-1 text-sm text-slate-700">{output.summary}</div>
      )}
      {Array.isArray(output.fields) && output.fields.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1">
          {output.fields.map((f) => (
            <li
              key={f}
              className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-700"
            >
              {f}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
