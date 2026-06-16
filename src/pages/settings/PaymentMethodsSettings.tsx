import { useLiveQuery } from 'dexie-react-hooks';
import { db, type PaymentMethod } from '@/lib/db';
import { useState } from 'react';
import { CreditCard, Plus, Trash2, Edit2, ChevronLeft } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/use-auth';
import LockedPage from '@/components/LockedPage';
import { useTranslation } from 'react-i18next';

export default function PaymentMethodsSettings() {
  const { t } = useTranslation('settings');
  const { can } = useAuth();
  const paymentMethods = useLiveQuery(() => db.paymentMethods.toArray());

  const [pmDialog, setPmDialog] = useState(false);
  const [pmName, setPmName] = useState('');
  const [pmCategory, setPmCategory] = useState('tunai');
  const [pmEditId, setPmEditId] = useState<number | null>(null);

  if (!can('manage_categories_payments')) {
    return (
      <LockedPage
        title={t('paymentMethod.locked.title')}
        permissionLabel={t('paymentMethod.locked.permissionLabel')}
      />
    );
  }

  const openPmAdd = () => { setPmEditId(null); setPmName(''); setPmCategory('tunai'); setPmDialog(true); };
  const openPmEdit = (pm: PaymentMethod) => { setPmEditId(pm.id!); setPmName(pm.name); setPmCategory(pm.category); setPmDialog(true); };
  const savePm = async () => {
    if (!pmName.trim()) return;
    if (pmEditId) await db.paymentMethods.update(pmEditId, { name: pmName.trim(), category: pmCategory });
    else await db.paymentMethods.add({ name: pmName.trim(), category: pmCategory, isDefault: false, createdAt: new Date() });
    setPmDialog(false);
    toast.success(t('paymentMethod.toast.saved'));
  };
  const deletePm = async (id: number) => { await db.paymentMethods.delete(id); toast.success(t('paymentMethod.toast.deleted')); };

  return (
    <div className="px-4 pt-6 pb-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link to="/settings">
            <Button variant="ghost" size="icon" className="h-8 w-8"><ChevronLeft className="w-4 h-4" /></Button>
          </Link>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-primary" />
            {t('paymentMethod.title')}
          </h1>
        </div>
        <Button size="sm" onClick={openPmAdd} className="h-9 gap-1.5"><Plus className="w-4 h-4" /> {t('paymentMethod.addButton')}</Button>
      </div>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-3 space-y-1">
          {paymentMethods && paymentMethods.length === 0 && (
            <p className="text-xs text-muted-foreground py-1.5">{t('paymentMethod.empty')}</p>
          )}
          {paymentMethods?.map(pm => (
            <div key={pm.id} className="flex items-center justify-between py-1.5">
              <div>
                <p className="text-sm font-medium">{pm.name}</p>
                <p className="text-[10px] text-muted-foreground capitalize">{pm.category}</p>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openPmEdit(pm)}><Edit2 className="w-3 h-3" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deletePm(pm.id!)}><Trash2 className="w-3 h-3" /></Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={pmDialog} onOpenChange={setPmDialog}>
        <DialogContent className="max-w-[95vw] rounded-xl">
          <DialogHeader><DialogTitle>{pmEditId ? t('paymentMethod.dialog.editTitle') : t('paymentMethod.dialog.addTitle')}</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5"><Label>{t('paymentMethod.dialog.nameLabel')}</Label><Input value={pmName} onChange={e => setPmName(e.target.value)} placeholder={t('paymentMethod.dialog.namePlaceholder')} className="h-11" /></div>
            <div className="space-y-1.5">
              <Label>{t('paymentMethod.dialog.categoryLabel')}</Label>
              <div className="grid grid-cols-4 gap-2">
                {['tunai', 'transfer', 'e-wallet', 'qris'].map(c => (
                  <button key={c} onClick={() => setPmCategory(c)} className={`p-2 rounded-lg text-xs font-semibold border-2 capitalize transition-colors ${pmCategory === c ? 'border-primary bg-primary/5 text-primary' : 'border-muted text-muted-foreground'}`}>{c}</button>
                ))}
              </div>
            </div>
            <Button className="w-full h-11" onClick={savePm} disabled={!pmName.trim()}>{t('paymentMethod.dialog.save')}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
