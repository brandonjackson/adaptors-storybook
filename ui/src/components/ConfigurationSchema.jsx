import React from 'react';

export default function ConfigurationSchema({ schema, oauthSchema }) {
  if (!schema && !oauthSchema) {
    return (
      <div className="text-sm text-slate-400">
        No configuration schema for this adapter.
      </div>
    );
  }

  return (
    <div className="grid max-w-4xl gap-6">
      {schema && <SchemaCard title="Configuration" schema={schema} />}
      {oauthSchema && (
        <SchemaCard title="OAuth configuration" schema={oauthSchema} />
      )}
    </div>
  );
}

function SchemaCard({ title, schema }) {
  const props = schema.properties || {};
  const required = new Set(schema.required || []);
  const keys = Object.keys(props);

  return (
    <section className="rounded border border-slate-200 bg-white">
      <header className="border-b border-slate-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          {keys.length} field{keys.length === 1 ? '' : 's'} •{' '}
          {required.size} required
        </p>
      </header>
      <ul className="divide-y divide-slate-100">
        {keys.map((k) => {
          const p = props[k];
          return (
            <li key={k} className="px-4 py-3">
              <div className="flex items-baseline gap-2">
                <code className="text-sm font-semibold text-slate-800">{k}</code>
                <span className="text-xs text-slate-500">{p.type}</span>
                {required.has(k) && (
                  <span className="rounded bg-amber-100 px-1.5 text-[10px] font-medium text-amber-800">
                    required
                  </span>
                )}
                {p.writeOnly && (
                  <span className="rounded bg-rose-100 px-1.5 text-[10px] font-medium text-rose-800">
                    secret
                  </span>
                )}
              </div>
              {p.title && p.title !== k && (
                <div className="mt-1 text-sm text-slate-700">{p.title}</div>
              )}
              {p.description && (
                <p className="mt-0.5 text-sm text-slate-500">{p.description}</p>
              )}
              {Array.isArray(p.examples) && p.examples.length > 0 && (
                <div className="mt-1 font-mono text-xs text-slate-400">
                  e.g. {JSON.stringify(p.examples[0])}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
