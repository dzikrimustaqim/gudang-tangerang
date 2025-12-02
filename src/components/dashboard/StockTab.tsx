import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
import { Search, Package, Warehouse, Building2, Eye, Edit, Trash2, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { CopyText } from '@/components/ui/copy-text';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import ItemHistoryDialog from './ItemHistoryDialog';
import EnhancedStockForm from '../forms/EnhancedStockForm';
import type { Item, Category, OPD } from '@/types';
import { isInWarehouse, isInOPD, getLocationDisplay } from '@/constants';


export default function StockTab() {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [conditionFilter, setConditionFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [opds, setOpds] = useState<OPD[]>([]);
  const [loading, setLoading] = useState(true);
  const [transactionCounts, setTransactionCounts] = useState<Record<string, number>>({});
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Fetch data
  const fetchData = async () => {
    try {
      setLoading(true);
      const [itemsRes, categoriesRes, opdsRes] = await Promise.all([
        api.getItems(), // Fetch all items - no limit
        api.getCategories(),
        api.getOPDs()
      ]);
      setItems(itemsRes.data);
      setCategories(categoriesRes);
      setOpds(opdsRes);
      
      // Fetch distribution counts for each item
      const counts: Record<string, number> = {};
      await Promise.all(
        itemsRes.data.map(async (item) => {
          try {
            const distributionsRes = await api.getDistributions({ item_id: item.id });
            counts[item.id] = distributionsRes.data?.length || 0;
          } catch (error) {
            counts[item.id] = 0;
          }
        })
      );
      setTransactionCounts(counts);
    } catch (error: any) {
      console.error('Error fetching data:', error);
      const errorMsg = error.response?.data?.error || error.message || 'Terjadi kesalahan saat memuat data stok';
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    
    // Listen for master data changes
    const handleMasterDataChange = () => {
      console.log('StockTab: Master data changed, refetching...');
      fetchData();
    };
    
    const handleStorageChange = () => {
      console.log('StockTab: Storage event, refetching...');
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
  }, [searchQuery, categoryFilter, conditionFilter, locationFilter]);

  // Helper function to format date
  const formatEntryDate = (dateString: string) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    } catch (error) {
      return '';
    }
  };

  // Calculate stock summary
  const stockSummary = {
    total: items.length,
    warehouse: items.filter(item => isInWarehouse(item.latest_direction)).length,
    opd: items.filter(item => isInOPD(item.latest_direction)).length,
    opdLabel: 'Di OPD'
  };

  // Filter items
  const filteredItems = items.filter(item => {
    // Extended search - search all visible data in table
    const latestCondition = item.latest_condition || item.condition;
    const latestOpdName = item.latest_opd?.name || item.current_opd?.name || '';
    const latestLocationName = item.latest_location?.location_name || item.location?.location_name || '';
    
    const matchesSearch = searchQuery === '' ||
      item.serial_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.brand?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      latestCondition?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.current_location?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      latestOpdName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      latestLocationName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.specific_location?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      formatEntryDate(item.entry_date)?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(transactionCounts[item.id] || 0).includes(searchQuery);
    
    const matchesCategory = categoryFilter === 'all' || item.category_id === categoryFilter;
    const matchesCondition = conditionFilter === 'all' || latestCondition === conditionFilter;
    
    // Location filter based on latest_direction (transaction history) - use helper functions
    const itemInWarehouse = isInWarehouse(item.latest_direction);
    const itemInOPD = isInOPD(item.latest_direction);
    const effectiveOpdId = item.latest_opd_id || item.current_opd_id;
    
    const matchesLocation = 
      locationFilter === 'all' ||
      (locationFilter === 'gudang' && itemInWarehouse) ||
      (locationFilter !== 'gudang' && locationFilter !== 'all' && itemInOPD && effectiveOpdId === locationFilter);
    
    return matchesSearch && matchesCategory && matchesCondition && matchesLocation;
  });

  // Pagination logic
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedItems = filteredItems.slice(startIndex, endIndex);

  const getConditionBadge = (condition: string) => {
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

  const handleViewItem = (item: Item) => {
    setSelectedItem(item);
    setIsViewDialogOpen(true);
  };

  const handleEditItem = (item: Item) => {
    setSelectedItem(item);
    setIsEditDialogOpen(true);
  };

  const handleDeleteItem = (item: Item) => {
    setSelectedItem(item);
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteItem = async () => {
    if (!selectedItem) return;
    
    try {
      await api.deleteItem(selectedItem.id);
      toast.success('Item berhasil dihapus');
      setIsDeleteDialogOpen(false);
      setSelectedItem(null);
      fetchData();
    } catch (error: any) {
      console.error('Error deleting item:', error);
      const errorMsg = error.response?.data?.error || error.message || 'Terjadi kesalahan saat menghapus item';
      toast.error(errorMsg, { duration: 6000 });
    }
  };

  const handleAddItem = async (data: any) => {
    try {
      // Transform data to match backend API expectations
      const itemData = {
        serial_number: data.serial,
        category_id: data.categoryId,
        brand: data.brand,
        type: data.type,
        condition: data.condition,
        description: data.notes || undefined,
        entry_date: data.entryDate || undefined,
        specific_location: undefined
      };
      
      await api.createItem(itemData);
      toast.success('Item berhasil ditambahkan');
      setIsAddDialogOpen(false);
      fetchData();
    } catch (error: any) {
      console.error('Error adding item:', error);
      // Show error message from backend or error message directly
      const errorMsg = error.response?.data?.error || error.message || 'Gagal menambahkan item';
      toast.error(errorMsg);
    }
  };

  const handleUpdateItem = async (data: any) => {
    if (!selectedItem) return;
    
    try {
      // Transform data to match backend API expectations
      const itemData = {
        serial_number: data.serial,
        brand: data.brand,
        type: data.type,
        category_id: data.categoryId,
        condition: data.condition,
        description: data.notes !== undefined ? data.notes : '', // Allow empty string
        entry_date: data.entryDate || undefined
      };
      
      await api.updateItem(selectedItem.id, itemData);
      toast.success('Item berhasil diperbarui');
      setIsEditDialogOpen(false);
      setSelectedItem(null);
      fetchData();
    } catch (error: any) {
      console.error('Error updating item:', error);
      const errorMsg = error.response?.data?.error || error.message || 'Gagal memperbarui item';
      toast.error(errorMsg);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center p-8">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-0 shadow-lg bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Item</p>
                <p className="text-2xl font-bold">{stockSummary.total.toLocaleString()}</p>
              </div>
              <Package className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-700 dark:text-blue-300">Di Gudang</p>
                <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">{stockSummary.warehouse.toLocaleString()}</p>
              </div>
              <Warehouse className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-700 dark:text-purple-300">{stockSummary.opdLabel}</p>
                <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">{stockSummary.opd.toLocaleString()}</p>
              </div>
              <Building2 className="h-8 w-8 text-purple-600 dark:text-purple-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Header with Add Button */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Manajemen Stok</h2>
          <p className="text-muted-foreground">Kelola dan pantau inventori barang secara real-time</p>
        </div>
        <Button onClick={() => setIsAddDialogOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Tambah Item Baru
        </Button>
      </div>

      {/* Filters and Search */}
      <Card className="shadow-lg">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl font-semibold">Stok Inventori</CardTitle>
          <p className="text-sm text-muted-foreground">Kelola dan pantau inventori barang secara real-time</p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col lg:flex-row gap-4">
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
            <div className="flex flex-col sm:flex-row gap-3">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Kategori" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Kategori</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={conditionFilter} onValueChange={setConditionFilter}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Kondisi" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Kondisi</SelectItem>
                  <SelectItem value="Layak Pakai">Layak Pakai</SelectItem>
                  <SelectItem value="Rusak Ringan">Rusak Ringan</SelectItem>
                  <SelectItem value="Rusak/Hilang">Rusak/Hilang</SelectItem>
                </SelectContent>
              </Select>
              <Select value={locationFilter} onValueChange={setLocationFilter}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Lokasi" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Lokasi</SelectItem>
                  <SelectItem value="gudang">Gudang</SelectItem>
                  {opds.map((opd) => (
                    <SelectItem key={opd.id} value={opd.id}>
                      {opd.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
                Menampilkan {filteredItems.length === 0 ? 0 : startIndex + 1} - {Math.min(endIndex, filteredItems.length)} dari {filteredItems.length} data
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

          {/* Items Table */}
          <div className="rounded-lg border shadow-sm bg-card">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted">
                  <TableHead className="font-semibold whitespace-nowrap px-4">Nomor Serial</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap px-4">Kategori</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap px-4">Merek & Tipe</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap px-4">Kondisi Terkini</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap px-4">Lokasi Terkini</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap px-4">Tanggal Masuk</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap px-4 text-center">Pergerakan</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap px-4 text-center">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <p className="font-medium">
                          {items.length === 0 
                            ? 'Belum ada data stok item' 
                            : 'Tidak ada data yang sesuai dengan filter'
                          }
                        </p>
                        {items.length === 0 && (
                          <p className="text-sm">
                            Klik tombol "Tambah Item Baru" untuk memulai
                          </p>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedItems.map((item, index) => (
                    <TableRow key={item.id} className={`hover:bg-muted/50 transition-colors ${
                      index % 2 === 0 ? 'bg-card' : 'bg-muted/50'
                    }`}>
                      <TableCell className="px-4">
                        <CopyText text={item.serial_number} />
                      </TableCell>
                      <TableCell className="px-4">
                        <span className="text-sm">{item.category?.name || 'N/A'}</span>
                      </TableCell>
                      <TableCell className="px-4">
                        <div>
                          <p className="font-medium">{item.brand}</p>
                          <p className="text-sm text-muted-foreground">{item.type}</p>
                        </div>
                      </TableCell>
                      <TableCell className="px-4">
                        {getConditionBadge(item.latest_condition || item.condition)}
                      </TableCell>
                      <TableCell className="px-4">
                        {/* Show location based on latest_direction - using helper function */}
                        {(() => {
                          if (isInWarehouse(item.latest_direction)) {
                            return <p className="font-medium">{getLocationDisplay(item.latest_direction, null, null)}</p>;
                          }
                          
                          if (isInOPD(item.latest_direction)) {
                            return (
                              <div>
                                <p className="font-medium">
                                  {item.latest_opd?.name || 'N/A'}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {item.latest_location?.location_name || '-'}
                                </p>
                              </div>
                            );
                          }
                          
                          // Fallback
                          return <p className="font-medium">N/A</p>;
                        })()}
                      </TableCell>
                      <TableCell className="text-sm px-4 whitespace-nowrap">
                        {formatEntryDate(item.entry_date)}
                      </TableCell>
                      <TableCell className="text-center px-4">
                        <Badge variant="secondary" className="rounded-md px-2 py-0.5 font-semibold">
                          {transactionCounts[item.id] || 0}x
                        </Badge>
                      </TableCell>
                      <TableCell className="px-4">
                        <div className="flex items-center justify-center gap-1">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleViewItem(item)}
                            className="hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950"
                            title="Lihat Detail"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleEditItem(item)}
                            className="hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-950"
                            title="Edit Item"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleDeleteItem(item)}
                            title="Hapus Item"
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

      {/* Item History Dialog */}
      <ItemHistoryDialog
        isOpen={isViewDialogOpen}
        onClose={() => setIsViewDialogOpen(false)}
        item={selectedItem}
      />

      {/* Enhanced Add Item Form */}
      <EnhancedStockForm
        isOpen={isAddDialogOpen}
        onClose={() => setIsAddDialogOpen(false)}
        onSave={handleAddItem}
        isEditing={false}
        categories={categories}
        opds={opds}
      />

      {/* Enhanced Edit Item Form */}
      <EnhancedStockForm
        isOpen={isEditDialogOpen}
        onClose={() => setIsEditDialogOpen(false)}
        onSave={handleUpdateItem}
        isEditing={true}
        initialData={selectedItem}
        categories={categories}
        opds={opds}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi Penghapusan Item</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus item <strong>{selectedItem?.serial_number}</strong>?
              <span className="font-semibold text-destructive"> Semua riwayat distribusi item tersebut juga akan terhapus.</span> Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteItem}
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
