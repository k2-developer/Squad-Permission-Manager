import { useI18n, type Locale } from '../../i18n';
import { Globe } from 'lucide-react';

export default function LangSwitch() {
  const { locale, setLocale } = useI18n();

  const toggle = () => {
    setLocale(locale === 'en' ? 'ru' : 'en');
  };

  return (
    <button
      onClick={toggle}
      className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-surface-400 hover:bg-surface-800 hover:text-surface-200 transition-colors"
      title={locale === 'en' ? 'Switch to Russian' : 'Переключить на English'}
    >
      <Globe size={14} />
      {locale.toUpperCase()}
    </button>
  );
}
