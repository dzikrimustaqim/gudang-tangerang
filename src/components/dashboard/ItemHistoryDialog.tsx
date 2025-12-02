import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
import { ArrowUpRight, ArrowDownLeft, ArrowRightLeft, MapPin, Calendar, User, Package, ArrowUp, ArrowDown, Edit, Trash2 } from 'lucide-react';
import { CopyText } from '@/components/ui/copy-text';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import type { Item, Distribution } from '@/types/api';
import EnhancedDistributionForm from '../forms/EnhancedDistributionForm';

interface ItemHistoryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  item: Item | null;
}

interface DistributionFormData {
  id?: string;
  itemId: string;
  direction: 'Gudang → OPD' | 'OPD → Gudang' | 'OPD → OPD';
  sourceOpdId: string;
  targetOpdId: string;
  specificLocation: string;
  locationId?: string;
  notes: string;
  condition: string;
  processedBy: string;
  transaction_date?: string;
  distribution_date?: string;
}

export default function ItemHistoryDialog({ isOpen, onClose, item }: ItemHistoryDialogProps) {
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [distributions, setDistributions] = useState<Distribution[]>([]);
  const [loading, setLoading] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingDistribution, setEditingDistribution] = useState<Distribution | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingDistribution, setDeletingDistribution] = useState<Distribution | null>(null);

  useEffect(() => {
    const fetchDistributions = async () => {
      if (!item || !isOpen) return;
      
      try {
        setLoading(true);
        const [distributionsRes, itemsRes] = await Promise.all([
          api.getDistributions({ item_id: item.id }), // Fetch all distributions for this item - no limit
          api.getItems() // Fetch all items - no limit
        ]);
        setDistributions(distributionsRes.data || []);
        setItems(itemsRes.data || []);
      } catch (error: any) {
        console.error('Error fetching distributions:', error);
        const errorMsg = error.response?.data?.error || error.message || 'Terjadi kesalahan saat memuat riwayat distribusi';
        toast.error(errorMsg);
        setDistributions([]);
      } finally {
        setLoading(false);
      }
    };

    fetchDistributions();
  }, [item, isOpen]);

  const fetchData = async () => {
    if (!item || !isOpen) return;
    
    try {
      setLoading(true);
      const [distributionsRes, itemsRes] = await Promise.all([
        api.getDistributions({ item_id: item.id }), // Fetch all distributions for this item - no limit
        api.getItems() // Fetch all items - no limit
      ]);
      setDistributions(distributionsRes.data || []);
      setItems(itemsRes.data || []);
    } catch (error: any) {
      console.error('Error fetching distributions:', error);
      const errorMsg = error.response?.data?.error || error.message || 'Terjadi kesalahan saat memuat riwayat distribusi';
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleEditDistribution = async (formData: DistributionFormData) => {
    if (!editingDistribution) return;

    try {
      const distributionData = {
        direction: formData.direction,
        source_opd_id: formData.sourceOpdId || null,
        target_opd_id: formData.targetOpdId || null,
        specific_location: formData.specificLocation || null,
        notes: formData.notes || null,
        processed_by: formData.processedBy,
        distribution_date: formData.distribution_date,
        item_condition: formData.condition // Guaranteed not empty (pre-filled in edit mode)
      };

      await api.updateDistribution(editingDistribution.distribution_code, distributionData);
      
      toast.success('Distribusi berhasil diperbarui');
      setIsEditDialogOpen(false);
      setEditingDistribution(null);
      fetchData();
    } catch (error: any) {
      console.error('Error updating distribution:', error);
      const errorMsg = error.response?.data?.error || error.response?.data?.reason || error.message || 'Terjadi kesalahan saat memperbarui distribusi';
      toast.error(errorMsg, { duration: 6000 });
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
    console.log('=== ItemHistory: Opening Edit Dialog ===');
    console.log('Distribution object:', distribution);
    console.log('distribution_code:', distribution.distribution_code);
    console.log('item_id:', distribution.item_id);
    
    setEditingDistribution(distribution);
    setIsEditDialogOpen(true);
  };

  const getDirectionIcon = (direction: string) => {
    switch (direction) {
      case 'Gudang → OPD':
        return <ArrowUpRight className="h-4 w-4 text-red-500" />;
      case 'OPD → Gudang':
        return <ArrowDownLeft className="h-4 w-4 text-green-500" />;
      case 'OPD → OPD':
        return <ArrowRightLeft className="h-4 w-4 text-blue-500" />;
      default:
        return <Package className="h-4 w-4 text-green-600" />;
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

  const handleSortToggle = () => {
    setSortOrder(prev => prev === 'newest' ? 'oldest' : 'newest');
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', { 
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  if (!item) return null;

  const sorteddistributions = [...distributions].sort((a, b) => {
    // ALWAYS sort by created_at (actual chronological order)
    // This ensures order never changes even if distribution_date is edited
    const createdA = new Date(a.created_at);
    const createdB = new Date(b.created_at);
    
    if (sortOrder === 'newest') {
      return createdB.getTime() - createdA.getTime();
    } else {
      return createdA.getTime() - createdB.getTime();
    }
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg">
              <MapPin className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">Riwayat Distribusi Item</div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {/* Item Info */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-900 rounded-xl p-6 mb-6 border border-blue-100 dark:border-slate-700">
            <div className="flex flex-wrap justify-evenly items-start gap-y-4">
              <div className="space-y-1 flex flex-col items-center">
                <div className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase">Kategori</div>
                <div className="text-lg font-bold text-gray-900 dark:text-white text-center">
                  {typeof item.category === 'object' ? item.category.name : item.category}
                </div>
              </div>
              <div className="space-y-1 flex flex-col items-center">
                <div className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase">Merek</div>
                <div className="text-lg font-bold text-gray-900 dark:text-white text-center">{item.brand}</div>
              </div>
              <div className="space-y-1 flex flex-col items-center">
                <div className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase">Tipe</div>
                <div className="text-lg font-bold text-gray-900 dark:text-white text-center">{item.type}</div>
              </div>
              <div className="space-y-1 flex flex-col items-center">
                <div className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase">Nomor Serial</div>
                <div className="text-lg font-bold text-gray-900 dark:text-white font-mono text-center">
                  {item.serial_number}
                </div>
              </div>
            </div>
          </div>

          {/* distributions */}
          <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-blue-600" />
              <h3 className="text-xl font-bold">Riwayat Pergerakan</h3>
            </div>
            <Button variant="outline" size="sm" onClick={handleSortToggle}>
              {sortOrder === 'newest' ? <ArrowDown className="h-4 w-4 mr-2" /> : <ArrowUp className="h-4 w-4 mr-2" />}
              {sortOrder === 'newest' ? 'Terbaru' : 'Terlama'}
            </Button>
          </div>

          {loading ? (
            <div className="text-center p-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p>Memuat riwayat transaksi...</p>
            </div>
          ) : (
            <div className="border rounded-xl overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted">
                    <TableHead className="whitespace-nowrap font-semibold">Kode</TableHead>
                    <TableHead className="whitespace-nowrap font-semibold">Tanggal</TableHead>
                    <TableHead className="whitespace-nowrap font-semibold">Arah</TableHead>
                    <TableHead className="whitespace-nowrap font-semibold">Asal</TableHead>
                    <TableHead className="whitespace-nowrap font-semibold">Tujuan</TableHead>
                    <TableHead className="whitespace-nowrap font-semibold">Kondisi</TableHead>
                    <TableHead className="whitespace-nowrap font-semibold">Diketahui</TableHead>
                    <TableHead className="whitespace-nowrap font-semibold">Catatan</TableHead>
                    <TableHead className="whitespace-nowrap font-semibold text-center">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* Entry pertama - Item masuk gudang */}
                  {sortOrder === 'oldest' && (
                    <TableRow className="bg-green-50 dark:bg-green-950 border-l-4 border-green-500">
                      <TableCell className="whitespace-nowrap">
                        <p className="font-medium text-gray-400 dark:text-gray-600">-</p>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <div className="font-semibold">{formatDate(item.entry_date)}</div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-green-600" />
                          <Badge className="bg-green-100 text-green-800 hover:bg-green-100 rounded-md px-2 py-0.5">Item Masuk Gudang</Badge>
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <p className="font-medium text-gray-400 dark:text-gray-600">-</p>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <p className="font-medium">Gudang</p>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {getConditionBadge(item.condition)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <p className="font-medium text-gray-400 dark:text-gray-600">-</p>
                      </TableCell>
                      <TableCell className="min-w-[150px] max-w-[200px] overflow-hidden">
                        {item.description ? (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="text-sm text-gray-600 max-w-full truncate cursor-help whitespace-nowrap overflow-hidden text-ellipsis">
                                  {item.description}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent 
                                className="max-w-[500px] w-auto break-words"
                                side="top"
                                align="start"
                              >
                                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                                  {item.description}
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : (
                          <span className="text-sm text-gray-600 text-muted-foreground">Item baru ditambahkan ke sistem</span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <p className="font-medium text-gray-400 dark:text-gray-600 text-center">-</p>
                      </TableCell>
                    </TableRow>
                  )}
                  
                  {sorteddistributions.map((tx, index) => (
                    <TableRow key={tx.distribution_code} className={`hover:bg-muted/50 transition-colors ${
                      index % 2 === 0 ? 'bg-card' : 'bg-muted/50'
                    }`}>
                      <TableCell className="whitespace-nowrap">
                        <CopyText text={tx.distribution_code || '-'} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <div className="font-semibold">{formatDate(tx.distribution_date)}</div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {getDirectionIcon(tx.direction)}
                          {getDirectionBadge(tx.direction)}
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {tx.direction === 'Gudang → OPD' ? (
                          <p className="font-medium">Gudang</p>
                        ) : (
                          <div>
                            <p className="font-medium">
                              {tx.source_opd?.name || 'N/A'}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {tx.sourceLocation?.location_name || '-'}
                            </p>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {tx.direction === 'OPD → Gudang' ? (
                          <p className="font-medium">Gudang</p>
                        ) : (
                          <div>
                            <p className="font-medium">
                              {tx.target_opd?.name || 'N/A'}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {tx.location?.location_name || '-'}
                            </p>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {getConditionBadge(tx.item?.condition)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <span className="text-sm">{tx.processed_by || '-'}</span>
                      </TableCell>
                      <TableCell className="min-w-[200px] max-w-[400px] overflow-hidden">
                        {tx.notes ? (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="text-sm max-w-full truncate cursor-help whitespace-nowrap overflow-hidden text-ellipsis">
                                  {tx.notes}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent 
                                className="max-w-[500px] w-auto break-words"
                                side="top"
                                align="start"
                              >
                                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                                  {tx.notes}
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => openEditDialog(tx)}
                            className="hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-950 h-8 px-2"
                            title="Edit Distribusi"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleDeleteDistribution(tx)}
                            title="Hapus Distribusi"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950 h-8 px-2"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  
                  {/* Entry pertama - Item masuk gudang (untuk urutan terbaru, tampil di bawah) */}
                  {sortOrder === 'newest' && (
                    <TableRow className="bg-green-50 dark:bg-green-950 border-l-4 border-green-500">
                      <TableCell className="whitespace-nowrap">
                        <p className="font-medium text-gray-400 dark:text-gray-600">-</p>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <div className="font-semibold">{formatDate(item.entry_date)}</div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-green-600" />
                          <Badge className="bg-green-100 text-green-800 hover:bg-green-100 rounded-md px-2 py-0.5">Item Masuk Gudang</Badge>
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <p className="font-medium text-gray-400 dark:text-gray-600">-</p>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <p className="font-medium">Gudang</p>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {getConditionBadge(item.condition)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <p className="font-medium text-gray-400 dark:text-gray-600">-</p>
                      </TableCell>
                      <TableCell className="min-w-[150px] max-w-[200px] overflow-hidden">
                        {item.description ? (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="text-sm text-gray-600 max-w-full truncate cursor-help whitespace-nowrap overflow-hidden text-ellipsis">
                                  {item.description}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent 
                                className="max-w-[500px] w-auto break-words"
                                side="top"
                                align="start"
                              >
                                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                                  {item.description}
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : (
                          <span className="text-sm text-gray-600 text-muted-foreground">Item baru ditambahkan ke sistem</span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <p className="font-medium text-gray-400 dark:text-gray-600 text-center">-</p>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
          </div>
        </div>
      </DialogContent>

      {/* Delete Distribution AlertDialog */}
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

      {/* Edit Distribution Form */}
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
          distributionCode: editingDistribution.distribution_code, // Add this for consistency
          itemId: editingDistribution.item_id, // Use item_id directly
          direction: editingDistribution.direction,
          sourceOpdId: editingDistribution.source_opd?.id || editingDistribution.source_opd_id || '',
          targetOpdId: editingDistribution.target_opd?.id || editingDistribution.target_opd_id || '',
          specificLocation: editingDistribution.specific_location || '',
          locationId: editingDistribution.location?.id || '',
          notes: editingDistribution.notes || '',
          condition: editingDistribution.item?.condition || editingDistribution.item_condition, // Database constraint NOT NULL - always has value
          processedBy: editingDistribution.processed_by,
          transaction_date: editingDistribution.distribution_date, // Same as distribution_date
          distribution_date: editingDistribution.distribution_date,
          originalDistributionDate: editingDistribution.distribution_date, // Add this
          created_at: editingDistribution.created_at // CRITICAL: Add this for proper previous distribution detection!
        } : undefined}
      />
    </Dialog>
  );
}
