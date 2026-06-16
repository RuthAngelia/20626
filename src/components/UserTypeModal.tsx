import { useState, useMemo } from 'react';
import { Store, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  BUSINESS_TYPES,
  SKIP_LIMIT,
  getSkipCount,
  incrementSkipCount,
  dismissUserTypeSurvey,
  markUserTypeAnswered,
  submitUserType,
} from '@/lib/user-type';

interface UserTypeModalProps {
  open: boolean;
  /** Dipanggil saat modal harus ditutup (apa pun alasannya). */
  onClose: () => void;
}

const BUSINESS_TYPE_KEYS = [
  'groceryStore',
  'coffeeShop',
  'cafeResto',
  'clothingStore',
  'grocery',
  'pharmacy',
  'hardwareStore',
  'electronics',
  'salonBarbershop',
  'laundry',
  'onlineSeller',
  'other',
] as const;

const OTHER_VALUE = 'Lainnya';

/**
 * Survei jenis usaha. Muncul saat user membuka halaman Laporan bila belum dijawab.
 * Boleh di-skip; setelah {@link SKIP_LIMIT} kali skip, tampilkan opsi
 * "Jangan tampilkan lagi".
 */
export default function UserTypeModal({ open, onClose }: UserTypeModalProps) {
  const { t } = useTranslation('reports');
  const [selected, setSelected] = useState<string | null>(null);
  const [otherText, setOtherText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const options = useMemo(
    () => BUSINESS_TYPES.map((value, i) => ({ value, label: t(`survey.types.${BUSINESS_TYPE_KEYS[i]}`) })),
    [t],
  );

  // Snapshot saat render: bila sudah melewati batas skip, tawarkan opsi
  // untuk tidak menampilkan lagi.
  const offerDontShowAgain = getSkipCount() >= SKIP_LIMIT;

  const isOther = selected === OTHER_VALUE;
  // Saat "Lainnya", value yang dikirim adalah teks bebas yang diisi user.
  const value = isOther ? otherText.trim() : selected;
  const canSubmit = !!value && !submitting;

  if (!open) return null;

  const handleSubmit = async () => {
    if (!canSubmit || !value) return;
    setSubmitting(true);
    markUserTypeAnswered(); // tandai dulu agar tidak muncul lagi meski request gagal
    void submitUserType(value);
    setSubmitting(false);
    toast.success(t('survey.thankYou'));
    onClose();
  };

  const handleSkip = () => {
    incrementSkipCount();
    onClose();
  };

  const handleDontShowAgain = () => {
    dismissUserTypeSurvey();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-background p-5 shadow-lg space-y-4">
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
            <Store className="w-7 h-7" />
          </div>
          <h2 className="text-base font-bold leading-snug">
            {t('survey.title')}
          </h2>
          <p className="text-xs text-muted-foreground">
            {t('survey.description')}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 max-h-[40vh] overflow-y-auto">
          {options.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setSelected(value)}
              className={cn(
                'rounded-xl border px-3 py-2.5 text-xs font-medium text-left transition-colors',
                selected === value
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border hover:bg-muted',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {isOther && (
          <Input
            autoFocus
            value={otherText}
            onChange={(e) => setOtherText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSubmit();
            }}
            maxLength={60}
            placeholder={t('survey.otherPlaceholder')}
          />
        )}

        <div className="space-y-2 pt-1">
          <Button
            className="w-full h-11 font-semibold gap-2"
            disabled={!canSubmit}
            onClick={handleSubmit}
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {t('survey.submit')}
          </Button>
          <Button
            variant="ghost"
            className="w-full h-9 text-sm text-muted-foreground"
            onClick={handleSkip}
            disabled={submitting}
          >
            {t('survey.skip')}
          </Button>
          {offerDontShowAgain && (
            <Button
              variant="ghost"
              className="w-full h-8 text-xs text-muted-foreground"
              onClick={handleDontShowAgain}
              disabled={submitting}
            >
              {t('survey.dontShowAgain')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
