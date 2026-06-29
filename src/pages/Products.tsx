import { useLiveQuery } from 'dexie-react-hooks';
import { db, isStockManaged, type Product, type Category } from '@/lib/db';
import { useState, useRef } from 'react';
import { Plus, Search, Edit2, Trash2, Package as PackageIcon, Camera, X, Copy, Infinity as InfinityIcon, ScanLine, Upload, Download, AlertTriangle, CheckCircle2, XCircle, Loader2, FileSpreadsheet } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { compressImage } from '@/lib/image-utils';
import { trackEvent } from '@/lib/analytics';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/use-auth';
import BarcodeScanner from '@/components/BarcodeScanner';
import { useTranslation } from 'react-i18next';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { downloadOrShareFile } from '@/lib/file-utils';
import { audit } from '@/lib/audit';

const CURRENCY_SYMBOL: Record<string, string> = { id: 'Rp', en: 'Rp', ms: 'Rp' };
const NUMBER_LOCALES: Record<string, string> = { id: 'id-ID', en: 'en-US', ms: 'ms-MY' };

interface ParsedRow {
  rowNum: number;
  name: string;
  sku: string;
  categoryName: string;
  price: number;
  hpp: number;
  trackStock: boolean;
  stock: number;
  unit: string;
  barcode?: string;
  description?: string;
  isValid: boolean;
  errors: string[];
}

