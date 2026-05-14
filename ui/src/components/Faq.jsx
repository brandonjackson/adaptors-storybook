import React, { useState } from 'react';

const QUESTIONS = [
  { id: 'what', q: 'What can this tool do?', build: answerWhat },
  { id: 'connect', q: 'How do I connect?', build: answerConnect },
  { id: 'when', q: 'When do I use it?', build: answerWhen },
  { id: 'how', q: 'How do I use it?', build: answerHow },
  { id: 'wire', q: 'How do I wire things together?', build: answerWire },
  { id: 'scale', q: 'How do I run this well at scale?', build: answerScale },
  { id: 'best', q: 'What are best practices?', build: answerBest },
];

export default function Faq({ manifest, overrides }) {
  const [open, setOpen] = useState(() => new Set(['what']));
  const toggle = (id) => {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <section className="rounded border border-slate-200 bg-white p-4 md:col-span-2">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
        FAQ
      </h2>
      <ul className="divide-y divide-slate-100">
        {QUESTIONS.map((entry) => {
          const isOpen = open.has(entry.id);
          const override = overrides?.[entry.id];
          const answer = override
            ? <Markdownish text={override} />
            : entry.build(manifest);
          return (
            <li key={entry.id}>
              <button
                onClick={() => toggle(entry.id)}
                className="flex w-full items-center justify-between py-3 text-left text-sm font-medium text-slate-800 hover:text-slate-900"
              >
                <span>{entry.q}</span>
                <span className="text-slate-400">{isOpen ? '–' : '+'}</span>
              </button>
              {isOpen && (
                <div className="pb-4 text-sm text-slate-600">{answer}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Markdownish({ text }) {
  // Cheap renderer: split paragraphs on blank lines.
  const paragraphs = String(text).split(/\n\s*\n/);
  return (
    <>
      {paragraphs.map((p, i) => (
        <p key={i} className={i === 0 ? '' : 'mt-2'}>
          {p}
        </p>
      ))}
    </>
  );
}

function answerWhat(m) {
  const desc = (m.description || '').trim();
  const opCount = m.operationCount || 0;
  const categories = collectSnippetCategories(m.snippets);
  return (
    <>
      {desc && <p>{desc}</p>}
      <p className={desc ? 'mt-2' : ''}>
        The <code>{m.packageName}</code> adaptor exposes{' '}
        <strong>{opCount}</strong> operation{opCount === 1 ? '' : 's'} you can
        call from a workflow step
        {categories.length > 0 && (
          <>
            {' '}— covering{' '}
            {categories.map((c, i) => (
              <span key={c}>
                {i > 0 && (i === categories.length - 1 ? ' and ' : ', ')}
                <em>{c.toLowerCase()}</em>
              </span>
            ))}
          </>
        )}
        . See the <strong>Operations</strong> tab for the full list.
      </p>
    </>
  );
}

function answerConnect(m) {
  const schema = m.configurationSchema;
  const oauth = m.oauthConfigurationSchema;
  if (!schema && !oauth) {
    return (
      <p>
        No credential schema is published for this adaptor yet. Check the{' '}
        <strong>Source quality</strong> section on the Overview for vendor auth docs.
      </p>
    );
  }
  const props = schema?.properties || {};
  const required = new Set(schema?.required || []);
  const fields = Object.keys(props);
  return (
    <>
      <p>
        Create a credential in the <strong>Auth</strong> tab. The
        adaptor expects{oauth ? ' OAuth tokens or ' : ' '}the following{' '}
        configuration values:
      </p>
      {fields.length > 0 && (
        <ul className="mt-2 list-disc pl-5">
          {fields.map((f) => (
            <li key={f}>
              <code>{f}</code>
              {required.has(f) && (
                <span className="ml-1 text-xs text-rose-600">required</span>
              )}
              {props[f]?.description && (
                <span className="text-slate-500"> — {props[f].description}</span>
              )}
            </li>
          ))}
        </ul>
      )}
      {oauth && (
        <p className="mt-2">
          OAuth is supported: see the <strong>Auth</strong> tab for the
          OAuth scope list and redirect setup.
        </p>
      )}
    </>
  );
}

function answerWhen(m) {
  const triggerCount = m.triggerCount || 0;
  const triggers = m.triggers?.triggers || [];
  const examples = triggers.slice(0, 4).map((t) => t.name).filter(Boolean);
  const desc = (m.description || '').trim();
  return (
    <>
      <p>
        Reach for this adaptor whenever a workflow needs to read from or write
        to <strong>{m.label}</strong>
        {desc ? ` — ${desc.replace(/\.$/, '')}.` : '.'}
      </p>
      {triggerCount > 0 ? (
        <p className="mt-2">
          It supports <strong>{triggerCount}</strong> documented trigger
          {triggerCount === 1 ? '' : 's'}
          {examples.length > 0 && (
            <>
              {' '}({examples.join(', ')}
              {triggerCount > examples.length ? ', …' : ''})
            </>
          )}
          , so a workflow can run on a schedule, on a webhook, or on a polled
          change. See the <strong>Triggers</strong> tab.
        </p>
      ) : (
        <p className="mt-2">
          Triggers haven't been catalogued for this adaptor yet — drive it
          from a cron schedule or an upstream webhook in the meantime.
        </p>
      )}
    </>
  );
}

function answerHow(m) {
  const snippetCount = m.snippetCount || 0;
  const topOps = (m.operations || []).slice(0, 3).map((o) => o.name);
  return (
    <>
      <p>
        In a job step, import the adaptor and chain its operations:
      </p>
      <pre className="mt-2 overflow-x-auto rounded bg-slate-900 px-3 py-2 text-xs text-slate-100">
        {`import { ${topOps.join(', ') || 'operation'} } from "${m.packageName}";

${topOps[0] || 'operation'}({ /* params */ });`}
      </pre>
      <p className="mt-2">
        {snippetCount > 0 ? (
          <>
            The <strong>Snippets</strong> tab has{' '}
            <strong>{snippetCount}</strong> ready-to-paste example
            {snippetCount === 1 ? '' : 's'} grouped by category.
          </>
        ) : (
          <>
            Snippets haven't been seeded for this adaptor; the{' '}
            <strong>Operations</strong> tab shows the function signatures and
            JSDoc examples.
          </>
        )}
      </p>
    </>
  );
}

function answerWire(m) {
  const triggerCount = m.triggerCount || 0;
  return (
    <>
      <p>
        A typical wiring pattern is{' '}
        <em>trigger → fetch → transform → write</em>:
      </p>
      <ul className="mt-2 list-disc pl-5">
        <li>
          {triggerCount > 0
            ? `Pick a trigger from the Triggers tab to kick the workflow off when something happens in ${m.label}.`
            : `Drive the workflow from a cron or webhook trigger upstream of this adaptor.`}
        </li>
        <li>
          Chain operations from this adaptor's <strong>Operations</strong> tab,
          or combine with other adaptors to move data between systems.
        </li>
        <li>
          Use <code>state.data</code> to pass the previous step's response into
          the next operation — every operation reads from and writes to state.
        </li>
      </ul>
    </>
  );
}

function answerScale(m) {
  return (
    <>
      <p>
        A few rules of thumb when running <strong>{m.label}</strong> jobs at
        volume:
      </p>
      <ul className="mt-2 list-disc pl-5">
        <li>
          Prefer webhooks or push triggers over polling where the vendor
          supports them — polling burns rate limit and adds latency.
        </li>
        <li>
          Paginate list/search operations explicitly; don't assume one page is
          the whole result set.
        </li>
        <li>
          Make jobs idempotent — use external IDs so a replay doesn't create
          duplicates.
        </li>
        <li>
          Watch the vendor's rate limit headers; surface 429s as retries with
          backoff rather than failing the run.
        </li>
      </ul>
    </>
  );
}

function answerBest(m) {
  return (
    <>
      <ul className="list-disc pl-5">
        <li>
          Store credentials in OpenFn's credential store, never inline in job
          code.
        </li>
        <li>
          Keep each step small and composable — one HTTP call per operation
          makes failures easier to diagnose.
        </li>
        <li>
          Validate inbound payloads against the <strong>Data</strong> schemas
          before transforming them; trigger payloads can drift.
        </li>
        <li>
          Pin the adaptor version in <code>package.json</code> so an upstream
          change doesn't break a production workflow silently.
        </li>
        <li>
          Log enough context (resource ID, run ID, vendor request ID) to make
          incidents traceable end-to-end.
        </li>
      </ul>
    </>
  );
}

function collectSnippetCategories(snippets) {
  if (!Array.isArray(snippets)) return [];
  const seen = new Set();
  for (const s of snippets) {
    if (s?.category) seen.add(s.category);
  }
  return [...seen];
}
