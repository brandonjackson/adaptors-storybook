import React, { useEffect, useMemo, useState } from 'react';
import Sidebar from './components/Sidebar.jsx';
import AdapterView from './components/AdapterView.jsx';
import SystemOverview from './components/SystemOverview.jsx';

const OVERVIEW = '__overview__';

export default function App() {
  const [adapters, setAdapters] = useState([]);
  const [selected, setSelected] = useState(OVERVIEW);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/adapters/index.json')
      .then((r) => r.json())
      .then((data) => {
        setAdapters(data);
        const hash = window.location.hash.replace('#/', '');
        if (hash && data.find((a) => a.name === hash)) {
          setSelected(hash);
        } else {
          setSelected(OVERVIEW);
        }
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (selected === OVERVIEW) {
      if (window.location.hash) window.location.hash = '';
    } else if (selected) {
      window.location.hash = `/${selected}`;
    }
  }, [selected]);

  const filtered = useMemo(() => {
    if (!filter.trim()) return adapters;
    const q = filter.toLowerCase();
    return adapters.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        (a.label || '').toLowerCase().includes(q) ||
        (a.description || '').toLowerCase().includes(q)
    );
  }, [adapters, filter]);

  return (
    <div className="flex h-full w-full">
      <Sidebar
        adapters={filtered}
        totalCount={adapters.length}
        selected={selected}
        onSelect={setSelected}
        filter={filter}
        onFilter={setFilter}
        overviewId={OVERVIEW}
      />
      <main className="flex-1 overflow-y-auto bg-white">
        {loading && (
          <div className="p-8 text-slate-400">Loading adapter manifest…</div>
        )}
        {!loading && selected === OVERVIEW && (
          <SystemOverview adapters={adapters} onSelect={setSelected} />
        )}
        {!loading && selected && selected !== OVERVIEW && (
          <AdapterView key={selected} name={selected} />
        )}
      </main>
    </div>
  );
}
