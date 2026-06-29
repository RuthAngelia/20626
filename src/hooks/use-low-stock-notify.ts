import { useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, isStockManaged } from '@/lib/db';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

export function useLowStockNotify(threshold = 5) {
  const { t } = useTranslation('dashboard'); // Assuming low stock translations are here
  const notifiedProductIds = useRef<Set<number>>(new Set());

  // Watch products
  const products = useLiveQuery(() => db.products.filter(p => p.isDeleted === 0 && isStockManaged(p)).toArray());

  useEffect(() => {
    if (!products) return;

    products.forEach(product => {
      if (!product.id) return;
      
      const isLowStock = product.stock <= threshold;
      const hasNotified = notifiedProductIds.current.has(product.id);

      if (isLowStock && !hasNotified) {
        // Trigger notification
        toast.warning(`Stok Menipis: ${product.name}`, {
          description: `Sisa stok tinggal ${product.stock} ${product.unit}`,
          duration: 5000,
        });
        notifiedProductIds.current.add(product.id);
      } else if (!isLowStock && hasNotified) {
        // Reset notification state if stock goes back up
        notifiedProductIds.current.delete(product.id);
      }
    });
  }, [products, threshold, t]);
}