export default function Produk() {
  const { currentUser, can } = useAuth();
  const canManage = can('manage_products');
  const { t, i18n } = useTranslation('products');
  const numberLocale = NUMBER_LOCALES[i18n.language] ?? 'id-ID';
  const currencySymbol = CURRENCY_SYMBOL[i18n.language] ?? 'Rp';

  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [scanTarget, setScanTarget] = useState<'sku' | 'barcode' | null>(null);

  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [importRows, setImportRows] = useState<ParsedRow[]>([]);
  const [hasMoreThan100, setHasMoreThan100] = useState(false);
  const importFileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [price, setPrice] = useState('');
  const [hpp, setHpp] = useState('');
  const [stock, setStock] = useState('');
  const [trackStock, setTrackStock] = useState(true);
  const [unit, setUnit] = useState('pcs');
  const [barcode, setBarcode] = useState('');
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState<string | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [hasVariants, setHasVariants] = useState(false);
  const [variants, setVariants] = useState<ProductVariant[]>([]);

  const products = useLiveQuery(() => db.products.where('isDeleted').equals(0).toArray());
  const categories = useLiveQuery(() => db.categories.where('isDeleted').equals(0).toArray());
  const units = useLiveQuery(() => db.units.where('isDeleted').equals(0).toArray());

  const unitOptions = (() => {
    const names = (units ?? []).map(u => u.name);
    if (unit && !names.includes(unit)) names.push(unit);
    return names;
  })();

  const filtered = products?.filter(p => {
    const q = search.toLowerCase();
    const matchSearch =
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      (p.description?.toLowerCase().includes(q) ?? false);
    const matchCategory = filterCategory === 'all' || p.categoryId === Number(filterCategory);
    return matchSearch && matchCategory;
  }) ?? [];

  const getCategoryName = (catId: number) => categories?.find(c => c.id === catId)?.name ?? '-';
  const getCategoryColor = (catId: number) => categories?.find(c => c.id === catId)?.color ?? '#999';

  const rp = (n: number) => `${currencySymbol} ${n.toLocaleString(numberLocale)}`;

  const openAdd = () => {
    if (!categories || categories.length === 0) {
      toast.error(t('toast.noCategory'));
      return;
    }
    setEditProduct(null);
    setName(''); setSku(''); setCategoryId(categories[0]?.id?.toString() ?? ''); setPrice(''); setHpp(''); setStock(''); setTrackStock(true); setUnit('pcs'); setBarcode(''); setDescription(''); setPhoto(undefined);
    setHasVariants(false); setVariants([]);
    setDialogOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditProduct(p);
    setName(p.name); setSku(p.sku); setCategoryId(p.categoryId.toString()); setPrice(p.price.toString()); setHpp(p.hpp.toString()); setStock(p.stock.toString()); setTrackStock(isStockManaged(p)); setUnit(p.unit); setBarcode(p.barcode ?? ''); setDescription(p.description ?? ''); setPhoto(p.photo);
    setHasVariants(p.hasVariants || false); setVariants(p.variants || []);
    setDialogOpen(true);
  };

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error(t('toast.invalidImage'));
      return;
    }
    try {
      const compressed = await compressImage(file);
      setPhoto(compressed);
    } catch {
      toast.error(t('toast.processImageFailed'));
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSave = async () => {
    if (!name.trim() || !categoryId || (!hasVariants && !sku.trim())) return;

    if (hasVariants && variants.length === 0) {
      toast.error('Produk dengan varian harus memiliki minimal 1 varian');
      return;
    }

    const data = {
      name: name.trim(),
      sku: hasVariants ? "" : sku.trim(),
      categoryId: Number(categoryId),
      price: hasVariants ? (variants[0]?.price || 0) : Number(price) || 0,
      hpp: hasVariants ? (variants[0]?.hpp || 0) : Number(hpp) || 0,
      stock: hasVariants ? variants.reduce((sum, v) => sum + v.stock, 0) : Number(stock) || 0,
      hasVariants,
      variants,
      trackStock,
      unit: unit.trim() || 'pcs',
      description: description.trim() || undefined,
      barcode: barcode.trim() || undefined,
      photo: photo || undefined,
      updatedAt: new Date(),
      updatedBy: currentUser?.id,
    };

    if (editProduct?.id) {
      await db.products.update(editProduct.id, data);
      await audit.update('product', editProduct.id, data.name, `Update product ${data.sku}`, currentUser);
      trackEvent('edit_product');
    } else {
      const newId = await db.products.add({
        ...data,
        createdAt: new Date(),
        createdBy: currentUser?.id,
        isDeleted: 0,
        deletedAt: null,
      } as Product);
      await audit.create('product', newId as number, data.name, `Create product ${data.sku}`, currentUser);
      trackEvent('create_product');
    }
    setDialogOpen(false);
  };

  const handleDelete = async () => {
    if (deleteId) {
      const product = await db.products.get(deleteId);
      await db.products.update(deleteId, {
        isDeleted: 1,
        deletedAt: new Date(),
        updatedBy: currentUser?.id,
      });
      await audit.delete('product', deleteId, product?.name || 'Unknown', 'Delete product', currentUser);
      setDeleteId(null);
    }
  };

  const downloadTemplate = async () => {
    try {
      const ExcelJSModule = await import('exceljs');
      const ExcelJS = (ExcelJSModule as unknown as { default?: typeof ExcelJSModule }).default ?? ExcelJSModule;
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Template Produk');

      worksheet.columns = [
        { header: 'Nama Produk *', key: 'name', width: 25 },
        { header: 'SKU *', key: 'sku', width: 15 },
        { header: 'Kategori *', key: 'category', width: 18 },
        { header: 'Harga Jual *', key: 'price', width: 15 },
        { header: 'HPP', key: 'hpp', width: 15 },
        { header: 'Kelola Stok (Ya/Tidak)', key: 'trackStock', width: 22 },
        { header: 'Stok Awal', key: 'stock', width: 15 },
        { header: 'Satuan *', key: 'unit', width: 12 },
        { header: 'Barcode', key: 'barcode', width: 15 },
        { header: 'Deskripsi', key: 'description', width: 30 }
      ];

      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF4F46E5' }
        };
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      });
      headerRow.height = 24;

      worksheet.addRow({
        name: 'Kopi Susu Gula Aren',
        sku: 'KOPI-001',
        category: 'Minuman',
        price: 15000,
        hpp: 8000,
        trackStock: 'Ya',
        stock: 50,
        unit: 'pcs',
        barcode: '8991234567890',
        description: 'Kopi susu segar dengan gula aren murni'
      });

      const refSheet = workbook.addWorksheet('Daftar Referensi');
      refSheet.columns = [
        { header: 'Kategori yang Tersedia', key: 'categories', width: 25 },
        { header: '', width: 5 },
        { header: 'Satuan yang Tersedia', key: 'units', width: 25 }
      ];

      const refHeaderRow = refSheet.getRow(1);
      refHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      refHeaderRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0284C7' } };
      refHeaderRow.getCell(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D9488' } };

      const cats = categories || [];
      const unts = units || [];
      const maxRows = Math.max(cats.length, unts.length);

      for (let i = 0; i < maxRows; i++) {
        refSheet.addRow([
          cats[i] ? cats[i].name : '',
          '',
          unts[i] ? unts[i].name : ''
        ]);
      }

      const buffer = await workbook.xlsx.writeBuffer();
      await downloadOrShareFile(buffer as ArrayBuffer, {
        fileName: 'Template_Import_Produk.xlsx',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        dialogTitle: 'Simpan / Bagikan Template',
        shareTitle: 'Template Import Produk',
      });
      toast.success('Template berhasil diunduh!');
    } catch (err) {
      console.error(err);
      toast.error('Gagal mengunduh template');
    }
  };

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);
    setIsValidating(true);
    setHasMoreThan100(false);
    setImportRows([]);

    try {
      const ExcelJSModule = await import('exceljs');
      const ExcelJS = (ExcelJSModule as unknown as { default?: typeof ExcelJSModule }).default ?? ExcelJSModule;
      const workbook = new ExcelJS.Workbook();
      const reader = new FileReader();

      reader.onload = async (evt) => {
        try {
          const buffer = evt.target?.result as ArrayBuffer;
          await workbook.xlsx.load(buffer);

          const worksheet = workbook.worksheets[0];
          if (!worksheet) {
            toast.error('File Excel kosong atau tidak valid.');
            setIsValidating(false);
            return;
          }

          const tempRows: ParsedRow[] = [];
          const skuInFile = new Set<string>();

          const activeCats = categories || [];
          const activeUnts = units || [];

          const allDbProducts = await db.products.toArray();
          const dbSkus = new Set(allDbProducts.map(p => p.sku.toLowerCase().trim()));
          const dbProductsBySku = new Map(allDbProducts.map(p => [p.sku.toLowerCase().trim(), p.name]));

          let rowCount = 0;
          worksheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return;

            let hasValue = false;
            row.eachCell((cell) => {
              if (cell.value !== null && cell.value !== undefined && cell.value !== '') {
                hasValue = true;
              }
            });
            if (!hasValue) return;

            rowCount++;
            if (rowCount > 100) {
              setHasMoreThan100(true);
              return;
            }

            const getVal = (col: number): string => {
              const cell = row.getCell(col);
              if (cell.value && typeof cell.value === 'object') {
                if ('richText' in cell.value) return cell.value.richText.map(t => t.text).join('').trim();
                if ('result' in cell.value) return String(cell.value.result ?? '').trim();
                if ('text' in cell.value) return String(cell.value.text ?? '').trim();
                return '';
              }
              return cell.value !== undefined && cell.value !== null ? String(cell.value).trim() : '';
            };

            const name = getVal(1);
            const sku = getVal(2);
            const categoryName = getVal(3);
            const priceStr = getVal(4);
            const hppStr = getVal(5);
            const trackStockStr = getVal(6);
            const stockStr = getVal(7);
            const unit = getVal(8);
            const barcode = getVal(9) || undefined;
            const description = getVal(10) || undefined;

            const errors: string[] = [];

            if (!name) errors.push(t('excel.errorNameRequired'));
            if (!sku) errors.push(t('excel.errorSkuRequired'));
            else {
              const skuLower = sku.toLowerCase().trim();
              if (skuInFile.has(skuLower)) errors.push(t('excel.errorSkuDupExcel'));
              else skuInFile.add(skuLower);
              if (dbSkus.has(skuLower)) {
                const existingName = dbProductsBySku.get(skuLower);
                errors.push(t('excel.errorSkuDupDb') + ` ("${existingName}")`);
              }
            }

            const matchedCat = activeCats.find(c => c.name.toLowerCase().trim() === categoryName.toLowerCase().trim());
            if (!categoryName) errors.push(t('excel.errorCatNotFound'));
            else if (!matchedCat) errors.push(t('excel.errorCatNotFound') + `: "${categoryName}"`);

            const matchedUnit = activeUnts.find(u => u.name.toLowerCase().trim() === unit.toLowerCase().trim());
            if (!unit) errors.push(t('excel.errorUnitNotFound'));
            else if (!matchedUnit) errors.push(t('excel.errorUnitNotFound') + `: "${unit}"`);

            const cleanNumber = (val: string): number => {
              if (!val) return 0;
              let clean = val.replace(/Rp/gi, '').replace(/\s+/g, '');
              const lastDot = clean.lastIndexOf('.');
              const lastComma = clean.lastIndexOf(',');
              if (lastDot > lastComma) clean = clean.replace(/,/g, '');
              else if (lastComma > lastDot) clean = clean.replace(/\./g, '').replace(/,/g, '.');
              else {
                const match = clean.match(/[.,](\d+)$/);
                if (match) {
                  const decimals = match[1];
                  if (decimals.length === 3) clean = clean.replace(/[.,]/g, '');
                  else clean = clean.replace(/[.,]/g, '.');
                }
              }
              const parsed = Number(clean);
              return isNaN(parsed) ? -1 : parsed;
            };

            const price = cleanNumber(priceStr);
            const hpp = hppStr ? cleanNumber(hppStr) : 0;
            const stock = stockStr ? cleanNumber(stockStr) : 0;

            if (price < 0) errors.push(t('excel.errorPriceInvalid'));
            if (hpp < 0) errors.push(t('excel.errorHppInvalid'));

            let trackStock = true;
            if (trackStockStr) {
              const lower = trackStockStr.toLowerCase();
              if (lower === 'tidak' || lower === 'no' || lower === 'false' || lower === '0' || lower === 'salah') trackStock = false;
            }

            if (trackStock && stock < 0) errors.push(t('excel.errorStockInvalid'));

            tempRows.push({ rowNum: rowNumber, name, sku, categoryName, price: price >= 0 ? price : 0, hpp: hpp >= 0 ? hpp : 0, trackStock, stock: stock >= 0 ? stock : 0, unit, barcode, description, isValid: errors.length === 0, errors });
          });

          setImportRows(tempRows);
          setIsValidating(false);
        } catch (err) {
          console.error(err);
          toast.error('Gagal membaca file Excel.');
          setIsValidating(false);
        }
      };
      reader.onerror = () => { toast.error('Gagal membaca file.'); setIsValidating(false); };
      reader.readAsArrayBuffer(file);
    } catch (err) {
      console.error(err);
      toast.error('Gagal memproses file.');
      setIsValidating(false);
    }
  };

  const handleSaveImport = async () => {
    const validRows = importRows.filter(r => r.isValid);
    if (validRows.length === 0) { toast.error('Tidak ada data valid yang bisa disimpan.'); return; }

    try {
      const now = new Date();
      const activeCats = categories || [];
      const newProducts: Product[] = validRows.map(r => {
        const matchedCat = activeCats.find(c => c.name.toLowerCase().trim() === r.categoryName.toLowerCase().trim());
        const categoryId = matchedCat?.id || 0;
        return { name: r.name, sku: r.sku, categoryId, price: r.price, hpp: r.hpp, stock: r.trackStock ? r.stock : 0, trackStock: r.trackStock, unit: r.unit, barcode: r.barcode, description: r.description, photo: undefined, createdAt: now, updatedAt: now, isDeleted: 0, deletedAt: null, createdBy: currentUser?.id, updatedBy: currentUser?.id, hasVariants: false, variants: [] };
      });
      await db.products.bulkAdd(newProducts);
      trackEvent('import_products_excel');
      toast.success(t('excel.toastSuccess', { count: newProducts.length }));
      setImportDialogOpen(false);
      setImportRows([]);
      setImportFile(null);
    } catch (err) {
      console.error(err);
      toast.error('Gagal menyimpan produk ke database.');
    }
  };

  return (
    <div className="px-4 pt-6 pb-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <PackageIcon className="w-5 h-5 text-primary" />
          {t('title')}
        </h1>
        {canManage && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setImportDialogOpen(true)} className="h-9 gap-1.5">
              <Upload className="w-4 h-4" />
              {t('excel.importButton')}
            </Button>
            <Button size="sm" onClick={openAdd} className="h-9 gap-1.5">
              <Plus className="w-4 h-4" />
              {t('addButton')}
            </Button>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder={t('searchPlaceholder')} value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-10" />
        </div>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-[120px] h-10">
            <SelectValue placeholder={t('filterCategory')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('filterAll')}</SelectItem>
            {categories?.map(c => (
              <SelectItem key={c.id} value={c.id!.toString()}>{c.icon} {c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <p className="text-xs text-muted-foreground">{t('productCount', { count: filtered.length })}</p>

      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <PackageIcon className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">{t('empty.title')}</p>
          {canManage && (
            <Button variant="outline" size="sm" className="mt-3" onClick={openAdd}>
              <Plus className="w-4 h-4 mr-1" /> {t('empty.addButton')}
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(p => (
            <Card key={p.id} className="border-0 shadow-sm">
              <CardContent className="p-3">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                    {p.photo ? <img src={p.photo} alt={p.name} className="w-full h-full object-cover" /> : <PackageIcon className="w-5 h-5 text-muted-foreground/40" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold truncate" title={p.name}>{p.name}</span>
                        <span className="text-[10px] text-muted-foreground">{p.sku}</span>
                        {p.hasVariants && <span className="text-[9px] bg-primary/10 text-primary px-1 rounded w-max mt-0.5">{p.variants?.length || 0} Varian</span>}
                      </div>
                      <Badge variant="outline" className="text-[10px] shrink-0 ml-auto" style={{ borderColor: getCategoryColor(p.categoryId), color: getCategoryColor(p.categoryId) }}>
                        {getCategoryName(p.categoryId)}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="text-sm font-bold text-primary">
                        {p.hasVariants && p.variants && p.variants.length > 0 ? (
                          (() => {
                            const prices = p.variants.map(v => v.price);
                            const min = Math.min(...prices);
                            const max = Math.max(...prices);
                            return min === max ? rp(min) : `${rp(min)} - ${rp(max)}`;
                          })()
                        ) : (rp(p.price))}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      {isStockManaged(p) ? (
                        <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded', p.stock <= 5 ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success')}>
                          Stok: {p.stock} {p.unit}
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-primary/10 text-primary flex items-center gap-1">
                          <InfinityIcon className="w-3 h-3" />
                          Unmanaged
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    {canManage && (
                      <>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(p)}><Edit2 className="w-3.5 h-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteId(p.id!)}><Trash2 className="w-3.5 h-3.5" /></Button>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-[95vw] rounded-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editProduct ? t('dialog.titleEdit') : t('dialog.titleAdd')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>{t('dialog.photoLabel')}</Label>
              <div className="flex items-center gap-3">
                <div className="w-20 h-20 rounded-xl bg-muted border-2 border-dashed border-border flex items-center justify-center overflow-hidden cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                  {photo ? <img src={photo} className="w-full h-full object-cover" /> : <Camera className="w-6 h-6 text-muted-foreground/50" />}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => fileInputRef.current?.click()}>Ubah Foto</Button>
                  {photo && <Button type="button" variant="ghost" size="sm" className="h-8 text-xs text-destructive" onClick={() => setPhoto(undefined)}>Hapus</Button>}
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoSelect} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>{t('dialog.nameLabel')} *</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Contoh: Kopi Susu" className="h-11" />
            </div>

            <div className="space-y-1.5">
              <Label>{t('dialog.categoryLabel')} *</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger className="h-11"><SelectValue placeholder="Pilih kategori" /></SelectTrigger>
                <SelectContent>
                  {(categories && categories.length > 0) ? categories.map(c => (
                    <SelectItem key={c.id} value={c.id!.toString()}>{c.icon} {c.name}</SelectItem>
                  )) : <SelectItem value="__empty" disabled>Tidak ada kategori</SelectItem>}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between mt-4 mb-2">
              <Label htmlFor="has-variants" className="cursor-pointer">Produk memiliki varian (M/L/XL, dll)</Label>
              <Switch id="has-variants" checked={hasVariants} onCheckedChange={setHasVariants} />
            </div>

            {!hasVariants ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>SKU *</Label>
                  <div className="relative"><Input value={sku} onChange={e => setSku(e.target.value)} placeholder="SKU001" className="pr-10" /><Button variant="ghost" size="icon" className="absolute right-0 top-0 h-full text-muted-foreground" onClick={() => setScanTarget('sku')}><Camera className="w-4 h-4" /></Button></div>
                </div>
                <div className="space-y-1.5">
                  <Label>Harga *</Label>
                  <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">{currencySymbol}</span><Input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="15000" className="pl-9" /></div>
                </div>
                <div className="space-y-1.5">
                  <Label>HPP</Label>
                  <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">{currencySymbol}</span><Input type="number" value={hpp} onChange={e => setHpp(e.target.value)} placeholder="10000" className="pl-9" /></div>
                </div>
                <div className="space-y-1.5">
                  <Label className="flex items-center justify-between"><span>Stok</span><Switch checked={trackStock} onCheckedChange={setTrackStock} /></Label>
                  <div className="relative"><Input type="number" value={stock} onChange={e => setStock(e.target.value)} placeholder="100" className="pr-16" disabled={!trackStock} /><div className="absolute right-0 top-0 h-full flex items-center pr-1 text-muted-foreground"><Select value={unit} onValueChange={setUnit}><SelectTrigger className="h-7 border-0 shadow-none text-xs w-[60px] px-1 bg-transparent focus:ring-0"><SelectValue placeholder="Satuan" /></SelectTrigger><SelectContent align="end">{unitOptions.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent></Select></div></div>
                </div>
              </div>
            ) : (
              <div className="space-y-3 bg-muted/30 p-3 rounded-lg border border-border mt-2">
                <div className="flex items-center justify-between"><Label>Daftar Varian</Label><Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => { const id = crypto.randomUUID(); setVariants([...variants, { id, name: '', sku: `${sku}-${variants.length + 1}`, price: 0, hpp: 0, stock: 0 }]); }}>+ Tambah Varian</Button></div>
                {variants.map((variant, index) => (
                  <div key={variant.id} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-start border-b pb-2 last:border-0 last:pb-0">
                    <div className="space-y-1"><Input placeholder="Nama (Large)" className="h-8 text-xs" value={variant.name} onChange={(e) => { const newV = [...variants]; newV[index].name = e.target.value; setVariants(newV); }} /><Input placeholder="SKU Varian" className="h-8 text-xs" value={variant.sku} onChange={(e) => { const newV = [...variants]; newV[index].sku = e.target.value; setVariants(newV); }} /></div>
                    <div className="space-y-1"><Input type="number" placeholder="Harga" className="h-8 text-xs" value={variant.price || ''} onChange={(e) => { const newV = [...variants]; newV[index].price = Number(e.target.value) || 0; setVariants(newV); }} /><Input type="number" placeholder="HPP" className="h-8 text-xs" value={variant.hpp || ''} onChange={(e) => { const newV = [...variants]; newV[index].hpp = Number(e.target.value) || 0; setVariants(newV); }} /></div>
                    <div className="space-y-1"><Input type="number" placeholder="Stok" className="h-8 text-xs" value={variant.stock || ''} disabled={!trackStock} onChange={(e) => { const newV = [...variants]; newV[index].stock = Number(e.target.value) || 0; setVariants(newV); }} /></div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { const newV = [...variants]; newV.splice(index, 1); setVariants(newV); }}><X className="w-4 h-4" /></Button>
                  </div>
                ))}
                {variants.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">Belum ada varian ditambahkan</p>}
              </div>
            )}

            <div className="space-y-1.5 mt-2">
              <Label>{t('dialog.barcodeLabel')}</Label>
              <div className="flex gap-2">
                  variant="outline"
                  size="icon"
                  className="h-11 w-11 shrink-0"
                  title={t('dialog.copyFromSku')}
                  onClick={() => setBarcode(sku.trim())}
                >
                  <Copy className="w-4 h-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-11 w-11 shrink-0"
                  title={t('dialog.scanCamera')}
                  onClick={() => setScanTarget('barcode')}
                >
                  <ScanLine className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t('dialog.descriptionLabel')}</Label>
              <Textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder={t('dialog.descriptionPlaceholder')}
                rows={3}
                maxLength={500}
              />
              <p className="text-[10px] text-muted-foreground text-right">{description.length}{t('dialog.descriptionCounter')}</p>
            </div>
            <Button className="w-full h-12 text-base font-semibold" onClick={handleSave} disabled={!name.trim() || !categoryId || !sku.trim()}>
              {editProduct ? t('saveButton.edit') : t('saveButton.add')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="max-w-[90vw] rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('deleteDialog.description')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('deleteDialog.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">{t('deleteDialog.confirm')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Import Excel Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={(open) => {
        setImportDialogOpen(open);
        if (!open) {
          setImportFile(null);
          setImportRows([]);
          setHasMoreThan100(false);
          if (importFileInputRef.current) importFileInputRef.current.value = '';
        }
      }}>
        <DialogContent className="max-w-[95vw] sm:max-w-[80vw] md:max-w-[70vw] lg:max-w-[60vw] xl:max-w-[50vw] rounded-xl max-h-[90vh] flex flex-col p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-primary" />
              {t('excel.dialogTitle')}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 my-2 pr-1">
            {!importFile ? (
              // Step 1: Upload and template download
              <div className="space-y-6 py-4">
                <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
                  <h3 className="font-semibold text-sm flex items-center gap-1.5">
                    <Download className="w-4 h-4 text-primary" />
                    {t('excel.step1')}
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {t('excel.step1Desc')}
                  </p>
                  <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-1.5">
                    <Download className="w-3.5 h-3.5" />
                    {t('excel.downloadTemplate')}
                  </Button>
                </div>

                <div className="space-y-3">
                  <h3 className="font-semibold text-sm flex items-center gap-1.5">
                    <Upload className="w-4 h-4 text-primary" />
                    {t('excel.step2')}
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {t('excel.step2Desc')}
                  </p>
                  <div
                    onClick={() => importFileInputRef.current?.click()}
                    className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/10 transition-all flex flex-col items-center justify-center gap-2"
                  >
                    <FileSpreadsheet className="w-10 h-10 text-muted-foreground/50" />
                    <p className="text-sm font-medium">{t('excel.selectFile')}</p>
                    <p className="text-xs text-muted-foreground">{t('excel.dragDrop')}</p>
                    <input
                      ref={importFileInputRef}
                      type="file"
                      accept=".xlsx, .xls"
                      className="hidden"
                      onChange={handleExcelUpload}
                    />
                  </div>
                </div>
              </div>
            ) : isValidating ? (
              // Loading screen
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
                <p className="text-sm font-medium text-muted-foreground">Memproses dan memvalidasi data...</p>
              </div>
            ) : (
              // Validation Preview screen
              <div className="space-y-4">
                {/* 100 row limit warning */}
                {hasMoreThan100 && (
                  <div className="flex items-start gap-2.5 rounded-xl border border-warning/30 bg-warning/10 p-3 text-warning">
                    <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-xs font-semibold">{t('excel.rowLimitWarning')}</p>
                    </div>
                  </div>
                )}

                {/* Summary header */}
                <div className="flex items-center justify-between bg-muted/40 p-3 rounded-xl border border-border">
                  <span className="text-xs font-medium text-muted-foreground">
                    {t('excel.summary', {
                      total: importRows.length,
                      valid: importRows.filter(r => r.isValid).length,
                      invalid: importRows.filter(r => !r.isValid).length
                    })}
                  </span>
                </div>

                {/* Preview Table */}
                <div className="rounded-xl border border-border overflow-hidden">
                  <div className="max-h-[40vh] overflow-y-auto">
                    <Table>
                      <TableHeader className="bg-muted/55 sticky top-0 z-10">
                        <TableRow>
                          <TableHead className="w-[60px] text-center font-bold">{t('excel.row')}</TableHead>
                          <TableHead className="font-bold">Nama Produk</TableHead>
                          <TableHead className="font-bold">SKU</TableHead>
                          <TableHead className="font-bold">Kategori</TableHead>
                          <TableHead className="font-bold text-right">Harga</TableHead>
                          <TableHead className="font-bold">Satuan</TableHead>
                          <TableHead className="font-bold">{t('excel.status')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {importRows.map((row) => (
                          <TableRow
                            key={row.rowNum}
                            className={cn(
                              !row.isValid && "bg-destructive/5 hover:bg-destructive/10 text-destructive"
                            )}
                          >
                            <TableCell className="text-center font-medium">{row.rowNum}</TableCell>
                            <TableCell className="font-semibold truncate max-w-[150px]">{row.name || '-'}</TableCell>
                            <TableCell className="font-mono text-xs">{row.sku || '-'}</TableCell>
                            <TableCell>{row.categoryName || '-'}</TableCell>
                            <TableCell className="text-right font-mono">{rp(row.price)}</TableCell>
                            <TableCell>{row.unit || '-'}</TableCell>
                            <TableCell>
                              {row.isValid ? (
                                <span className="flex items-center gap-1 text-xs text-success font-medium">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  Valid
                                </span>
                              ) : (
                                <div className="space-y-1">
                                  {row.errors.map((err, i) => (
                                    <span key={i} className="flex items-start gap-1 text-[11px] text-destructive leading-tight">
                                      <XCircle className="w-3 h-3 shrink-0 mt-0.5" />
                                      {err}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* Footer choices */}
                <div className="flex flex-col sm:flex-row justify-end items-center gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setImportFile(null);
                      setImportRows([]);
                      setHasMoreThan100(false);
                      if (importFileInputRef.current) importFileInputRef.current.value = '';
                    }}
                    className="w-full sm:w-auto gap-1.5"
                  >
                    <Upload className="w-4 h-4" />
                    {t('excel.btnReupload')}
                  </Button>
                  <Button
                    onClick={handleSaveImport}
                    disabled={importRows.filter(r => r.isValid).length === 0}
                    className="w-full sm:w-auto gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {t('excel.btnProceedValid', {
                      count: importRows.filter(r => r.isValid).length
                    })}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Scanner kamera untuk SKU / Barcode */}
      <BarcodeScanner
        open={scanTarget !== null}
        onClose={() => setScanTarget(null)}
        onScan={(value) => {
          const v = value.trim();
          if (scanTarget === 'sku') setSku(v);
          else if (scanTarget === 'barcode') setBarcode(v);
          setScanTarget(null);
        }}
      />
    </div>
  );
}
