import React from 'react';

const KIND_LABEL = {
  openapi: 'OpenAPI spec',
  wsdl: 'WSDL',
  'graphql-schema': 'GraphQL schema',
  asyncapi: 'AsyncAPI',
  'postman-collection': 'Postman collection',
  'json-schema': 'JSON Schema',
  'docs-index': 'Docs index',
  'docs-page': 'Docs page',
  'sdk-repo': 'SDK source',
  changelog: 'Changelog',
  sandbox: 'Sandbox',
};

const KIND_TINT = {
  openapi: 'bg-emerald-100 text-emerald-900',
  wsdl: 'bg-amber-100 text-amber-900',
  'graphql-schema': 'bg-pink-100 text-pink-900',
  asyncapi: 'bg-violet-100 text-violet-900',
  'postman-collection': 'bg-orange-100 text-orange-900',
  'json-schema': 'bg-teal-100 text-teal-900',
  'docs-index': 'bg-slate-100 text-slate-700',
  'docs-page': 'bg-slate-100 text-slate-700',
  'sdk-repo': 'bg-indigo-100 text-indigo-900',
  changelog: 'bg-yellow-100 text-yellow-900',
  sandbox: 'bg-rose-100 text-rose-900',
};

export default function Sources({ metadata }) {
  if (!metadata) {
    return (
      <div className="max-w-2xl rounded border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
        <strong className="text-slate-700">Sources</strong> — no{' '}
        <code>metadata.json</code> for this adapter yet.
      </div>
    );
  }

  const sources = Array.isArray(metadata.sources) ? metadata.sources : [];

  return (
    <div className="max-w-4xl space-y-6">
      <section className="rounded border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Vendor
        </h2>
        <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1.5 text-sm">
          <Row k="Vendor" v={metadata.vendor} />
          <Row k="Product" v={metadata.product} />
          <Row
            k="Homepage"
            v={
              metadata.homepage ? (
                <ExtLink href={metadata.homepage} />
              ) : null
            }
          />
          <Row k="API style" v={metadata.apiStyle && <Tag>{metadata.apiStyle}</Tag>} />
          <Row k="Status" v={metadata.status && <Tag>{metadata.status}</Tag>} />
          {Array.isArray(metadata.baseUrls) && metadata.baseUrls.length > 0 && (
            <Row
              k="Base URLs"
              v={
                <ul className="space-y-0.5">
                  {metadata.baseUrls.map((u) => (
                    <li key={u} className="font-mono text-xs text-slate-700">
                      {u}
                    </li>
                  ))}
                </ul>
              }
            />
          )}
          {metadata.auth?.schemes?.length > 0 && (
            <Row
              k="Auth"
              v={
                <div className="flex flex-wrap gap-1">
                  {metadata.auth.schemes.map((s) => (
                    <Tag key={s}>{s}</Tag>
                  ))}
                </div>
              }
            />
          )}
          {metadata.auth?.docs && (
            <Row k="Auth docs" v={<ExtLink href={metadata.auth.docs} />} />
          )}
          {metadata.webhooks && (
            <Row
              k="Webhooks"
              v={
                metadata.webhooks.supported ? (
                  metadata.webhooks.docs ? (
                    <ExtLink href={metadata.webhooks.docs} label="supported" />
                  ) : (
                    'supported'
                  )
                ) : (
                  '—'
                )
              }
            />
          )}
        </dl>
        {metadata.notes && (
          <p className="mt-3 border-t border-slate-100 pt-3 text-sm text-slate-600">
            {metadata.notes}
          </p>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Sources ({sources.length})
        </h2>
        {sources.length === 0 ? (
          <p className="text-sm text-slate-500">No sources catalogued.</p>
        ) : (
          <ul className="space-y-2">
            {sources.map((s, i) => (
              <li
                key={`${s.kind}/${s.url}/${i}`}
                className="rounded border border-slate-200 bg-white p-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <span
                    className={[
                      'rounded px-1.5 py-0.5 text-[11px] font-mono uppercase',
                      KIND_TINT[s.kind] || 'bg-slate-100 text-slate-700',
                    ].join(' ')}
                    title={KIND_LABEL[s.kind] || s.kind}
                  >
                    {s.kind}
                  </span>
                  {s.url && <ExtLink href={s.url} className="text-xs" />}
                </div>
                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
                  {s.format && <span>format: {s.format}</span>}
                  {s.version && <span>version: {s.version}</span>}
                  {s.language && <span>lang: {s.language}</span>}
                  {s.introspection != null && (
                    <span>introspection: {String(s.introspection)}</span>
                  )}
                </div>
                {s.notes && (
                  <p className="mt-1 text-xs text-slate-600">{s.notes}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Row({ k, v }) {
  if (v == null || v === '') return null;
  return (
    <>
      <dt className="text-xs uppercase tracking-wider text-slate-500">{k}</dt>
      <dd className="text-slate-800">{v}</dd>
    </>
  );
}

function Tag({ children }) {
  return (
    <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-700">
      {children}
    </span>
  );
}

function ExtLink({ href, label, className = '' }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={`break-all text-sky-600 underline hover:text-sky-800 ${className}`}
    >
      {label || href}
    </a>
  );
}
