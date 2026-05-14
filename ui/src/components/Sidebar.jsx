import React from 'react';

export default function Sidebar({
  adapters,
  totalCount,
  selected,
  onSelect,
  filter,
  onFilter,
}) {
  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r border-slate-200 bg-slate-50">
      <div className="border-b border-slate-200 px-4 py-4">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Adapter Library
        </div>
        <div className="mt-1 text-sm text-slate-600">
          {adapters.length} of {totalCount} adapters
        </div>
        <input
          value={filter}
          onChange={(e) => onFilter(e.target.value)}
          placeholder="Filter…"
          className="mt-3 w-full rounded border border-slate-300 bg-white px-2 py-1 text-sm focus:border-slate-500 focus:outline-none"
        />
      </div>
      <ul className="flex-1 overflow-y-auto">
        {adapters.map((a) => {
          const active = a.name === selected;
          return (
            <li key={a.name}>
              <button
                onClick={() => onSelect(a.name)}
                className={[
                  'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors',
                  active
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-700 hover:bg-slate-200',
                ].join(' ')}
              >
                {a.icon ? (
                  <img
                    src={a.icon}
                    alt=""
                    className="h-6 w-6 shrink-0 rounded-sm bg-white object-contain"
                    onError={(e) => {
                      e.currentTarget.style.visibility = 'hidden';
                    }}
                  />
                ) : (
                  <span className="inline-block h-6 w-6 shrink-0 rounded-sm bg-slate-200" />
                )}
                <span className="flex-1 truncate">{a.label || a.name}</span>
                <span className="flex shrink-0 items-center gap-1">
                  {a.snippetCount > 0 && (
                    <span
                      className={[
                        'rounded px-1.5 py-0.5 text-[10px] font-mono',
                        active
                          ? 'bg-emerald-300/30 text-emerald-100'
                          : 'bg-emerald-100 text-emerald-700',
                      ].join(' ')}
                      title={`${a.snippetCount} snippets`}
                    >
                      ✦{a.snippetCount}
                    </span>
                  )}
                  <span
                    className={[
                      'rounded px-1.5 py-0.5 text-[10px] font-mono',
                      active
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-200 text-slate-600',
                    ].join(' ')}
                    title={`${a.operationCount} operations`}
                  >
                    {a.operationCount}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
