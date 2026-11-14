import { ArrowLeft, X } from 'lucide-react';

export function DetailBackButton({ label, onClick, disabled, icon = 'close' }: {
 label: string;
 onClick: () => void;
 disabled?: boolean;
 icon?: 'back' | 'close';
}) {
 const Icon = icon === 'back' ? ArrowLeft : X;
 return (
  <button type="button" aria-label={label} onClick={onClick} disabled={disabled} className="grid h-9 w-9 place-items-center rounded-lg hover:bg-current/5 focus-visible:outline focus-visible:outline-2 disabled:opacity-50">
   <Icon className="size-5" aria-hidden="true" />
  </button>
 );
}
