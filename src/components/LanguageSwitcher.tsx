import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Check } from 'lucide-react';
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '@/i18n';

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();

  return (
    <div className="space-y-2 w-full">
      {SUPPORTED_LANGUAGES.map(({ code, label, flag }) => (
        <Button
          key={code}
          variant={i18n.language === code ? 'default' : 'outline'}
          className="w-full justify-between h-10 text-sm"
          onClick={() => i18n.changeLanguage(code as SupportedLanguage)}
        >
          <span className="flex items-center gap-2">
            <span className="text-base">{flag}</span>
            <span>{label}</span>
          </span>
          {i18n.language === code && <Check className="w-4 h-4" />}
        </Button>
      ))}
    </div>
  );
}

