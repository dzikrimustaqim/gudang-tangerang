import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, ArrowUpRight, ArrowDownLeft, ArrowRightLeft, ArrowUpDown, Edit, Trash2, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { CopyText } from '@/components/ui/copy-text';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import EnhancedDistributionForm from '../forms/EnhancedDistributionForm';
import type { Distribution, Item, OPD } from '@/types';

interface DistributionFormData {
  id?: string;
  itemId: string;
  direction: 'Gudang → OPD' | 'OPD → Gudang' | 'OPD → OPD';
  sourceOpdId: string;
  targetOpdId: string;
  specificLocation: string;
  notes: string;
  condition: string;
  processedBy: string;
  transaction_date?: string;
  distribution_date?: string;
}

export default function DistributionTab() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingDistribution, setEditingDistribution] = useState<Distribution | null>(null);
  const [deletingDistribution, setDeletingDistribution] = useState<Distribution | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDirection, setSelectedDirection] = useState('all-directions');
  const [selectedCondition, setSelectedCondition] = useState('all-conditions');
  const [sortOrder, setSortOrder] = useState('newest');
  const [distributions, setDistributions] = useState<Distribution[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [opds, setOpds] = useState<OPD[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Column visibility state
  const [visibleColumns, setVisibleColumns] = useState({
    kode: true,
    serial: true,
    kategori: true,
    merekTipe: true,
    arah: true,
    dari: true,
    ke: true,
    kondisi: true,
    diketahui: true,
    tanggal: true,
    catatan: true
  });
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  const toggleColumn = (column: keyof typeof visibleColumns) => {
    setVisibleColumns(prev => ({ ...prev, [column]: !prev[column] }));
  };

  // Fetch data
  const fetchData = async () => {
    try {
      setLoading(true);
      console.log('DistributionTab: Fetching data...');
      const [distributionsRes, itemsRes, opdsRes] = await Promise.all([
        api.getDistributions(), // Fetch all distributions - no limit
        api.getItems(), // Fetch all items - no limit
        api.getOPDs()
      ]);
      console.log('DistributionTab: distributions received:', distributionsRes);
      console.log('DistributionTab: First distribution sample:', distributionsRes.data?.[0]);
      console.log('DistributionTab: distribution_code field:', distributionsRes.data?.[0]?.distribution_code);
      console.log('DistributionTab: Items received:', itemsRes.data?.length || 0, 'items');
      console.log('DistributionTab: OPDs received:', opdsRes?.length || 0, 'opds');
      
      setDistributions(distributionsRes.data || []);
      setItems(itemsRes.data || []);
      setOpds(opdsRes || []);
    } catch (error: any) {
      console.error('DistributionTab: Error fetching data:', error);
      const errorMsg = error.response?.data?.error || error.message || 'Terjadi kesalahan saat memuat data distribusi';
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    
    // Listen for master data changes
    const handleMasterDataChange = () => {
      console.log('DistributionTab: Master data changed, refetching...');
      fetchData();
    };
    
    const handleStorageChange = () => {
      console.log('DistributionTab: Storage event, refetching...');
      fetchData();
    };
    
    window.addEventListener('masterDataChanged', handleMasterDataChange);
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('masterDataChanged', handleMasterDataChange);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedDirection, selectedCondition, sortOrder]);

  const directions = ['Gudang → OPD', 'OPD → Gudang', 'OPD → OPD'];

  const getDirectionIcon = (direction: string) => {
    switch (direction) {
      case 'Gudang → OPD':
        return <ArrowUpRight className="h-4 w-4 text-red-500" />;
      case 'OPD → Gudang':
        return <ArrowDownLeft className="h-4 w-4 text-green-500" />;
      case 'OPD → OPD':
        return <ArrowRightLeft className="h-4 w-4 text-blue-500" />;
      default:
        return <ArrowRightLeft className="h-4 w-4" />;
    }
  };

  const getDirectionBadge = (direction: string) => {
    switch (direction) {
      case 'Gudang → OPD':
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100 rounded-md px-2 py-0.5">Gudang → OPD</Badge>;
      case 'OPD → Gudang':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100 rounded-md px-2 py-0.5">OPD → Gudang</Badge>;
      case 'OPD → OPD':
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 rounded-md px-2 py-0.5">OPD → OPD</Badge>;
      default:
        return <Badge variant="secondary" className="rounded-md px-2 py-0.5">{direction}</Badge>;
    }
  };

  const getConditionBadge = (condition?: string) => {
    if (!condition) return null;
    switch (condition) {
      case 'Layak Pakai':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100 rounded-md px-2 py-0.5">Layak Pakai</Badge>;
      case 'Rusak Ringan':
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100 rounded-md px-2 py-0.5">Rusak Ringan</Badge>;
      case 'Rusak/Hilang':
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100 rounded-md px-2 py-0.5">Rusak/Hilang</Badge>;
      default:
        return <Badge variant="secondary" className="rounded-md px-2 py-0.5">{condition}</Badge>;
    }
  };

  const handleCreateDistribution = async (formData: DistributionFormData) => {
    try {
      // Transform form data to API format
      const distributionData = {
        item_id: formData.itemId,
        direction: formData.direction,
        source_opd_id: formData.sourceOpdId || null,
        target_opd_id: formData.targetOpdId || null,
        specific_location: formData.specificLocation || null,
        item_condition: formData.condition, // Guaranteed not empty by frontend validation
        notes: formData.notes || null,
        processed_by: formData.processedBy
      };

      await api.createDistribution(distributionData);
      
      toast.success('Distribusi berhasil dibuat');
      setIsAddDialogOpen(false);
      fetchData();
    } catch (error: any) {
      console.error('Error creating distribution:', error);
      console.error('Error details:', error.response?.data);
      const errorMsg = error.response?.data?.error || error.response?.data?.reason || error.message || 'Terjadi kesalahan saat membuat distribusi';
      toast.error(errorMsg, { duration: 6000 });
    }
  };

  const handleEditDistribution = async (formData: DistributionFormData) => {
    if (!editingDistribution) return;

    try {
      // Transform form data to API format
      // ONLY send distribution_date if it's ACTUALLY changed
      const distributionData: any = {
        direction: formData.direction,
        source_opd_id: formData.sourceOpdId || null,
        target_opd_id: formData.targetOpdId || null,
        specific_location: formData.specificLocation || null,
        item_condition: formData.condition, // Guaranteed not empty (pre-filled in edit mode)
        notes: formData.notes || null,
        processed_by: formData.processedBy
      };
      
      // Only include distribution_date if it's different from original
      // This prevents unnecessary date validation when only changing location/OPD
      console.log('🔍 CHECKING DATE CHANGE - NEW CODE EXECUTED');
      console.log('   editingDistribution.distribution_date:', editingDistribution.distribution_date);
      console.log('   formData.distribution_date:', formData.distribution_date);
      
      const originalDate = editingDistribution.distribution_date ? 
        new Date(editingDistribution.distribution_date).toISOString().split('T')[0] : null;
      const newDate = formData.distribution_date ? 
        new Date(formData.distribution_date).toISOString().split('T')[0] : null;
      
      console.log('   originalDate normalized:', originalDate);
      console.log('   newDate normalized:', newDate);
      console.log('   Are they equal?', newDate === originalDate);
      
      if (newDate && originalDate && newDate !== originalDate) {
        distributionData.distribution_date = formData.distribution_date;
        console.log('✅ Date changed:', originalDate, '→', newDate, '- SENDING to backend');
      } else {
        console.log('✅ Date unchanged - NOT sending to backend');
      }
      
      console.log('📦 Final distributionData being sent:', distributionData);

      await api.updateDistribution(editingDistribution.distribution_code, distributionData);
      
      toast.success('Distribusi berhasil diperbarui');
      setIsEditDialogOpen(false);
      setEditingDistribution(null);
      fetchData();
    } catch (error: any) {
      console.error('Error updating distribution:', error);
      
      // Display detailed error message from backend
      if (error.response?.data?.error) {
        const errorData = error.response.data;
        let errorMessage = errorData.error;
        
        // Add reason if available
        if (errorData.reason) {
          errorMessage += `\n\n${errorData.reason}`;
        }
        
        // Add solution if available
        if (errorData.solution) {
          errorMessage += `\n\n💡 Solusi: ${errorData.solution}`;
        }
        
        // Add timeline info if available (for date errors)
        if (errorData.timeline) {
          errorMessage += '\n\n📅 Timeline:';
          if (errorData.timeline.previous) {
            errorMessage += `\n• Sebelumnya: ${errorData.timeline.previous}`;
          }
          if (errorData.timeline.current_old) {
            errorMessage += `\n• Saat ini (lama): ${errorData.timeline.current_old}`;
          }
          if (errorData.timeline.current_new) {
            errorMessage += `\n• Perubahan (baru): ${errorData.timeline.current_new}`;
          }
          if (errorData.timeline.next) {
            errorMessage += `\n• Berikutnya: ${errorData.timeline.next}`;
          }
        }
        
        // Add why explanation if available
        if (errorData.why) {
          errorMessage += `\n\nℹ️ Mengapa: ${errorData.why}`;
        }
        
        toast.error(errorMessage, { duration: 8000 });
      } else {
        toast.error('Gagal memperbarui distribusi');
      }
    }
  };

  const handleDeleteDistribution = (distribution: Distribution) => {
    setDeletingDistribution(distribution);
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteDistribution = async () => {
    if (!deletingDistribution) return;

    try {
      await api.deleteDistribution(deletingDistribution.distribution_code);
      toast.success('Distribusi berhasil dihapus');
      setIsDeleteDialogOpen(false);
      setDeletingDistribution(null);
      fetchData();
    } catch (error: any) {
      console.error('Error deleting distribution:', error);
      const errorMsg = error.response?.data?.error || error.response?.data?.reason || error.message || 'Terjadi kesalahan saat menghapus distribusi';
      toast.error(errorMsg, { duration: 6000 });
    }
  };

  const openEditDialog = (distribution: Distribution) => {
    console.log('=== Opening Edit Dialog ===');
    console.log('Distribution object:', distribution);
    console.log('distribution_code:', distribution.distribution_code);
    console.log('item_id:', distribution.item_id);
    console.log('distribution.item:', distribution.item);
    
    // Use React 18's automatic batching - both states updated together
    setEditingDistribution(distribution);
    setIsEditDialogOpen(true);
  };

  const filteredDistributions = distributions
    .filter(distribution => {
      // Extended search - search all visible data in table
      const matchesSearch = searchQuery === '' || 
        distribution.distribution_code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        distribution.item?.serial_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        distribution.item?.category?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        distribution.item?.brand?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        distribution.item?.type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        distribution.direction?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        distribution.source_opd?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        distribution.source_location?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        distribution.target_opd?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        distribution.specific_location?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        distribution.item?.condition?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        distribution.processed_by?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        distribution.notes?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesDirection = selectedDirection === 'all-directions' || distribution.direction === selectedDirection;
      const matchesCondition = selectedCondition === 'all-conditions' || distribution.item?.condition === selectedCondition;
      
      return matchesSearch && matchesDirection && matchesCondition;
    })
    .sort((a, b) => {
      // Sort by date
      const dateA = new Date(a.distribution_date).getTime();
      const dateB = new Date(b.distribution_date).getTime();
      return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
    });

  // Pagination logic
  const totalPages = Math.ceil(filteredDistributions.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedDistributions = filteredDistributions.slice(startIndex, endIndex);

  // Calculate statistics
  const stats = {
    total: distributions.length,
    toOpd: distributions.filter(t => t.direction === 'Gudang → OPD').length,
    toWarehouse: distributions.filter(t => t.direction === 'OPD → Gudang').length,
    between: distributions.filter(t => t.direction === 'OPD → OPD').length
  };

  if (loading) {
    return <div className="flex items-center justify-center p-8">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-0 shadow-lg bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total distribusi</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <ArrowUpDown className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950 dark:to-red-900">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-red-700 dark:text-red-300">Gudang → OPD</p>
                <p className="text-2xl font-bold text-red-900 dark:text-red-100">{stats.toOpd}</p>
              </div>
              <ArrowUpRight className="h-8 w-8 text-red-600 dark:text-red-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-700 dark:text-green-300">OPD → Gudang</p>
                <p className="text-2xl font-bold text-green-900 dark:text-green-100">{stats.toWarehouse}</p>
              </div>
              <ArrowDownLeft className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-700 dark:text-blue-300">OPD → OPD</p>
                <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">{stats.between}</p>
              </div>
              <ArrowRightLeft className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Manajemen Distribusi</h2>
          <p className="text-muted-foreground">Kelola distribusi distribusi barang antar lokasi</p>
        </div>
        <Button onClick={() => setIsAddDialogOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Buat Distribusi Baru
        </Button>
      </div>

      {/* Filters and Table */}
      <Card className="shadow-lg">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl font-semibold">Riwayat Distribusi</CardTitle>
          <p className="text-sm text-muted-foreground">Pantau semua distribusi distribusi barang</p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Search Bar and Filters in One Row */}
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search Bar */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cari semua data yang terlihat di tabel..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            {/* Filters - Side by Side */}
            <Select value={selectedDirection} onValueChange={setSelectedDirection}>
              <SelectTrigger className="w-full lg:w-[180px]">
                <SelectValue placeholder="Filter Arah" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all-directions">Semua Arah</SelectItem>
                {directions.map((dir) => (
                  <SelectItem key={dir} value={dir}>
                    {dir}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedCondition} onValueChange={setSelectedCondition}>
              <SelectTrigger className="w-full lg:w-[180px]">
                <SelectValue placeholder="Filter Kondisi" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all-conditions">Semua Kondisi</SelectItem>
                <SelectItem value="Layak Pakai">Layak Pakai</SelectItem>
                <SelectItem value="Rusak Ringan">Rusak Ringan</SelectItem>
                <SelectItem value="Rusak/Hilang">Rusak/Hilang</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortOrder} onValueChange={setSortOrder}>
              <SelectTrigger className="w-full lg:w-[180px]">
                <SelectValue placeholder="Urutkan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Terbaru</SelectItem>
                <SelectItem value="oldest">Terlama</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Column Toggle Chips */}
          <div className="flex flex-wrap items-center gap-2 p-4 rounded-lg border bg-card">
            <span className="text-sm text-muted-foreground font-medium">Tampilkan kolom:</span>
            {Object.entries(visibleColumns).map(([key, visible]) => {
              const columnLabels: Record<string, string> = {
                kode: 'Kode',
                serial: 'Nomor Serial',
                kategori: 'Kategori',
                merekTipe: 'Merek & Tipe',
                arah: 'Arah',
                dari: 'Asal',
                ke: 'Tujuan',
                kondisi: 'Kondisi',
                diketahui: 'Diketahui',
                tanggal: 'Tanggal',
                catatan: 'Catatan'
              };
              
              return (
                <Badge
                  key={key}
                  variant={visible ? "default" : "outline"}
                  className="cursor-pointer rounded-md px-3 py-1 transition-colors hover:opacity-80"
                  onClick={() => toggleColumn(key as keyof typeof visibleColumns)}
                >
                  {columnLabels[key]}
                </Badge>
              );
            })}
          </div>

          {/* Pagination Controls */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-lg border bg-card">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Tampilkan:</span>
              <Select value={String(itemsPerPage)} onValueChange={(value) => {
                setItemsPerPage(Number(value));
                setCurrentPage(1);
              }}>
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5</SelectItem>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-sm text-muted-foreground">data per halaman</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                Menampilkan {filteredDistributions.length === 0 ? 0 : startIndex + 1} - {Math.min(endIndex, filteredDistributions.length)} dari {filteredDistributions.length} data
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground">
                Halaman {currentPage} dari {totalPages || 1}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages || totalPages === 0}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* distributions Table */}
          <div className="rounded-lg border shadow-sm bg-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted">
                  {visibleColumns.kode && <TableHead className="font-semibold">Kode</TableHead>}
                  {visibleColumns.serial && <TableHead className="font-semibold">Nomor Serial</TableHead>}
                  {visibleColumns.kategori && <TableHead className="font-semibold">Kategori</TableHead>}
                  {visibleColumns.merekTipe && <TableHead className="font-semibold">Merek & Tipe</TableHead>}
                  {visibleColumns.arah && <TableHead className="font-semibold">Arah</TableHead>}
                  {visibleColumns.dari && <TableHead className="font-semibold">Asal</TableHead>}
                  {visibleColumns.ke && <TableHead className="font-semibold">Tujuan</TableHead>}
                  {visibleColumns.kondisi && <TableHead className="font-semibold">Kondisi</TableHead>}
                  {visibleColumns.diketahui && <TableHead className="font-semibold">Diketahui</TableHead>}
                  {visibleColumns.tanggal && <TableHead className="font-semibold">Tanggal</TableHead>}
                  {visibleColumns.catatan && <TableHead className="font-semibold">Catatan</TableHead>}
                  <TableHead className="font-semibold text-center">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={Object.values(visibleColumns).filter(Boolean).length + 1} className="text-center py-8">
                      <div className="flex items-center justify-center gap-2">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                        <span className="text-muted-foreground">Memuat data...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredDistributions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={Object.values(visibleColumns).filter(Boolean).length + 1} className="text-center py-8">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <p className="font-medium">
                          {distributions.length === 0 
                            ? 'Belum ada data distribusi' 
                            : 'Tidak ada data yang sesuai dengan filter'
                          }
                        </p>
                        {distributions.length === 0 && (
                          <p className="text-sm">
                            Klik tombol "Buat Distribusi Baru" untuk memulai
                          </p>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedDistributions.map((distribution, index) => (
                    <TableRow key={distribution.distribution_code} className={`hover:bg-muted/50 transition-colors ${
                      index % 2 === 0 ? 'bg-card' : 'bg-muted/50'
                    }`}>
                      {visibleColumns.kode && (
                        <TableCell className="whitespace-nowrap">
                          <CopyText text={distribution.distribution_code} />
                        </TableCell>
                      )}
                      {visibleColumns.serial && (
                        <TableCell className="whitespace-nowrap">
                          <CopyText text={distribution.item?.serial_number || 'N/A'} />
                        </TableCell>
                      )}
                      {visibleColumns.kategori && (
                        <TableCell className="whitespace-nowrap">
                          <span className="text-sm">{distribution.item?.category?.name || 'N/A'}</span>
                        </TableCell>
                      )}
                      {visibleColumns.merekTipe && (
                        <TableCell className="whitespace-nowrap">
                          <div>
                            <p className="font-medium">{distribution.item?.brand || 'N/A'}</p>
                            <p className="text-sm text-muted-foreground">{distribution.item?.type || '-'}</p>
                          </div>
                        </TableCell>
                      )}
                      {visibleColumns.arah && (
                        <TableCell className="whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {getDirectionIcon(distribution.direction)}
                            {getDirectionBadge(distribution.direction)}
                          </div>
                        </TableCell>
                      )}
                      {visibleColumns.dari && (
                        <TableCell className="min-w-[150px]">
                          {distribution.direction === 'Gudang → OPD' ? (
                            <p className="font-medium whitespace-nowrap">Gudang</p>
                          ) : (
                            <div className="whitespace-nowrap">
                              <p className="font-medium">
                                {distribution.source_opd?.name || 'N/A'}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {distribution.source_location || '-'}
                              </p>
                            </div>
                          )}
                        </TableCell>
                      )}
                      {visibleColumns.ke && (
                        <TableCell className="min-w-[150px]">
                          {distribution.direction === 'OPD → Gudang' ? (
                            <p className="font-medium whitespace-nowrap">Gudang</p>
                          ) : (
                            <div className="whitespace-nowrap">
                              <p className="font-medium">
                                {distribution.target_opd?.name || 'N/A'}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {distribution.specific_location || '-'}
                              </p>
                            </div>
                          )}
                        </TableCell>
                      )}
                      {visibleColumns.kondisi && (
                        <TableCell className="whitespace-nowrap">
                          {getConditionBadge(distribution.item?.condition)}
                        </TableCell>
                      )}
                      {visibleColumns.diketahui && (
                        <TableCell className="text-sm whitespace-nowrap">
                          {distribution.processed_by}
                        </TableCell>
                      )}
                      {visibleColumns.tanggal && (
                        <TableCell className="text-sm whitespace-nowrap">
                          {new Date(distribution.distribution_date).toLocaleDateString('id-ID', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </TableCell>
                      )}
                      {visibleColumns.catatan && (
                        <TableCell className="min-w-[150px] max-w-[200px]">
                          <div className="w-full">
                            {distribution.notes ? (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="text-sm truncate cursor-help whitespace-nowrap overflow-hidden text-ellipsis">
                                      {distribution.notes}
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent 
                                    className="max-w-[500px] w-auto break-words"
                                    side="top"
                                    align="start"
                                  >
                                    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                                      {distribution.notes}
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            ) : (
                              <span className="text-sm text-muted-foreground">-</span>
                            )}
                          </div>
                        </TableCell>
                      )}
                      <TableCell className="min-w-[120px]">
                        <div className="flex items-center justify-center gap-1 whitespace-nowrap">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => openEditDialog(distribution)}
                            className="hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-950"
                            title="Edit Distribusi"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleDeleteDistribution(distribution)}
                            title="Hapus Distribusi"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Add Distribution Form */}
      <EnhancedDistributionForm
        isOpen={isAddDialogOpen}
        onClose={() => setIsAddDialogOpen(false)}
        onSave={handleCreateDistribution}
        items={items}
        isEditing={false}
      />

      {/* Edit Distribution Form - Always mounted, visibility controlled by Dialog */}
      <EnhancedDistributionForm
        key={editingDistribution?.distribution_code || 'edit-form'} // Force re-mount when editing different distribution
        isOpen={isEditDialogOpen}
        onClose={() => {
          setIsEditDialogOpen(false);
          setEditingDistribution(null);
        }}
        onSave={handleEditDistribution}
        items={items}
        isEditing={true}
        initialData={editingDistribution ? {
          id: editingDistribution.distribution_code, // MUST use distribution_code
          distributionCode: editingDistribution.distribution_code,
          itemId: editingDistribution.item_id, // Use item_id directly
          direction: editingDistribution.direction,
          sourceOpdId: editingDistribution.source_opd?.id || editingDistribution.source_opd_id || '',
          targetOpdId: editingDistribution.target_opd?.id || editingDistribution.target_opd_id || '',
          specificLocation: editingDistribution.specific_location || '',
          locationId: editingDistribution.location?.id || '',
          notes: editingDistribution.notes || '',
          condition: editingDistribution.item?.condition || editingDistribution.condition || 'Layak Pakai',
          processedBy: editingDistribution.processed_by,
          transaction_date: editingDistribution.distribution_date, // Same as distribution_date
          distribution_date: editingDistribution.distribution_date,
          originalDistributionDate: editingDistribution.distribution_date,
          created_at: editingDistribution.created_at
        } : undefined}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi Penghapusan Distribusi</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus distribusi "{deletingDistribution?.distribution_code}"? Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteDistribution}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
