import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { FileDown, Calendar as CalendarIcon, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { exportData, type ExportFilters } from '@/utils/exportData';
import type { Category } from '@/types/api';

interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
}

export default function ExportDialog({ isOpen, onClose, categories }: ExportDialogProps) {
  const [dataType, setDataType] = useState<'stock' | 'distribution'>('stock');
  const [isExporting, setIsExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<'xlsx' | 'csv'>('xlsx');
  
  // Stock filters
  const [filterLocation, setFilterLocation] = useState<'all' | 'Gudang' | 'OPD'>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterCondition, setFilterCondition] = useState<'all' | 'Layak Pakai' | 'Rusak Ringan' | 'Rusak/Hilang'>('all');
  const [groupByStock, setGroupByStock] = useState<'none' | 'category' | 'location' | 'condition'>('none');
  
  // Distribution filters
  const [filterDirection, setFilterDirection] = useState<'all' | 'Gudang → OPD' | 'OPD → Gudang' | 'OPD → OPD'>('all');
  const [filterPeriod, setFilterPeriod] = useState<'all' | 'today' | 'week' | 'month' | 'custom'>('all');
  const [customDateFrom, setCustomDateFrom] = useState<Date>();
  const [customDateTo, setCustomDateTo] = useState<Date>();
  const [sortByDist, setSortByDist] = useState<'newest' | 'oldest'>('newest');
  const [groupByDist, setGroupByDist] = useState<'none' | 'category' | 'location' | 'condition'>('none');

  // Reset filters when data type changes
  useEffect(() => {
    if (dataType === 'stock') {
      setFilterLocation('all');
      setFilterCategory('all');
      setFilterCondition('all');
      setGroupByStock('none');
    } else {
      setFilterDirection('all');
      setFilterPeriod('all');
      setCustomDateFrom(undefined);
      setCustomDateTo(undefined);
      setSortByDist('newest');
      setGroupByDist('none');
    }
  }, [dataType]);

  const handleExport = async () => {
    setIsExporting(true);
    
    try {
      const filters: ExportFilters = {
        dataType,
        format: exportFormat
      };

      if (dataType === 'stock') {
        filters.filterLocation = filterLocation;
        filters.filterCategory = filterCategory;
        filters.filterCondition = filterCondition;
        filters.groupBy = groupByStock;
      } else {
        filters.filterDirection = filterDirection;
        filters.filterPeriod = filterPeriod;
        filters.sortByDist = sortByDist;
        filters.groupBy = groupByDist;
        
        if (filterPeriod === 'custom' && customDateFrom && customDateTo) {
          filters.customDateRange = {
            from: format(customDateFrom, 'yyyy-MM-dd'),
            to: format(customDateTo, 'yyyy-MM-dd')
          };
        }
      }

      await exportData(filters);
      
      // Close dialog after successful export
      setTimeout(() => {
        onClose();
      }, 500);
      
    } catch (error) {
      console.error('Export failed:', error);
      alert(error instanceof Error ? error.message : 'Gagal mengekspor data');
    } finally {
      setIsExporting(false);
    }
  };

  const isExportDisabled = () => {
    if (dataType === 'distribution' && filterPeriod === 'custom') {
      return !customDateFrom || !customDateTo;
    }
    return false;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Ekspor Data</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto px-1">
          <div className="space-y-4 pb-4">
          {/* Data Type Selection */}
          <div className="space-y-2">
            <Label htmlFor="dataType">Jenis Data</Label>
            <Select value={dataType} onValueChange={(value: 'stock' | 'distribution') => setDataType(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="stock">Data Stok</SelectItem>
                <SelectItem value="distribution">Data Distribusi</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Stock Filters */}
          {dataType === 'stock' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="filterLocation">Filter Lokasi</Label>
                <Select value={filterLocation} onValueChange={(value: any) => setFilterLocation(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Lokasi</SelectItem>
                    <SelectItem value="Gudang">Gudang</SelectItem>
                    <SelectItem value="OPD">OPD</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="filterCategory">Filter Kategori</Label>
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Kategori</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="filterCondition">Filter Kondisi</Label>
                <Select value={filterCondition} onValueChange={(value: any) => setFilterCondition(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Kondisi</SelectItem>
                    <SelectItem value="Layak Pakai">Layak Pakai</SelectItem>
                    <SelectItem value="Rusak Ringan">Rusak Ringan</SelectItem>
                    <SelectItem value="Rusak/Hilang">Rusak/Hilang</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="groupByStock">Group By (Opsional)</Label>
                <Select value={groupByStock} onValueChange={(value: any) => setGroupByStock(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Tidak Dikelompokkan</SelectItem>
                    <SelectItem value="category">Per Kategori</SelectItem>
                    <SelectItem value="location">Per Lokasi</SelectItem>
                    <SelectItem value="condition">Per Kondisi</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {/* Distribution Filters */}
          {dataType === 'distribution' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="filterDirection">Filter Arah Distribusi</Label>
                <Select value={filterDirection} onValueChange={(value: any) => setFilterDirection(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Arah</SelectItem>
                    <SelectItem value="Gudang → OPD">Gudang → OPD</SelectItem>
                    <SelectItem value="OPD → Gudang">OPD → Gudang</SelectItem>
                    <SelectItem value="OPD → OPD">OPD → OPD</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="filterPeriod">Filter Periode</Label>
                <Select value={filterPeriod} onValueChange={(value: any) => setFilterPeriod(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Waktu</SelectItem>
                    <SelectItem value="today">Hari Ini</SelectItem>
                    <SelectItem value="week">7 Hari Terakhir</SelectItem>
                    <SelectItem value="month">30 Hari Terakhir</SelectItem>
                    <SelectItem value="custom">Rentang Tanggal Kustom</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {filterPeriod === 'custom' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Dari Tanggal</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            'w-full justify-start text-left font-normal',
                            !customDateFrom && 'text-muted-foreground'
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {customDateFrom ? format(customDateFrom, 'dd/MM/yyyy', { locale: localeId }) : 'Pilih tanggal'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={customDateFrom}
                          onSelect={setCustomDateFrom}
                          initialFocus
                          locale={localeId}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-2">
                    <Label>Sampai Tanggal</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            'w-full justify-start text-left font-normal',
                            !customDateTo && 'text-muted-foreground'
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {customDateTo ? format(customDateTo, 'dd/MM/yyyy', { locale: localeId }) : 'Pilih tanggal'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={customDateTo}
                          onSelect={setCustomDateTo}
                          initialFocus
                          locale={localeId}
                          disabled={(date) => customDateFrom ? date < customDateFrom : false}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="sortByDist">Urutkan Berdasarkan</Label>
                <Select value={sortByDist} onValueChange={(value: 'newest' | 'oldest') => setSortByDist(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Distribusi Terbaru</SelectItem>
                    <SelectItem value="oldest">Distribusi Terlama</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="groupByDist">Group By (Opsional)</Label>
                <Select value={groupByDist} onValueChange={(value: any) => setGroupByDist(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Tidak Dikelompokkan</SelectItem>
                    <SelectItem value="category">Per Kategori</SelectItem>
                    <SelectItem value="location">Per Arah Distribusi</SelectItem>
                    <SelectItem value="condition">Per Kondisi</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {/* Format Selection */}
          <div className="space-y-2">
            <Label htmlFor="exportFormat">Format Export</Label>
            <Select value={exportFormat} onValueChange={(value: 'xlsx' | 'csv') => setExportFormat(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="xlsx">Excel (.xlsx) - Terbaik untuk analisis data</SelectItem>
                <SelectItem value="csv">CSV (.csv) - Format universal dan ringan</SelectItem>
              </SelectContent>
            </Select>
          </div>
          </div>
        </div>

        <div className="border-t pt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={isExporting}>
            Batal
          </Button>
          <Button onClick={handleExport} disabled={isExportDisabled() || isExporting}>
            {isExporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Mengekspor...
              </>
            ) : (
              <>
                <FileDown className="mr-2 h-4 w-4" />
                Ekspor ke {exportFormat === 'xlsx' ? 'Excel' : 'CSV'}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
