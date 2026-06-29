import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { useState } from 'react';
import { ArrowLeft, Search, History, Filter, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { id as idLocale, enUS, ms } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';
import LockedPage from '@/components/LockedPage';
import { useAuth } from '@/hooks/use-auth';

const LOCALES: Record<string, any> = { id: idLocale, en: enUS, ms };

export default function AuditLogPage() {
  const { t, i18n } = useTranslation('settings'); // or appropriate namespace
  const dateLocale = LOCALES[i18n.language] ?? idLocale;
  const navigate = useNavigate();
  const { can } = useAuth();
  
  const [search, setSearch] = useState('');
  const [filterEntity, setFilterEntity] = useState<string>('all');
  const [filterAction, setFilterAction] = useState<string>('all');

  const logs = useLiveQuery(() => db.auditLogs.orderBy('createdAt').reverse().toArray());

  const filteredLogs = logs?.filter(log => {
    if (filterEntity !== 'all' && log.entity !== filterEntity) return false;
    if (filterAction !== 'all' && log.action !== filterAction) return false;
    
    if (search) {
      const q = search.toLowerCase();
      return (
        (log.entityLabel?.toLowerCase().includes(q)) ||
        (log.detail?.toLowerCase().includes(q)) ||
        (log.userName?.toLowerCase().includes(q))
      );
    }
    return true;
  }) ?? [];

  if (!can('manage_store_settings')) {
    return <LockedPage />;
  }

  const getActionColor = (action: string) => {
    switch (action) {
      case 'create': return 'text-success bg-success/10';
      case 'update': return 'text-primary bg-primary/10';
      case 'delete': return 'text-destructive bg-destructive/10';
      default: return 'text-muted-foreground bg-muted';
    }
  };

  const getActionLabel = (action: string) => {
    switch(action) {
      case 'create': return 'Buat';
      case 'update': return 'Ubah';
      case 'delete': return 'Hapus';
      default: return action;
    }
  }

  return (
    <div className="px-4 pt-6 pb-20">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <History className="w-5 h-5 text-primary" />
          Audit Log
        </h1>
      </div>

      <div className="space-y-3 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Cari aktivitas..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Select value={filterEntity} onValueChange={setFilterEntity}>
            <SelectTrigger className="text-xs">
              <SelectValue placeholder="Semua Modul" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Modul</SelectItem>
              <SelectItem value="transaction">Transaksi</SelectItem>
              <SelectItem value="product">Produk</SelectItem>
              <SelectItem value="expense">Pengeluaran</SelectItem>
              <SelectItem value="debt">Hutang</SelectItem>
              <SelectItem value="customer">Pelanggan</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterAction} onValueChange={setFilterAction}>
            <SelectTrigger className="text-xs">
              <SelectValue placeholder="Semua Aksi" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Aksi</SelectItem>
              <SelectItem value="create">Buat</SelectItem>
              <SelectItem value="update">Ubah</SelectItem>
              <SelectItem value="delete">Hapus</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {(filterEntity !== 'all' || filterAction !== 'all' || search) && (
          <div className="flex justify-end">
             <Button variant="ghost" size="sm" className="h-8 text-xs text-destructive" onClick={() => {
                setSearch('');
                setFilterEntity('all');
                setFilterAction('all');
              }}>
                Reset Filter
              </Button>
          </div>
        )}
      </div>

      {filteredLogs.length === 0 ? (
        <div className="text-center py-12">
          <History className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Tidak ada aktivitas ditemukan.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredLogs.map(log => (
            <Card key={log.id} className="border-0 shadow-sm">
              <CardContent className="p-3">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${getActionColor(log.action)}`}>
                      {getActionLabel(log.action)}
                    </span>
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{log.entity}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {format(new Date(log.createdAt), 'dd MMM yy HH:mm', { locale: dateLocale })}
                  </span>
                </div>
                
                <p className="text-sm font-medium">{log.entityLabel || 'Item Tanpa Nama'}</p>
                {log.detail && <p className="text-xs text-muted-foreground mt-1">{log.detail}</p>}
                
                <div className="mt-2 pt-2 border-t flex justify-between items-center">
                  <span className="text-[10px] text-muted-foreground">Oleh: <span className="font-medium text-foreground">{log.userName}</span></span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
