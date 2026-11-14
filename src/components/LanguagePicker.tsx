'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { LANGUAGES, type Language } from '@/lib/types';
import { LANG_FLAG_CODE, LANG_NATIVE_NAME } from '@/lib/constants';
import './liveExchange.css';

// Most commonly requested languages first; everything else follows in its
// existing order. Not every language gets equal billing in the picker —
// major ones for now, the full list is still selectable below them.
const MAJOR_ORDER: Language[] = [
  'English', 'Japanese', 'Korean', 'Mandarin', 'Spanish',
  'French', 'German', 'Portuguese', 'Italian', 'Arabic', 'Hindi', 'Russian',
];
const ORDERED_LANGUAGES: Language[] = [
  ...MAJOR_ORDER,
  ...LANGUAGES.filter(language => !MAJOR_ORDER.includes(language)),
];

export default function LanguagePicker({ value, onChange, placeholder, label, disabled }: {
  value: Language | '';
  onChange: (value: Language) => void;
  placeholder: string;
  label?: string;
  disabled?: boolean;
}) {
  return <OptionPicker value={value} onChange={onChange} placeholder={placeholder} label={label} disabled={disabled}
    options={ORDERED_LANGUAGES.map(language => ({
      value: language,
      label: LANG_NATIVE_NAME[language] || language,
      icon: <span className={`fi fi-${LANG_FLAG_CODE[language]} lang-picker-flag`} aria-hidden="true" />,
    }))} />;
}

export function OptionPicker<Value extends string>({ value, onChange, placeholder, label, disabled, options, singleColumn }: {
  value: Value | '';
  onChange: (value: Value) => void;
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  options: readonly { value: Value; label: string; icon?: ReactNode }[];
  singleColumn?: boolean;
}) {
  const id = useId();
  const selected = options.find(option => option.value === value);
  const selectedName = selected?.label;
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<'below' | 'above'>('below');
  const rootRef = useRef<HTMLDivElement>(null);

  const toggleOpen = () => {
    if (!open && rootRef.current) {
      const rect = rootRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      // Flip upward only when there isn't room below and there's more room above.
      setPlacement(spaceBelow < 200 && spaceAbove > spaceBelow ? 'above' : 'below');
    }
    setOpen(value => !value);
  };

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div className="lang-picker" ref={rootRef}>
      {label && <label className="lang-picker-label" htmlFor={id}>{label}</label>}
      <button
        id={label ? id : undefined}
        type="button"
        className="live-select lang-picker-trigger"
        disabled={disabled}
        aria-label={label && selectedName ? `${label}: ${selectedName}` : undefined}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={toggleOpen}
      >
        {selected ? (
          <>
            {selected.icon}
            {selectedName}
          </>
        ) : (
          <span className="lang-picker-placeholder">{placeholder}</span>
        )}
        <span className="lang-picker-caret" aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="lang-picker-menu" data-placement={placement} role="listbox" aria-label={label} style={singleColumn ? { gridTemplateColumns: 'minmax(0, 1fr)', width: '100%', minWidth: 0 } : undefined}>
          {options.map(option => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={value === option.value}
              data-active={value === option.value}
              className="lang-picker-option"
              onClick={() => { onChange(option.value); setOpen(false); rootRef.current?.querySelector('button')?.focus(); }}
            >
              {option.icon}
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
