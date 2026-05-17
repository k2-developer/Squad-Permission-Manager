import { useEffect, useRef, useState, useMemo, type ReactNode } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: ReactNode;
  /** Optional disabled flag. */
  disabled?: boolean;
}

export interface SelectGroup {
  label: ReactNode;
  options: SelectOption[];
}

interface Props {
  value: string;
  onChange: (next: string) => void;
  /** Flat option list. Use either `options` or `groups`, not both. */
  options?: SelectOption[];
  /** Grouped options (renders captioned sections). */
  groups?: SelectGroup[];
  placeholder?: string;
  /** Visible when no option matches `value`. Defaults to the placeholder. */
  emptyLabel?: ReactNode;
  /** Extra class on the trigger button — useful for fixed widths. */
  className?: string;
  disabled?: boolean;
  /** Native `name` (rendered as a hidden input so the value is included in
   *  FormData when the parent is a `<form>`). */
  name?: string;
}

/**
 * Custom dropdown matching the dark/tactical theme of the panel — replaces
 * the browser-native `<select>` which renders with OS-default colours and
 * breaks the visual language of every other input.
 *
 * Supports flat options (`options`) or captioned groups (`groups`). The
 * trigger button looks like our `.input` so it fits next to text inputs
 * in toolbars. Keyboard:
 *   - Enter/Space — open / pick highlighted option
 *   - ArrowUp/Down — move highlight
 *   - Escape — close
 *
 * The native `<input type="hidden">` mirrors `value` so the component works
 * inside an uncontrolled `<form>` with `FormData`.
 */
export default function Select({
  value,
  onChange,
  options,
  groups,
  placeholder,
  emptyLabel,
  className = '',
  disabled,
  name,
}: Props) {
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  // Normalize into a flat list for keyboard navigation, while keeping
  // group structure for rendering.
  const flatOptions = useMemo<SelectOption[]>(() => {
    if (groups) return groups.flatMap((g) => g.options);
    return options ?? [];
  }, [groups, options]);

  const selected = flatOptions.find((o) => o.value === value);
  const triggerLabel = selected
    ? selected.label
    : emptyLabel ?? placeholder ?? '';

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (
        !triggerRef.current?.contains(e.target as Node) &&
        !listRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  // Reset highlight when opening; default to the currently-selected row.
  useEffect(() => {
    if (open) {
      const idx = flatOptions.findIndex((o) => o.value === value);
      setHighlightIndex(idx >= 0 ? idx : 0);
    }
  }, [open, value, flatOptions]);

  const commit = (val: string) => {
    onChange(val);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const onTriggerKey = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
    }
  };

  const onListKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex((i) => Math.min(flatOptions.length - 1, i + 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex((i) => Math.max(0, i - 1));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const target = flatOptions[highlightIndex];
      if (target && !target.disabled) commit(target.value);
    }
  };

  // Used for assigning a global "highlightable index" while iterating
  // groups — increments across groups so keyboard nav stays continuous.
  let cursor = -1;

  return (
    <div className={`relative inline-flex flex-col ${className}`}>
      {name && <input type="hidden" name={name} value={value} />}
      <button
        type="button"
        ref={triggerRef}
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        onKeyDown={onTriggerKey}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={
          'group relative flex items-center justify-between gap-2 rounded-lg ' +
          'border border-surface-600 bg-surface-800 px-3.5 py-2.5 text-[15px] text-surface-100 ' +
          'hover:border-surface-500 ' +
          'focus:outline-none focus:ring-2 focus:ring-accent-500/50 focus:border-accent-500 ' +
          'disabled:opacity-50 disabled:cursor-not-allowed ' +
          'transition-colors min-h-[42px]'
        }
      >
        <span
          className={
            'truncate text-left flex-1 ' +
            (selected ? 'text-surface-100' : 'text-surface-500')
          }
        >
          {triggerLabel}
        </span>
        <ChevronDown
          size={16}
          className={`text-surface-500 transition-transform shrink-0 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          ref={listRef}
          role="listbox"
          tabIndex={-1}
          autoFocus
          onKeyDown={onListKey}
          className={
            'absolute z-50 top-full left-0 right-0 mt-1.5 max-h-72 overflow-y-auto ' +
            'rounded-lg border border-surface-700/70 bg-surface-900 ' +
            'shadow-[0_18px_48px_-12px_rgba(0,0,0,0.65)] py-1.5 ' +
            'focus:outline-none'
          }
        >
          {groups ? (
            groups.map((g, gi) => (
              <div key={gi}>
                <div className="px-3 pt-2 pb-1 font-mono text-[10px] uppercase tracking-wider text-surface-500">
                  {g.label}
                </div>
                {g.options.map((opt) => {
                  cursor++;
                  return renderOption(opt, cursor === highlightIndex, () => commit(opt.value), setHighlightIndex, cursor, value === opt.value);
                })}
              </div>
            ))
          ) : (
            (options ?? []).map((opt) => {
              cursor++;
              return renderOption(opt, cursor === highlightIndex, () => commit(opt.value), setHighlightIndex, cursor, value === opt.value);
            })
          )}
          {flatOptions.length === 0 && (
            <div className="px-3 py-2 text-sm text-surface-500">…</div>
          )}
        </div>
      )}
    </div>
  );
}

function renderOption(
  opt: SelectOption,
  highlighted: boolean,
  onPick: () => void,
  setHighlight: (i: number) => void,
  index: number,
  isSelected: boolean
) {
  return (
    <div
      key={opt.value}
      role="option"
      aria-selected={isSelected}
      onMouseEnter={() => setHighlight(index)}
      onMouseDown={(e) => { e.preventDefault(); if (!opt.disabled) onPick(); }}
      className={
        'flex items-center gap-2.5 px-3 py-2 mx-1 rounded-md text-[14px] cursor-pointer ' +
        (opt.disabled
          ? 'opacity-50 cursor-not-allowed text-surface-500 '
          : highlighted
            ? 'bg-accent-600/15 text-accent-100 '
            : 'text-surface-200 hover:bg-surface-800/60 ')
      }
    >
      <span className="flex-1 truncate">{opt.label}</span>
      {isSelected && <Check size={14} className="text-accent-400 shrink-0" />}
    </div>
  );
}
