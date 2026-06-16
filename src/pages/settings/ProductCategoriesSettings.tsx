import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Category } from '@/lib/db';
import { useState } from 'react';
import { Tag, Plus, Trash2, Edit2, ChevronLeft } from 'lucide-react';
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

const emojiOptions = ['📦', '🍕', '🥤', '🍜', '🧃', '🎽', '💊', '🧹', '📱', '🛒', '🎁', '✂️'];

export default function ProductCategoriesSettings() {
  const { t } = useTranslation('settings');
  const { can } = useAuth();
  const categories = useLiveQuery(() => db.categories.where('isDeleted').equals(0).toArray());

  const [catDialog, setCatDialog] = useState(false);
  const [catName, setCatName] = useState('');
  const [catIcon, setCatIcon] = useState('📦');
  const [catColor, setCatColor] = useState('#FF6B35');
  const [catEditId, setCatEditId] = useState<number | null>(null);

  if (!can('manage_categories_payments')) {
    return (
      <LockedPage
        title={t('productCategory.locked.title')}
        permissionLabel={t('productCategory.locked.permissionLabel')}
      />
    );
  }

  const openCatAdd = () => { setCatEditId(null); setCatName(''); setCatIcon('📦'); setCatColor('#FF6B35'); setCatDialog(true); };
  const openCatEdit = (c: Category) => { setCatEditId(c.id!); setCatName(c.name); setCatIcon(c.icon); setCatColor(c.color); setCatDialog(true); };
  const saveCat = async () => {
    if (!catName.trim()) return;
    if (catEditId) await db.categories.update(catEditId, { name: catName.trim(), icon: catIcon, color: catColor });
    else await db.categories.add({ name: catName.trim(), icon: catIcon, color: catColor, createdAt: new Date(), isDeleted: 0, deletedAt: null });
    setCatDialog(false);
    toast.success(t('productCategory.toast.saved'));
  };
  const deleteCat = async (id: number) => { await db.categories.update(id, { isDeleted: 1, deletedAt: new Date() }); toast.success(t('productCategory.toast.deleted')); };

  return (
    <div className="px-4 pt-6 pb-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link to="/settings">
            <Button variant="ghost" size="icon" className="h-8 w-8"><ChevronLeft className="w-4 h-4" /></Button>
          </Link>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Tag className="w-5 h-5 text-primary" />
            {t('productCategory.title')}
          </h1>
        </div>
        <Button size="sm" onClick={openCatAdd} className="h-9 gap-1.5"><Plus className="w-4 h-4" /> {t('productCategory.addButton')}</Button>
      </div>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-3 space-y-1">
          {categories && categories.length === 0 && (
            <p className="text-xs text-muted-foreground py-1.5">{t('productCategory.empty')}</p>
          )}
          {categories?.map(c => (
            <div key={c.id} className="flex items-center justify-between py-1.5">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded flex items-center justify-center text-sm" style={{ backgroundColor: c.color + '20' }}>{c.icon}</span>
                <span className="text-sm font-medium">{c.name}</span>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openCatEdit(c)}><Edit2 className="w-3 h-3" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteCat(c.id!)}><Trash2 className="w-3 h-3" /></Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={catDialog} onOpenChange={setCatDialog}>
        <DialogContent className="max-w-[95vw] rounded-xl">
          <DialogHeader><DialogTitle>{catEditId ? t('productCategory.dialog.editTitle') : t('productCategory.dialog.addTitle')}</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5"><Label>{t('productCategory.dialog.nameLabel')}</Label><Input value={catName} onChange={e => setCatName(e.target.value)} placeholder={t('productCategory.dialog.namePlaceholder')} className="h-11" /></div>
            <div className="space-y-1.5">
              <Label>{t('productCategory.dialog.iconLabel')}</Label>
              <div className="flex flex-wrap gap-2">
                {emojiOptions.map(e => (
                  <button key={e} onClick={() => setCatIcon(e)} className={`w-10 h-10 rounded-lg text-lg flex items-center justify-center border-2 transition-colors ${catIcon === e ? 'border-primary bg-primary/5' : 'border-muted'}`}>{e}</button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t('productCategory.dialog.colorLabel')}</Label>
              <Input type="color" value={catColor} onChange={e => setCatColor(e.target.value)} className="h-11 w-20" />
            </div>
            <Button className="w-full h-11" onClick={saveCat} disabled={!catName.trim()}>{t('productCategory.dialog.save')}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
