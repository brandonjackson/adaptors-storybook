import React, { useMemo, useState } from 'react';
import { Chip } from './Coverage.jsx';

export default function Snippets({ snippets }) {
  const [category, setCategory] = useState('ALL');
  const categories = useMemo(() => {
    const set = new Set(snippets.map((s) => s.category));
    return ['ALL', ...Array.from(set).sort()];
  }, [snippets]);

  if (!snippets || snippets.length === 0) {
    return (
      <div className="max-w-2xl rounded border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
        <strong className="text-slate-700">Snippets</strong> — not yet captured
        for this adapter. Drop a <code>snippets.json</code> in the package
        folder using the schema{' '}
        <code>{`{ "CATEGORY": { "Title": { "description", "code" } } }`}</code>.
      </div>
    );
  }

  const visible =
    category === 'ALL'
      ? snippets
      : snippets.filter((s) => s.category === category);

  return (
    <div className="max-w-4xl">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-xs text-slate-500">
          {visible.length} of {snippets.length} snippets
        </span>
        <div className="ml-auto flex gap-1">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={[
                'rounded px-2 py-1 text-xs font-medium uppercase tracking-wider transition-colors',
                c === category
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
              ].join(' ')}
            >
              {c}
            </button>
          ))}
        </div>
      </div>
      <ul className="space-y-4">
        {visible.map((s, i) => (
          <li
            key={`${s.category}/${s.title}/${i}`}
            className="overflow-hidden rounded border border-slate-200 bg-white"
          >
            <header className="flex items-baseline justify-between gap-3 border-b border-slate-100 bg-slate-50 px-4 py-2">
              <h3 className="text-sm font-semibold text-slate-800">
                {s.title}
              </h3>
              <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-mono uppercase text-slate-600">
                {s.category}
              </span>
            </header>
            {s.description && (
              <p className="px-4 pt-3 text-sm text-slate-600">{s.description}</p>
            )}
            {s.check && <SnippetCheck check={s.check} />}
            {s.code ? (
              <pre className="m-4 mt-3 overflow-x-auto rounded bg-slate-900 px-3 py-2 text-xs text-slate-100">
                <code>{s.code}</code>
              </pre>
            ) : (
              <div className="m-4 mt-3 rounded border border-dashed border-slate-300 px-3 py-2 text-xs italic text-slate-400">
                no code yet
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

const RUN = {
  ok: { tone: 'good', text: 'ran clean', title: 'Ran against openfn-mocker with no errors' },
  error: { tone: 'warn', text: 'errored', title: 'Threw when run against openfn-mocker (it may still have sent its request)' },
  infra: { tone: 'none', text: 'not run', title: 'The adaptor could not be installed or started' },
};

// What happened when the snippet was run against openfn-mocker
// (tools/check-snippets.ts): which spec resources its requests reached.
function SnippetCheck({ check }) {
  const run = RUN[check.run] || RUN.infra;
  return (
    <div className="flex flex-wrap items-center gap-1.5 px-4 pt-3 text-xs text-slate-500">
      <Chip tone={run.tone} title={check.error ? `${run.title}: ${check.error}` : run.title}>
        {run.text}
      </Chip>
      {check.resources?.length > 0 ? (
        <>
          <span>reaches</span>
          {check.resources.map((r) => (
            <Chip key={r}>{r}</Chip>
          ))}
        </>
      ) : (
        <span>reached no spec resource</span>
      )}
      {check.offSpec?.length > 0 && (
        <span title={check.offSpec.join('\n')} className="text-amber-700">
          {check.offSpec.length} request(s) not in the spec
        </span>
      )}
    </div>
  );
}
