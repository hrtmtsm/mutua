'use client';
import { Clock3, Sunrise, Sun, Sunset, Moon } from 'lucide-react';
import type { SkyMode } from '@/components/sky/palette';
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

const ICONS = { auto: Clock3, morning: Sunrise, day: Sun, evening: Sunset, night: Moon };

export default function SkyTimePicker({ value, onChange, options }: {
  value: SkyMode; onChange: (value: SkyMode) => void; options: { value: SkyMode; label: string }[];
}) {
  const Icon = ICONS[value];
  const selected = options.find(option => option.value === value);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="live-select lang-picker-trigger">
        <Icon size={16} strokeWidth={1.6} className="lang-picker-icon" aria-hidden="true" />
        {selected?.label}
        <span className="lang-picker-caret" aria-hidden="true">▾</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuRadioGroup value={value} onValueChange={next => onChange(next as SkyMode)}>
          {options.map(option => {
            const ItemIcon = ICONS[option.value];
            return (
              <DropdownMenuRadioItem key={option.value} value={option.value}>
                <ItemIcon size={16} strokeWidth={1.6} className="lang-picker-icon" aria-hidden="true" />
                {option.label}
              </DropdownMenuRadioItem>
            );
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
