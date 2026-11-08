'use client';

import { useEffect, useRef, useState } from 'react';
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

export default function LanguagePicker({ value, onChange, placeholder, disabled }: {
  value: Language | '';
  onChange: (value: Language) => void;
  placeholder: string;
  disabled?: boolean;
}) {
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
      <button
        type="button"
        className="live-select lang-picker-trigger"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={toggleOpen}
      >
        {value ? (
          <>
            <span className={`fi fi-${LANG_FLAG_CODE[value]} lang-picker-flag`} aria-hidden="true" />
            {LANG_NATIVE_NAME[value] || value}
          </>
        ) : (
          <span className="lang-picker-placeholder">{placeholder}</span>
        )}
        <span className="lang-picker-caret" aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="lang-picker-menu" data-placement={placement} role="listbox">
          {ORDERED_LANGUAGES.map(language => (
            <button
              key={language}
              type="button"
              role="option"
              aria-selected={value === language}
              data-active={value === language}
              className="lang-picker-option"
              onClick={() => { onChange(language); setOpen(false); }}
            >
              <span className={`fi fi-${LANG_FLAG_CODE[language]} lang-picker-flag`} aria-hidden="true" />
              {LANG_NATIVE_NAME[language] || language}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
