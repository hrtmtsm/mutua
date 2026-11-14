import { forwardRef, type ComponentPropsWithoutRef } from 'react';

type ButtonProps = ComponentPropsWithoutRef<'button'>;

// Adapted from shadcn/ui's Button pattern for Mutua's existing theme.
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button({ className, type = 'button', ...props }, ref) {
    return (
      <button
        ref={ref}
        type={type}
        data-slot="button"
        className={['focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed', className].filter(Boolean).join(' ')}
        {...props}
      />
    );
  },
);
