import { useState, useRef, useEffect } from 'react';
import { searchAddressSuggestions, type AddressSuggestion } from '@/utils/googleMaps';

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSelect: (s: { address: string; lat: number; lng: number }) => void;
  geocodeStatus?: 'idle' | 'loading' | 'ok' | 'error';
  placeholder?: string;
  inputClassName?: string;
  autoFocus?: boolean;
  onBlur?: () => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

export default function AddressAutocomplete({
  value, onChange, onSelect, geocodeStatus,
  placeholder, inputClassName, autoFocus, onBlur, onKeyDown,
}: Props): JSX.Element {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch suggestions debounced
  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (value.length < 3) { setSuggestions([]); setOpen(false); return; }
    debounceRef.current = setTimeout(async () => {
      const results = await searchAddressSuggestions(value);
      setSuggestions(results);
      setOpen(results.length > 0);
      setActiveIdx(-1);
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [value]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function select(s: AddressSuggestion) {
    onChange(s.label);
    onSelect({ address: s.label, lat: s.lat, lng: s.lng });
    setOpen(false);
    setSuggestions([]);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (open && suggestions.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, suggestions.length - 1)); return; }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, -1)); return; }
      if (e.key === 'Enter' && activeIdx >= 0) { e.preventDefault(); select(suggestions[activeIdx]); return; }
      if (e.key === 'Escape') { setOpen(false); return; }
    }
    onKeyDown?.(e);
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={value}
        autoComplete="off"
        autoFocus={autoFocus}
        placeholder={placeholder ?? 'Ej: Gran Vía 32, Madrid'}
        className={inputClassName}
        onChange={e => { onChange(e.target.value); }}
        onFocus={() => { if (suggestions.length > 0) setOpen(true); }}
        onBlur={onBlur}
        onKeyDown={handleKeyDown}
      />

      {/* Status icon */}
      {geocodeStatus && (
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
          {geocodeStatus === 'loading' && (
            <svg className="h-4 w-4 animate-spin text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round"/>
            </svg>
          )}
          {geocodeStatus === 'ok' && (
            <svg className="h-4 w-4 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
          {geocodeStatus === 'error' && (
            <svg className="h-4 w-4 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </span>
      )}

      {/* Suggestions dropdown */}
      {open && (
        <ul className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-800">
          {suggestions.map((s, i) => (
            <li
              key={i}
              onMouseDown={() => select(s)}
              className={`flex cursor-pointer items-start gap-2 px-4 py-3 text-sm transition ${
                i === activeIdx
                  ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                  : 'text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              <svg className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
              </svg>
              <span className="truncate font-medium">{s.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
