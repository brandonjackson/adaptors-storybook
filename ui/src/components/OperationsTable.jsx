import React, { useState } from 'react';

export default function OperationsTable({ operations }) {
  const [open, setOpen] = useState(() => new Set());

  if (!operations || operations.length === 0) {
    return (
      <div className="text-sm text-slate-400">
        No operations available (missing or empty ast.json).
      </div>
    );
  }

  const toggle = (name) => {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  return (
    <div className="max-w-4xl">
      <div className="mb-3 text-xs text-slate-500">
        {operations.length} operations
      </div>
      <ul className="divide-y divide-slate-100 rounded border border-slate-200 bg-white">
        {operations.map((op) => {
          const isOpen = open.has(op.name);
          return (
            <li key={op.name}>
              <button
                onClick={() => toggle(op.name)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50"
              >
                <div>
                  <code className="text-sm font-semibold text-slate-800">
                    {op.name}
                    <span className="font-normal text-slate-500">
                      ({op.params.join(', ')})
                    </span>
                  </code>
                  {op.description && (
                    <p className="mt-0.5 text-sm text-slate-600">
                      {op.description}
                    </p>
                  )}
                </div>
                <span className="text-slate-400">{isOpen ? '−' : '+'}</span>
              </button>
              {isOpen && op.examples.length > 0 && (
                <div className="border-t border-slate-100 bg-slate-50 px-4 py-3">
                  {op.examples.map((ex, i) => (
                    <div key={i} className="mb-3 last:mb-0">
                      {ex.caption && (
                        <div className="mb-1 text-xs font-medium text-slate-500">
                          {ex.caption}
                        </div>
                      )}
                      <pre className="overflow-x-auto rounded bg-slate-900 px-3 py-2 text-xs text-slate-100">
                        <code>{ex.code}</code>
                      </pre>
                    </div>
                  ))}
                </div>
              )}
              {isOpen && op.examples.length === 0 && (
                <div className="border-t border-slate-100 bg-slate-50 px-4 py-3 text-xs text-slate-500">
                  No examples in JSDoc.
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
