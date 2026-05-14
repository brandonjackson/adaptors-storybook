import React, { useEffect, useMemo, useState } from 'react';

export default function DataSchemas({ adapter, schemas }) {
  const [activeId, setActiveId] = useState(null);

  useEffect(() => {
    setActiveId(schemas?.[0]?.id || null);
  }, [adapter, schemas]);

  if (!schemas || schemas.length === 0) {
    return (
      <div className="max-w-2xl rounded border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
        <strong className="text-slate-700">Data schemas</strong> — none yet.
        Run <code>node tools/ingest-openapi.mjs {adapter}</code> after adding{' '}
        <code>schemaRef</code> entries to <code>triggers.json</code>.
      </div>
    );
  }

  return (
    <div className="flex max-w-6xl gap-6">
      <aside className="w-56 shrink-0">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          {schemas.length} schema{schemas.length === 1 ? '' : 's'}
        </div>
        <ul className="space-y-1">
          {schemas.map((s) => (
            <li key={s.id}>
              <button
                onClick={() => setActiveId(s.id)}
                className={[
                  'w-full rounded px-2 py-1.5 text-left text-sm transition-colors',
                  activeId === s.id
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-700 hover:bg-slate-100',
                ].join(' ')}
              >
                <div className="font-mono text-xs">{s.id}</div>
                {s.propertyCount != null && (
                  <div
                    className={[
                      'mt-0.5 text-[11px]',
                      activeId === s.id ? 'text-slate-300' : 'text-slate-500',
                    ].join(' ')}
                  >
                    {s.propertyCount} field{s.propertyCount === 1 ? '' : 's'}
                  </div>
                )}
              </button>
            </li>
          ))}
        </ul>
      </aside>
      <main className="min-w-0 flex-1">
        {activeId && (
          <SchemaDetail
            adapter={adapter}
            summary={schemas.find((s) => s.id === activeId)}
          />
        )}
      </main>
    </div>
  );
}

function SchemaDetail({ adapter, summary }) {
  const [schema, setSchema] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setSchema(null);
    setError(null);
    fetch(summary.path)
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json();
      })
      .then(setSchema)
      .catch((e) => setError(e.message));
  }, [summary.path]);

  if (error) {
    return (
      <div className="rounded border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
        Failed to load <code>{summary.path}</code>: {error}
      </div>
    );
  }

  if (!schema) {
    return <div className="text-sm text-slate-400">Loading…</div>;
  }

  const source = schema['x-source'];
  const properties = schema.properties || {};
  const required = new Set(schema.required || []);

  return (
    <div>
      <header className="mb-4">
        <h2 className="font-mono text-xl font-semibold text-slate-900">
          {summary.id}
        </h2>
        {schema.title && schema.title !== summary.id && (
          <div className="mt-0.5 text-sm text-slate-600">{schema.title}</div>
        )}
        {source && (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono">
              openapi:{source.component}
            </span>
            {source.openapi && (
              <a
                href={source.openapi}
                target="_blank"
                rel="noreferrer"
                className="text-sky-600 underline hover:text-sky-800"
              >
                spec source
              </a>
            )}
            {source.ingestedAt && <span>ingested {source.ingestedAt}</span>}
          </div>
        )}
        {schema.description && (
          <p className="mt-3 max-w-3xl whitespace-pre-wrap text-sm text-slate-600">
            {schema.description}
          </p>
        )}
      </header>

      {Object.keys(properties).length === 0 ? (
        <RawSchema schema={schema} />
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wider text-slate-500">
              <th className="py-2 pr-3 font-medium">Field</th>
              <th className="py-2 pr-3 font-medium">Type</th>
              <th className="py-2 font-medium">Description</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(properties).map(([name, prop]) => (
              <PropertyRow
                key={name}
                name={name}
                prop={prop}
                required={required.has(name)}
              />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function PropertyRow({ name, prop, required }) {
  const [expanded, setExpanded] = useState(false);
  const typeLabel = describeType(prop);
  const refTarget = extractRef(prop);
  const hasMore =
    prop?.properties ||
    prop?.items?.properties ||
    prop?.enum ||
    prop?.anyOf ||
    prop?.oneOf;

  return (
    <>
      <tr className="border-b border-slate-100 align-top">
        <td className="py-2 pr-3 font-mono text-xs text-slate-800">
          {name}
          {required && <span className="ml-1 text-rose-500">*</span>}
        </td>
        <td className="py-2 pr-3 font-mono text-xs text-slate-600">
          {typeLabel}
          {refTarget && (
            <div className="text-[11px] text-sky-600">→ {refTarget}</div>
          )}
        </td>
        <td className="py-2 text-slate-600">
          {prop?.description && (
            <div className="whitespace-pre-wrap">{prop.description}</div>
          )}
          {hasMore && (
            <button
              onClick={() => setExpanded((e) => !e)}
              className="mt-1 text-[11px] uppercase tracking-wider text-slate-500 hover:text-slate-800"
            >
              {expanded ? 'hide schema' : 'show schema'}
            </button>
          )}
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-slate-100 bg-slate-50">
          <td colSpan={3} className="p-3">
            <pre className="max-h-96 overflow-auto rounded bg-white p-3 font-mono text-[11px] leading-relaxed text-slate-700 ring-1 ring-slate-200">
              {JSON.stringify(prop, null, 2)}
            </pre>
          </td>
        </tr>
      )}
    </>
  );
}

function RawSchema({ schema }) {
  return (
    <pre className="max-h-[40rem] overflow-auto rounded bg-slate-50 p-3 font-mono text-[11px] leading-relaxed text-slate-700 ring-1 ring-slate-200">
      {JSON.stringify(schema, null, 2)}
    </pre>
  );
}

function describeType(prop) {
  if (!prop) return '—';
  if (prop.$ref) return '$ref';
  if (prop.enum) return `enum(${prop.enum.length})`;
  if (prop.anyOf) return `anyOf(${prop.anyOf.length})`;
  if (prop.oneOf) return `oneOf(${prop.oneOf.length})`;
  if (prop.type === 'array') {
    const inner = prop.items
      ? prop.items.type || (prop.items.$ref ? '$ref' : 'object')
      : '?';
    return `array<${inner}>`;
  }
  if (Array.isArray(prop.type)) return prop.type.join(' | ');
  return prop.type || (prop.properties ? 'object' : '—');
}

function extractRef(prop) {
  if (!prop) return null;
  if (prop.$ref) return shortRef(prop.$ref);
  if (prop['x-openapi-ref']) return shortRef(prop['x-openapi-ref']);
  if (prop.items?.$ref) return shortRef(prop.items.$ref);
  if (prop.items?.['x-openapi-ref']) return shortRef(prop.items['x-openapi-ref']);
  return null;
}

function shortRef(ref) {
  const parts = ref.split('/');
  return parts[parts.length - 1];
}
