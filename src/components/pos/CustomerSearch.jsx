import React, { useState, useRef, useEffect } from 'react';
import { User, X, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function CustomerSearch({ customers, selectedId, onSelect }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  const selected = customers.find(c => c.id === selectedId);

  // Cerrar al hacer click fuera
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = query.trim()
    ? customers.filter(c =>
        c.is_active !== false && (
          c.name?.toLowerCase().includes(query.toLowerCase()) ||
          c.cedula?.includes(query) ||
          c.phone?.includes(query)
        )
      ).slice(0, 8)
    : [];

  const handleSelect = (c) => {
    onSelect(c.id, c.name);
    setOpen(false);
    setQuery('');
  };

  const handleClear = () => {
    onSelect('', '');
    setQuery('');
    setOpen(false);
  };

  if (selected && !open) {
    return (
      <div className="flex items-center gap-1.5 px-3 pt-2 pb-1 border-b">
        <User className="w-4 h-4 text-primary shrink-0" />
        <button
          className="flex-1 text-left min-w-0"
          onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 50); }}
        >
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-foreground truncate">{selected.name}</span>
          </div>
          {selected.branch_name && (
            <div className="text-[10px] text-muted-foreground mt-0.5">{selected.branch_name}</div>
          )}
        </button>
        <button onClick={handleClear} className="text-muted-foreground hover:text-destructive shrink-0">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative px-3 pt-2 pb-1 border-b">
      <div className="flex items-center gap-2">
        <User className="w-4 h-4 text-muted-foreground shrink-0" />
        <div className="flex items-center gap-1 flex-1">
          <Search className="w-3 h-3 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            placeholder="Buscar cliente por nombre o cédula..."
            className="flex-1 text-xs bg-transparent outline-none placeholder:text-muted-foreground"
          />
          {query && (
            <button onClick={() => { setQuery(''); setOpen(false); }} className="text-muted-foreground hover:text-foreground">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {open && filtered.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-50 bg-card border border-border rounded-b-lg shadow-lg max-h-48 overflow-y-auto">
          {filtered.map(c => (
            <button
              key={c.id}
              className="w-full text-left px-3 py-2 text-xs hover:bg-muted flex items-center justify-between gap-2"
              onMouseDown={(e) => { e.preventDefault(); handleSelect(c); }}
            >
              <span className="font-medium truncate">{c.name}</span>
              <div className="flex items-center gap-2 shrink-0">
                {c.branch_name && (
                  <span className="bg-secondary/20 text-secondary-foreground px-1.5 py-0.5 rounded text-[10px] font-medium">
                    {c.branch_name}
                  </span>
                )}
                {c.cedula && <span className="text-muted-foreground">{c.cedula}</span>}
              </div>
            </button>
          ))}
        </div>
      )}

      {open && query.length > 0 && filtered.length === 0 && (
        <div className="absolute left-0 right-0 top-full z-50 bg-card border border-border rounded-b-lg shadow-lg px-3 py-2 text-xs text-muted-foreground">
          Sin resultados
        </div>
      )}
    </div>
  );
}