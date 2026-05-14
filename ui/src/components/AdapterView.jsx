import React, { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import OperationsTable from './OperationsTable.jsx';
import ConfigurationSchema from './ConfigurationSchema.jsx';
import Snippets from './Snippets.jsx';
import Triggers from './Triggers.jsx';
import DataSchemas from './DataSchemas.jsx';
import Sources, { SourceQuality, SourceList, VendorPanel } from './Sources.jsx';
import Faq from './Faq.jsx';
import AuthOverview from './AuthOverview.jsx';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'auth', label: 'Auth' },
  { id: 'triggers', label: 'Triggers' },
  { id: 'data', label: 'Data' },
  { id: 'operations', label: 'Operations' },
  { id: 'snippets', label: 'Snippets' },
];

export default function AdapterView({ name }) {
  const [manifest, setManifest] = useState(null);
  const [readme, setReadme] = useState('');
  const [tab, setTab] = useState('overview');

  useEffect(() => {
    setManifest(null);
    setReadme('');
    setTab('overview');
    fetch(`/adapters/${name}/manifest.json`)
      .then((r) => r.json())
      .then(setManifest);
    fetch(`/adapters/${name}/README.md`)
      .then((r) => (r.ok ? r.text() : ''))
      .then(setReadme);
  }, [name]);

  if (!manifest) {
    return <div className="p-8 text-slate-400">Loading {name}…</div>;
  }

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-slate-200 px-8 py-6">
        <div className="flex items-center gap-4">
          {manifest.icons.square ? (
            <img
              src={manifest.icons.square}
              alt=""
              className="h-12 w-12 rounded bg-white object-contain ring-1 ring-slate-200"
            />
          ) : (
            <div className="h-12 w-12 rounded bg-slate-200" />
          )}
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              {manifest.label}
            </h1>
            <div className="mt-1 flex items-center gap-3 text-xs text-slate-500">
              <code className="font-mono">{manifest.packageName}</code>
              {manifest.version && <span>v{manifest.version}</span>}
              <span>{manifest.operationCount} operations</span>
              {manifest.snippetCount > 0 && (
                <span>{manifest.snippetCount} snippets</span>
              )}
              {manifest.triggerCount > 0 && (
                <span>{manifest.triggerCount} triggers</span>
              )}
              {manifest.dataSchemaCount > 0 && (
                <span>{manifest.dataSchemaCount} data schemas</span>
              )}
            </div>
          </div>
        </div>
        {manifest.description && (
          <p className="mt-4 max-w-3xl text-sm text-slate-600">
            {manifest.description}
          </p>
        )}
        <nav className="mt-6 flex gap-1 border-b border-slate-200 -mb-6">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={[
                'rounded-t px-3 py-2 text-sm transition-colors',
                tab === t.id
                  ? 'border-b-2 border-slate-900 text-slate-900'
                  : 'border-b-2 border-transparent text-slate-500 hover:text-slate-700',
              ].join(' ')}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <div className="flex-1 overflow-y-auto px-8 py-6">
        {tab === 'overview' && <Overview manifest={manifest} readme={readme} />}
        {tab === 'operations' && (
          <OperationsTable operations={manifest.operations} />
        )}
        {tab === 'auth' && (
          <div className="grid max-w-4xl gap-6">
            <AuthOverview manifest={manifest} />
            <ConfigurationSchema
              schema={manifest.configurationSchema}
              oauthSchema={manifest.oauthConfigurationSchema}
            />
          </div>
        )}
        {tab === 'triggers' && (
          <Triggers
            triggers={manifest.triggers}
            dataSchemas={manifest.dataSchemas || []}
            onOpenSchema={(id) => setTab('data')}
          />
        )}
        {tab === 'data' && (
          <DataSchemas
            adapter={manifest.name}
            schemas={manifest.dataSchemas || []}
          />
        )}
        {tab === 'snippets' && <Snippets snippets={manifest.snippets || []} />}
      </div>
    </div>
  );
}

function Overview({ manifest, readme }) {
  const scrollToSources = (e) => {
    e.preventDefault();
    const el = document.getElementById('source-details');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="grid max-w-4xl gap-6 md:grid-cols-2">
      <Card title="At a glance">
        <Row k="Package" v={<code>{manifest.packageName}</code>} />
        <Row k="Version" v={manifest.version || '—'} />
        <Row k="Operations" v={manifest.operationCount} />
        <Row
          k="Credential schema"
          v={manifest.configurationSchema ? 'yes' : '—'}
        />
        <Row
          k="OAuth schema"
          v={manifest.oauthConfigurationSchema ? 'yes' : '—'}
        />
        <Row
          k="Branding assets"
          v={
            manifest.icons.square || manifest.icons.rectangle ? '✅' : '❌'
          }
        />
      </Card>
      <Card title="Source quality">
        <SourceQuality metadata={manifest.metadata} />
        <div className="mt-3 text-right">
          <a
            href="#source-details"
            onClick={scrollToSources}
            className="text-xs text-sky-600 underline hover:text-sky-800"
          >
            see more →
          </a>
        </div>
      </Card>
      <Faq manifest={manifest} overrides={manifest.faq} />
      {readme && (
        <section className="rounded border border-slate-200 bg-white p-4 md:col-span-2">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
            README
          </h2>
          <article className="prose prose-slate max-w-none prose-sm">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{readme}</ReactMarkdown>
          </article>
        </section>
      )}
      <section id="source-details" className="md:col-span-2 space-y-6 scroll-mt-6">
        <VendorPanel metadata={manifest.metadata} />
        <SourceList metadata={manifest.metadata} />
      </section>
    </div>
  );
}

function Card({ title, children, className = '' }) {
  return (
    <section
      className={`rounded border border-slate-200 bg-white p-4 ${className}`}
    >
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Row({ k, v }) {
  return (
    <div className="flex items-baseline justify-between border-b border-slate-50 py-1 text-sm last:border-b-0">
      <span className="text-slate-500">{k}</span>
      <span className="text-slate-800">{v}</span>
    </div>
  );
}
