import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AlertTriangle } from 'lucide-react';
import Modal from './Modal';
import { useI18n } from '../../i18n';

interface ConfirmOptions {
  /** Body text of the confirmation. Required. */
  message: string;
  /** Optional title — defaults to a generic "Confirm action" string. */
  title?: string;
  /** Label for the confirm button. Defaults to "Delete" when `danger`. */
  confirmLabel?: string;
  /** Label for the cancel button. Defaults to t('cancel'). */
  cancelLabel?: string;
  /** Style confirm button as destructive (red). */
  danger?: boolean;
}

type ConfirmFn = (options: ConfirmOptions | string) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

interface OpenState extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [open, setOpen] = useState<OpenState | null>(null);
  const resolveRef = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((options) => {
    const opts: ConfirmOptions =
      typeof options === 'string' ? { message: options } : options;
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
      setOpen({ ...opts, resolve });
    });
  }, []);

  const finish = (value: boolean) => {
    const r = resolveRef.current;
    resolveRef.current = null;
    setOpen(null);
    r?.(value);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        open={!!open}
        onClose={() => finish(false)}
        title={open?.title ?? t('confirmTitle')}
      >
        <div className="space-y-5">
          <div className="flex items-start gap-3">
            <div
              className={
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ' +
                (open?.danger
                  ? 'bg-red-500/10 text-red-400'
                  : 'bg-amber-500/10 text-amber-400')
              }
            >
              <AlertTriangle size={18} />
            </div>
            <p className="text-sm leading-relaxed text-surface-200">
              {open?.message}
            </p>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => finish(false)}
              className="btn-secondary"
              autoFocus
            >
              {open?.cancelLabel ?? t('cancel')}
            </button>
            <button
              type="button"
              onClick={() => finish(true)}
              className={open?.danger ? 'btn-danger' : 'btn-primary'}
            >
              {open?.confirmLabel ?? (open?.danger ? t('delete') : t('confirm'))}
            </button>
          </div>
        </div>
      </Modal>
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider');
  return ctx;
}
