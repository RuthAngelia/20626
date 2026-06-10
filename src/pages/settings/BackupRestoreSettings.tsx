import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Product } from '@/lib/db';
import { Download, Upload, ChevronLeft } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { exportBackupData } from '@/components/BackupReminder';
import { useAuth } from '@/hooks/use-auth';
import LockedPage from '@/components/LockedPage';

export default function BackupRestoreSettings() {
  const { can } = useAuth();
  const storeSettings = useLiveQuery(() => db.storeSettings.toCollection().first());

  if (!can('manage_backup')) {
    return <LockedPage title="Backup & Restore" permissionLabel="Kelola Backup" />;
  }

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        if (!text.trim()) { toast.error('File kosong'); return; }
        const data = JSON.parse(text);
        if (!data.version) { toast.error('File tidak valid'); return; }

        // Validate at least 1 table has data
        const hasSomeData = ['categories', 'products', 'suppliers', 'transactions', 'paymentMethods'].some(
          key => Array.isArray(data[key]) && data[key].length > 0
        );
        if (!hasSomeData) { toast.error('File backup tidak berisi data'); return; }

        // CR-7: Snapshot existing data before clearing
        const snapshot = {
          categories: await db.categories.toArray(),
          products: await db.products.toArray(),
          suppliers: await db.suppliers.toArray(),
          customers: await db.customers.toArray(),
          stockIns: await db.stockIns.toArray(),
          stockOuts: await db.stockOuts.toArray(),
          hppHistory: await db.hppHistory.toArray(),
          paymentMethods: await db.paymentMethods.toArray(),
          transactions: await db.transactions.toArray(),
          transactionItems: await db.transactionItems.toArray(),
          storeSettings: await db.storeSettings.toArray(),
          users: await db.users.toArray(),
          units: await db.units.toArray(),
          expenseCategories: await db.expenseCategories.toArray(),
          expenses: await db.expenses.toArray(),
        };

        try {
          // Clear all tables
          await db.categories.clear(); await db.products.clear(); await db.suppliers.clear();
          await db.stockIns.clear(); await db.stockOuts.clear(); await db.hppHistory.clear();
          await db.paymentMethods.clear(); await db.transactions.clear(); await db.transactionItems.clear();
          await db.storeSettings.clear();
          // Only clear users if backup file has them (v4+); preserve user accounts
          // when restoring older backups (v1-v3) so login still works after restore.
          if (Array.isArray(data.users)) {
            await db.users.clear();
          }
          await db.units.clear();
          // Only clear expense tables if backup file has them (v5+).
          // Older backups (v1-v4) didn't include them; keep existing rows so the
          // user doesn't lose locally-tracked expenses when restoring an older file.
          if (Array.isArray(data.expenseCategories) || Array.isArray(data.expenses)) {
            await db.expenseCategories.clear();
            await db.expenses.clear();
          }
          // Only clear customers if backup file has them (v10+ export).
          // Older backups didn't include them; keep existing rows so the user
          // doesn't lose locally-managed customers when restoring an older file.
          if (Array.isArray(data.customers)) {
            await db.customers.clear();
          }

          // BulkAdd from file
          if (data.categories?.length) await db.categories.bulkAdd(data.categories);
          if (data.products?.length) {
            const normalizedProducts = (data.products as Product[]).map((p) =>
              p && p.trackStock === undefined ? { ...p, trackStock: true } : p
            );
            await db.products.bulkAdd(normalizedProducts);
          }
          if (data.suppliers?.length) await db.suppliers.bulkAdd(data.suppliers);
          if (data.customers?.length) await db.customers.bulkAdd(data.customers);
          if (data.stockIns?.length) await db.stockIns.bulkAdd(data.stockIns);
          if (data.stockOuts?.length) await db.stockOuts.bulkAdd(data.stockOuts);
          if (data.hppHistory?.length) await db.hppHistory.bulkAdd(data.hppHistory);
          if (data.paymentMethods?.length) await db.paymentMethods.bulkAdd(data.paymentMethods);
          if (data.transactions?.length) await db.transactions.bulkAdd(data.transactions);
          if (data.storeSettings?.length) await db.storeSettings.bulkAdd(data.storeSettings);
          if (data.users?.length) await db.users.bulkAdd(data.users);
          if (data.expenseCategories?.length) await db.expenseCategories.bulkAdd(data.expenseCategories);
          if (data.expenses?.length) await db.expenses.bulkAdd(data.expenses);

          // Units (v3+ backup) or harvest from products (v1/v2 backup)
          if (Array.isArray(data.units) && data.units.length > 0) {
            await db.units.bulkAdd(data.units);
          } else {
            const now = new Date();
            const defaults = ['pcs', 'kg', 'gram', 'liter', 'ml', 'porsi', 'cup', 'botol', 'bungkus'];
            const seen = new Set<string>();
            const toAdd: any[] = [];

            for (const name of defaults) {
              seen.add(name);
              toAdd.push({ name, isDefault: 1, createdAt: now, isDeleted: 0, deletedAt: null });
            }
            if (Array.isArray(data.products)) {
              for (const p of data.products) {
                const u = (p?.unit as string | undefined)?.trim();
                if (!u || seen.has(u)) continue;
                seen.add(u);
                toAdd.push({ name: u, isDefault: 0, createdAt: now, isDeleted: 0, deletedAt: null });
              }
            }
            if (toAdd.length) await db.units.bulkAdd(toAdd);
          }

          // Handle transactionItems
          if (data.transactionItems?.length) {
            // v2 format: items already in separate table
            await db.transactionItems.bulkAdd(data.transactionItems);
          } else if (data.version === 1 && data.transactions?.length) {
            // v1 format: migrate embedded items[] to transactionItems
            for (const t of data.transactions) {
              if (Array.isArray(t.items) && t.items.length > 0) {
                const records = t.items.map((item: any) => ({
                  transactionId: t.id,
                  productId: item.productId,
                  productName: item.productName,
                  quantity: item.quantity,
                  price: item.price,
                  hpp: item.hpp,
                  discountType: item.discountType,
                  discountValue: item.discountValue,
                  discountAmount: item.discountAmount,
                  subtotal: item.subtotal,
                }));
                await db.transactionItems.bulkAdd(records);
              }
            }
          }

          toast.success('Data berhasil di-restore!');
        } catch (importErr) {
          // CR-7: Rollback — restore from snapshot
          try {
            await db.categories.clear(); await db.products.clear(); await db.suppliers.clear();
            await db.stockIns.clear(); await db.stockOuts.clear(); await db.hppHistory.clear();
            await db.paymentMethods.clear(); await db.transactions.clear(); await db.transactionItems.clear();
            await db.storeSettings.clear();
            await db.users.clear();
            await db.units.clear();
            await db.expenseCategories.clear();
            await db.expenses.clear();
            await db.customers.clear();

            if (snapshot.categories.length) await db.categories.bulkAdd(snapshot.categories);
            if (snapshot.products.length) await db.products.bulkAdd(snapshot.products);
            if (snapshot.suppliers.length) await db.suppliers.bulkAdd(snapshot.suppliers);
            if (snapshot.customers.length) await db.customers.bulkAdd(snapshot.customers);
            if (snapshot.stockIns.length) await db.stockIns.bulkAdd(snapshot.stockIns);
            if (snapshot.stockOuts.length) await db.stockOuts.bulkAdd(snapshot.stockOuts);
            if (snapshot.hppHistory.length) await db.hppHistory.bulkAdd(snapshot.hppHistory);
            if (snapshot.paymentMethods.length) await db.paymentMethods.bulkAdd(snapshot.paymentMethods);
            if (snapshot.transactions.length) await db.transactions.bulkAdd(snapshot.transactions);
            if (snapshot.transactionItems.length) await db.transactionItems.bulkAdd(snapshot.transactionItems);
            if (snapshot.storeSettings.length) await db.storeSettings.bulkAdd(snapshot.storeSettings);
            if (snapshot.users.length) await db.users.bulkAdd(snapshot.users);
            if (snapshot.units.length) await db.units.bulkAdd(snapshot.units);
            if (snapshot.expenseCategories.length) await db.expenseCategories.bulkAdd(snapshot.expenseCategories);
            if (snapshot.expenses.length) await db.expenses.bulkAdd(snapshot.expenses);

            toast.error('Import gagal, data dikembalikan');
          } catch {
            toast.error('Import gagal dan rollback gagal. Coba restore dari file backup.');
          }
        }
      } catch { toast.error('Gagal membaca file'); }
    };
    input.click();
  };

  return (
    <div className="px-4 pt-6 pb-4 space-y-4">
      <div className="flex items-center gap-2">
        <Link to="/settings">
          <Button variant="ghost" size="icon" className="h-8 w-8"><ChevronLeft className="w-4 h-4" /></Button>
        </Link>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Download className="w-5 h-5 text-primary" />
          Backup & Restore
        </h1>
      </div>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-4 space-y-2">
          <Button variant="outline" className="w-full h-10 text-sm gap-2" onClick={exportBackupData}>
            <Download className="w-4 h-4" /> Export Backup (JSON)
          </Button>
          <Button variant="outline" className="w-full h-10 text-sm gap-2" onClick={handleImport}>
            <Upload className="w-4 h-4" /> Import / Restore Data
          </Button>
          {storeSettings?.lastBackupAt && (
            <p className="text-[10px] text-muted-foreground text-center">Terakhir backup: {new Date(storeSettings.lastBackupAt).toLocaleString('id-ID')}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
