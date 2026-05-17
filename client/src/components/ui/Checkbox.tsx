import { forwardRef, type InputHTMLAttributes } from 'react';
import { Check } from 'lucide-react';

type Size = 'sm' | 'md';

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  /** Visual size — sm = 16px, md = 18px (default md). */
  size?: Size;
  /** Optional label rendered next to the box. Omit and wrap in your own
   *  <label> if you need richer markup. */
  label?: React.ReactNode;
  /** Extra class on the outer <label> wrapper (only used when `label` is set). */
  wrapperClassName?: string;
}

/**
 * Custom checkbox. The real <input> is visually hidden but kept in the DOM,
 * so native semantics work as expected — keyboard toggling, focus rings,
 * form submission, screen readers.
 *
 * The structure puts the <input>, the box-background, and the check icon as
 * direct siblings so Tailwind's `peer-checked:` selector reaches both the
 * background and the icon.
 *
 * If `label` is provided we render our own <label> wrapper. Otherwise the
 * component returns just the visual control and the caller wraps it.
 */
const Checkbox = forwardRef<HTMLInputElement, Props>(function Checkbox(
  { size = 'md', label, wrapperClassName = '', className = '', disabled, ...rest },
  ref
) {
  const boxClass = size === 'sm' ? 'w-4 h-4' : 'w-[18px] h-[18px]';
  const iconSize = size === 'sm' ? 11 : 13;

  const control = (
    <span className={`relative inline-flex shrink-0 ${boxClass}`}>
      {/* Real input — hidden visually, retains all native behaviour. */}
      <input
        ref={ref}
        type="checkbox"
        disabled={disabled}
        className={'peer absolute inset-0 opacity-0 m-0 cursor-pointer disabled:cursor-not-allowed ' + className}
        {...rest}
      />

      {/* Box background — sibling of input.peer, so peer-checked applies. */}
      <span
        aria-hidden="true"
        className={
          'pointer-events-none absolute inset-0 rounded-[5px] border bg-surface-800 border-surface-600 ' +
          'transition-colors ' +
          'peer-hover:border-surface-500 ' +
          'peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent-500 ' +
          'peer-checked:bg-accent-600 peer-checked:border-accent-500 ' +
          'peer-disabled:opacity-50'
        }
      />

      {/* Check icon — also a sibling of input.peer, hidden by default. */}
      <Check
        aria-hidden="true"
        size={iconSize}
        strokeWidth={3}
        className={
          'pointer-events-none absolute inset-0 m-auto text-white ' +
          'opacity-0 peer-checked:opacity-100 transition-opacity'
        }
      />
    </span>
  );

  if (!label) return control;

  return (
    <label
      className={
        'inline-flex items-center gap-2.5 select-none ' +
        (disabled ? 'cursor-not-allowed opacity-60 ' : 'cursor-pointer ') +
        wrapperClassName
      }
    >
      {control}
      <span className="text-sm text-surface-100">{label}</span>
    </label>
  );
});

export default Checkbox;
