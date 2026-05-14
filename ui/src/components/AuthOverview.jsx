import React from 'react';

const SCHEME_LABEL = {
  oauth2: 'OAuth 2.0',
  oauth1: 'OAuth 1.0',
  bearer: 'Bearer token',
  apikey: 'API key',
  'api-key': 'API key',
  basic: 'HTTP Basic',
  jwt: 'JWT',
  sasl: 'SASL',
  mtls: 'Mutual TLS',
  none: 'No authentication',
};

function describeMethod(schemes) {
  if (!schemes || schemes.length === 0) return null;
  const labeled = schemes.map((s) => SCHEME_LABEL[s] || s);
  if (labeled.length === 1) return labeled[0];
  if (labeled.length === 2) return `${labeled[0]} or ${labeled[1]}`;
  return `${labeled.slice(0, -1).join(', ')}, or ${labeled[labeled.length - 1]}`;
}

export default function AuthOverview({ manifest }) {
  const schema = manifest.configurationSchema;
  const oauth = manifest.oauthConfigurationSchema;
  const meta = manifest.metadata || {};
  const schemes = meta.auth?.schemes || [];
  const method = describeMethod(schemes);
  const authDocs = meta.auth?.docs;

  const noAuth = !schema && !oauth && schemes.length === 0;
  const fieldCount = schema?.properties
    ? Object.keys(schema.properties).length
    : 0;
  const requiredCount = schema?.required?.length || 0;

  return (
    <section className="rounded border border-slate-200 bg-white p-4">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
        How auth works
      </h2>
      {noAuth ? (
        <p className="text-sm text-slate-600">
          No credential schema or auth scheme is documented for{' '}
          <strong>{manifest.label}</strong> yet. Check the vendor's docs for the
          expected mechanism.
        </p>
      ) : (
        <div className="space-y-2 text-sm text-slate-700">
          <p>
            <strong>{manifest.label}</strong>{' '}
            {method ? (
              <>
                authenticates with <strong>{method}</strong>.
              </>
            ) : (
              <>requires credentials to connect.</>
            )}
          </p>
          {oauth && (
            <p>
              An OAuth flow is supported — the OAuth fields below describe the
              scopes and redirect configuration.
            </p>
          )}
          {schema && (
            <p>
              The adaptor expects {fieldCount} configuration field
              {fieldCount === 1 ? '' : 's'}
              {requiredCount > 0 && (
                <>
                  {' '}({requiredCount} required)
                </>
              )}
              . Required values are flagged in the schema below.
            </p>
          )}
          {!schema && schemes.length > 0 && (
            <p>
              No credential schema is published yet — the adaptor relies on{' '}
              <strong>{method}</strong> per the vendor docs.
            </p>
          )}
          {authDocs && (
            <p>
              Vendor auth reference:{' '}
              <a
                href={authDocs}
                target="_blank"
                rel="noreferrer"
                className="text-sky-600 underline hover:text-sky-800"
              >
                {authDocs}
              </a>
            </p>
          )}
        </div>
      )}
    </section>
  );
}
