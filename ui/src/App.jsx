import React, { useEffect, useMemo, useState } from 'react';
import Sidebar from './components/Sidebar.jsx';
import AdapterView from './components/AdapterView.jsx';

export default function App() {
  const [adapters, setAdapters] = useState([]);
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/adapters/index.json')
      .then((r) => r.json())
      .then((data) => {
        setAdapters(data);
        const hash = window.location.hash.replace('#/', '');
        const initial = data.find((a) => a.name === hash) || data[0];
        if (initial) setSelected(initial.name);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (selected) window.location.hash = `/${selected}`;
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
      />
      <main className="flex-1 overflow-y-auto bg-white">
        {loading && (
          <div className="p-8 text-slate-400">Loading adapter manifest…</div>
        )}
        {!loading && selected && <AdapterView key={selected} name={selected} />}
        {!loading && !selected && (
          <div className="p-8 text-slate-400">No adapter selected.</div>
        )}
      </main>
    </div>
  );
}
