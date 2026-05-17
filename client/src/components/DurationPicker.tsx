import { useEffect, useMemo, useState } from 'react';
import { Infinity as InfinityIcon } from 'lucide-react';
import { useI18n, type TranslationKey } from '../i18n';

type Unit = 'hours' | 'days' | 'weeks' | 'months';

const UNIT_HOURS: Record<Unit, number> = {
  hours: 1,
  days: 24,
  weeks: 24 * 7,
  months: 24 * 30,
};

interface Preset {
  hours: number | null; // null = forever
  labelKey: TranslationKey;
}

const PRESETS: Preset[] = [
  { hours: null, labelKey: 'durForever' },
  { hours: 24, labelKey: 'durPreset1d' },
  { hours: 24 * 7, labelKey: 'durPreset7d' },
  { hours: 24 * 30, labelKey: 'durPreset30d' },
  { hours: 24 * 90, labelKey: 'durPreset90d' },
  { hours: 24 * 365, labelKey: 'durPreset1y' },
];

interface Props {
  /** Hours of access, or null for forever. */
  value: number | null;
  onChange: (hours: number | null) => void;
}

export default function DurationPicker({ value, onChange }: Props) {
  const { t, locale } = useI18n();
  const [customValue, setCustomValue] = useState<string>('');
  const [customUnit, setCustomUnit] = useState<Unit>('days');
  // Whether the user is using a preset or typing custom — UI hint only.
  const [mode, setMode] = useState<'preset' | 'custom'>('preset');

  // Keep the custom inputs in sync with whatever the picker is showing —
  // both for restoring a saved value AND for mirroring preset clicks.
  // Without this, picking "1 day" leaves the custom row empty, which makes
  // the form feel half-disconnected.
  useEffect(() => {
    if (value === null || value <= 0) return;
    for (const unit of ['months', 'weeks', 'days', 'hours'] as Unit[]) {
      if (value % UNIT_HOURS[unit] === 0) {
        setCustomValue(String(value / UNIT_HOURS[unit]));
        setCustomUnit(unit);
        return;
      }
    }
    setCustomValue(String(value));
    setCustomUnit('hours');
  }, [value]);

  const expiresAtPreview = useMemo(() => {
    if (value === null) return null;
    if (value <= 0) return null;
    const d = new Date(Date.now() + value * 3600000);
    return d.toLocaleString(locale === 'ru' ? 'ru-RU' : 'en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }, [value, locale]);

  const pickPreset = (hours: number | null) => {
    setMode('preset');
    onChange(hours);
  };

  const updateCustom = (rawValue: string, unit: Unit) => {
    setMode('custom');
    setCustomValue(rawValue);
    setCustomUnit(unit);
    const n = parseInt(rawValue);
    if (!Number.isFinite(n) || n <= 0) {
      onChange(null);
      return;
    }
    onChange(n * UNIT_HOURS[unit]);
  };

  return (
    <div className="space-y-2">
      <label className="block text-xs font-medium text-surface-400">
        {t('durTitle')}
      </label>

      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((p) => {
          const active = mode === 'preset' && value === p.hours;
          return (
            <button
              key={p.labelKey}
              type="button"
              onClick={() => pickPreset(p.hours)}
              className={
                'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-colors ' +
                (active
                  ? 'border-accent-500 bg-accent-500/10 text-accent-300'
                  : 'border-surface-700 bg-surface-900/40 text-surface-300 hover:border-surface-600 hover:text-surface-100')
              }
            >
              {p.hours === null && <InfinityIcon size={12} />}
              {t(p.labelKey)}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2">
        <input
          type="number"
          min={1}
          value={customValue}
          onChange={(e) => updateCustom(e.target.value, customUnit)}
          onFocus={() => setMode('custom')}
          placeholder={t('durCustomPlaceholder')}
          className={
            'input flex-1 max-w-[140px] ' +
            (mode === 'custom' ? 'border-accent-500/60' : '')
          }
        />
        <select
          value={customUnit}
          onChange={(e) => updateCustom(customValue, e.target.value as Unit)}
          className="input max-w-[140px]"
        >
          <option value="hours">{t('durUnitHours')}</option>
          <option value="days">{t('durUnitDays')}</option>
          <option value="weeks">{t('durUnitWeeks')}</option>
          <option value="months">{t('durUnitMonths')}</option>
        </select>
      </div>

      <p className="text-[11px] text-surface-500">
        {value === null
          ? t('durPreviewForever')
          : expiresAtPreview
            ? `${t('durPreviewUntil')} ${expiresAtPreview}`
            : ''}
      </p>
    </div>
  );
}
