'use client';

import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react';
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { Check } from 'lucide-react';

// Radix's Dropdown Menu primitive (accessible menu mechanics: focus,
// keyboard nav, outside-click/Escape, positioning) styled with Mutua's
// existing .lang-picker-trigger/.lang-picker-option tokens
// (liveExchange.css) instead of shadcn's default color tokens — so it
// matches every other picker in the app without a second theming system.
//
// modal defaults to false here (Radix defaults it to true): true locks
// body scroll and compensates for the vanished scrollbar by resizing the
// page, which visibly shifts anything sized off the viewport (e.g. the
// landing page's WebGL sky canvas) the moment the menu opens. This is a
// small inline toggle, not a blocking dialog, so it doesn't need that.

export function DropdownMenu(props: ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Root>) {
  return <DropdownMenuPrimitive.Root modal={false} {...props} />;
}
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
export const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup;

export const DropdownMenuContent = forwardRef<ElementRef<typeof DropdownMenuPrimitive.Content>, ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>>(
  function DropdownMenuContent({ className, sideOffset = 6, ...props }, ref) {
    return (
      <DropdownMenuPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        className={['picker-popover', className].filter(Boolean).join(' ')}
        {...props}
      />
    );
  },
);

export const DropdownMenuRadioItem = forwardRef<ElementRef<typeof DropdownMenuPrimitive.RadioItem>, ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.RadioItem>>(
  function DropdownMenuRadioItem({ className, children, ...props }, ref) {
    return (
      <DropdownMenuPrimitive.RadioItem
        ref={ref}
        className={['lang-picker-option', className].filter(Boolean).join(' ')}
        {...props}
      >
        {children}
        <DropdownMenuPrimitive.ItemIndicator className="picker-item-indicator">
          <Check size={14} strokeWidth={1.8} aria-hidden="true" />
        </DropdownMenuPrimitive.ItemIndicator>
      </DropdownMenuPrimitive.RadioItem>
    );
  },
);
