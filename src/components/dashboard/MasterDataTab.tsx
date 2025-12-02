import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
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
import { Search, Plus, Edit, Trash2, Building2, Package, Save, X, ChevronDown, ChevronRight, MapPin } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import type { OPD, OPDLocation, Category } from '@/types/api';
import CategoryManagement from './CategoryManagement';

export default function MasterDataTabNew() {
  const [searchOPD, setSearchOPD] = useState('');
  const [opds, setOpds] = useState<OPD[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedOPDs, setExpandedOPDs] = useState<Set<string>>(new Set());
  const [opdLocations, setOpdLocations] = useState<Record<string, OPDLocation[]>>({});

  // OPD Dialog State
  const [isOPDDialogOpen, setIsOPDDialogOpen] = useState(false);
  const [editingOPD, setEditingOPD] = useState<OPD | null>(null);
  const [opdForm, setOpdForm] = useState({ name: '', description: '', pic: '', address: '', phone: '' });
  const [isDeleteOPDDialogOpen, setIsDeleteOPDDialogOpen] = useState(false);
  const [deletingOPD, setDeletingOPD] = useState<OPD | null>(null);

  // OPD Location Dialog State
  const [isLocationDialogOpen, setIsLocationDialogOpen] = useState(false);
  const [currentOPDId, setCurrentOPDId] = useState<string>('');
  const [editingLocation, setEditingLocation] = useState<OPDLocation | null>(null);
  const [locationForm, setLocationForm] = useState({ location_name: '', description: '', pic: '', contact: '', bandwidth: '', address: '' });
  const [isDeleteLocationDialogOpen, setIsDeleteLocationDialogOpen] = useState(false);
  const [deletingLocation, setDeletingLocation] = useState<{ opdId: string; location: OPDLocation } | null>(null);

  // Fetch data
  const fetchData = async () => {
    try {
      setLoading(true);
      const opdsRes = await api.getOPDs();
      setOpds(opdsRes);
      
      // Fetch locations for all OPDs
      const locationsMap: Record<string, OPDLocation[]> = {};
      await Promise.all(
        opdsRes.map(async (opd) => {
          try {
            const locations = await api.getOPDLocations(opd.id);
            locationsMap[opd.id] = locations;
          } catch (error) {
            console.error(`Error fetching locations for OPD ${opd.id}:`, error);
            locationsMap[opd.id] = [];
          }
        })
      );
      setOpdLocations(locationsMap);
      
      // DEBUG: Show loaded data
      const totalLocations = Object.values(locationsMap).flat().length;
      console.log('=== DATA LOADED ===');
      console.log('OPDs:', opdsRes.length);
      console.log('Total Locations:', totalLocations);
      console.log('Locations Map:', locationsMap);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Gagal memuat data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Auto-expand OPDs when searching matches locations - SIMPLIFIED
  useEffect(() => {
    console.log('=== AUTO-EXPAND EFFECT ===');
    console.log('Search term:', searchOPD);
    console.log('OPDs count:', opds.length);
    console.log('Locations loaded:', Object.keys(opdLocations).length);
    
    if (!searchOPD || searchOPD.trim() === '') {
      console.log('Search empty - clearing expansions');
      setExpandedOPDs(new Set());
      return;
    }

    const searchLower = searchOPD.toLowerCase();
    const newExpanded = new Set<string>();

    // Check each OPD for location matches
    opds.forEach(opd => {
      const locations = opdLocations[opd.id] || [];
      console.log(`Checking ${opd.name}: ${locations.length} locations`);
      
      // Check if any location matches the search
      const hasLocationMatch = locations.some(loc => {
        const match = loc.location_name.toLowerCase().includes(searchLower) ||
          (loc.pic && loc.pic.toLowerCase().includes(searchLower)) ||
          (loc.contact && loc.contact.toLowerCase().includes(searchLower)) ||
          (loc.address && loc.address.toLowerCase().includes(searchLower));
        
        if (match) {
          console.log(`  ✓ Location match: ${loc.location_name}`);
        }
        return match;
      });

      // If location matches but OPD data doesn't, auto-expand this OPD
      const opdDataMatch = 
        opd.name.toLowerCase().includes(searchLower) ||
        (opd.pic && opd.pic.toLowerCase().includes(searchLower)) ||
        (opd.phone && opd.phone.toLowerCase().includes(searchLower)) ||
        (opd.address && opd.address.toLowerCase().includes(searchLower));
      
      if (hasLocationMatch && !opdDataMatch) {
        newExpanded.add(opd.id);
        console.log(`  → Will expand OPD: ${opd.name}`);
      }
    });

    console.log('Expanding:', Array.from(newExpanded).length, 'OPDs');
    // Update expanded OPDs
    if (newExpanded.size > 0) {
      setExpandedOPDs(newExpanded);
    }
  }, [searchOPD, opds, opdLocations]);

  // OPD Functions
  const handleCreateOPD = () => {
    setEditingOPD(null);
    setOpdForm({ name: '', description: '', pic: '', address: '', phone: '' });
    setIsOPDDialogOpen(true);
  };

  const handleEditOPD = (opd: OPD) => {
    setEditingOPD(opd);
    setOpdForm({
      name: opd.name,
      description: opd.description || '',
      pic: opd.pic || '',
      address: opd.address || '',
      phone: opd.phone || ''
    });
    setIsOPDDialogOpen(true);
  };

  const handleSaveOPD = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingOPD) {
        await api.updateOPD(editingOPD.id, opdForm);
        toast.success('OPD berhasil diperbarui');
      } else {
        await api.createOPD(opdForm);
        toast.success('OPD berhasil ditambahkan');
      }
      setIsOPDDialogOpen(false);
      fetchData();
      // Trigger refresh di tab lain
      window.dispatchEvent(new Event('masterDataChanged'));
    } catch (error) {
      console.error('Error saving OPD:', error);
      toast.error('Gagal menyimpan OPD');
    }
  };

  const handleDeleteOPD = (opd: OPD) => {
    setDeletingOPD(opd);
    setIsDeleteOPDDialogOpen(true);
  };

  const confirmDeleteOPD = async () => {
    if (!deletingOPD) return;

    try {
      await api.deleteOPD(deletingOPD.id);
      toast.success('OPD berhasil dihapus');
      setIsDeleteOPDDialogOpen(false);
      setDeletingOPD(null);
      fetchData();
      // Trigger refresh di tab lain
      window.dispatchEvent(new Event('masterDataChanged'));
    } catch (error) {
      console.error('Error deleting OPD:', error);
      toast.error('Gagal menghapus OPD');
    }
  };

  // OPD Location Functions
  const toggleOPDExpansion = async (opdId: string) => {
    const newExpanded = new Set(expandedOPDs);
    if (newExpanded.has(opdId)) {
      newExpanded.delete(opdId);
    } else {
      newExpanded.add(opdId);
      // Fetch locations if not already loaded
      if (!opdLocations[opdId]) {
        try {
          const locations = await api.getOPDLocations(opdId);
          setOpdLocations(prev => ({ ...prev, [opdId]: locations }));
        } catch (error) {
          console.error('Error fetching locations:', error);
          toast.error('Gagal memuat lokasi OPD');
        }
      }
    }
    setExpandedOPDs(newExpanded);
  };

  // Expand/Collapse All OPDs
  const handleExpandAllOPDs = async () => {
    const allOPDIds = new Set(opds.map(opd => opd.id));
    setExpandedOPDs(allOPDIds);
    
    // Fetch locations for all OPDs that haven't been loaded
    const unloadedOPDs = opds.filter(opd => !opdLocations[opd.id]);
    if (unloadedOPDs.length > 0) {
      try {
        const locationsMap = { ...opdLocations };
        await Promise.all(
          unloadedOPDs.map(async (opd) => {
            try {
              const locations = await api.getOPDLocations(opd.id);
              locationsMap[opd.id] = locations;
            } catch (error) {
              console.error(`Error fetching locations for OPD ${opd.id}:`, error);
            }
          })
        );
        setOpdLocations(locationsMap);
      } catch (error) {
        console.error('Error expanding all OPDs:', error);
      }
    }
  };

  const handleCollapseAllOPDs = () => {
    setExpandedOPDs(new Set());
  };

  const handleCreateLocation = (opdId: string) => {
    setCurrentOPDId(opdId);
    setEditingLocation(null);
    setLocationForm({ location_name: '', description: '', pic: '', contact: '', bandwidth: '', address: '' });
    setIsLocationDialogOpen(true);
  };

  const handleEditLocation = (opdId: string, location: OPDLocation) => {
    setCurrentOPDId(opdId);
    setEditingLocation(location);
    setLocationForm({
      location_name: location.location_name,
      description: location.description || '',
      pic: location.pic || '',
      contact: location.contact || '',
      bandwidth: location.bandwidth || '',
      address: location.address || ''
    });
    setIsLocationDialogOpen(true);
  };

  const handleSaveLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingLocation) {
        await api.updateOPDLocation(currentOPDId, editingLocation.id, locationForm);
        toast.success('Lokasi berhasil diperbarui');
      } else {
        await api.createOPDLocation(currentOPDId, locationForm);
        toast.success('Lokasi berhasil ditambahkan');
      }
      setIsLocationDialogOpen(false);
      // Refresh locations for this OPD
      const locations = await api.getOPDLocations(currentOPDId);
      setOpdLocations(prev => ({ ...prev, [currentOPDId]: locations }));
      // Trigger refresh di tab lain
      window.dispatchEvent(new Event('masterDataChanged'));
    } catch (error) {
      console.error('Error saving location:', error);
      toast.error('Gagal menyimpan lokasi');
    }
  };

  const handleDeleteLocation = (opdId: string, location: OPDLocation) => {
    setDeletingLocation({ opdId, location });
    setIsDeleteLocationDialogOpen(true);
  };

  const confirmDeleteLocation = async () => {
    if (!deletingLocation) return;

    try {
      console.log('Deleting location:', deletingLocation.opdId, deletingLocation.location.id);
      await api.deleteOPDLocation(deletingLocation.opdId, deletingLocation.location.id);
      console.log('Delete successful');
      toast.success('Lokasi berhasil dihapus');
      setIsDeleteLocationDialogOpen(false);
      setDeletingLocation(null);
      // Refresh locations for this OPD
      const locations = await api.getOPDLocations(deletingLocation.opdId);
      console.log('Refreshed locations:', locations);
      setOpdLocations(prev => ({ ...prev, [deletingLocation.opdId]: locations }));
      // Trigger refresh di tab lain
      window.dispatchEvent(new Event('masterDataChanged'));
    } catch (error: any) {
      console.error('Error deleting location:', error);
      console.error('Error details:', error.message, error.response);
      toast.error(`Gagal menghapus lokasi: ${error.message || 'Unknown error'}`);
    }
  };

  // Filter OPDs based on search
  const filteredOPDs = opds.filter(opd => {
    const searchLower = searchOPD.toLowerCase().trim();
    
    // If no search, return all OPDs
    if (!searchLower) {
      return true;
    }
    
    // Cek nama OPD, PIC, telepon, atau alamat OPD
    const opdMatch = 
      opd.name.toLowerCase().includes(searchLower) ||
      (opd.pic && opd.pic.toLowerCase().includes(searchLower)) ||
      (opd.phone && opd.phone.toLowerCase().includes(searchLower)) ||
      (opd.address && opd.address.toLowerCase().includes(searchLower));
    
    // Cek nama lokasi, PIC lokasi, kontak lokasi, atau alamat lokasi dari OPD ini
    const locations = opdLocations[opd.id] || [];
    const locationMatch = locations.some(loc => 
      loc.location_name.toLowerCase().includes(searchLower) ||
      (loc.pic && loc.pic.toLowerCase().includes(searchLower)) ||
      (loc.contact && loc.contact.toLowerCase().includes(searchLower)) ||
      (loc.address && loc.address.toLowerCase().includes(searchLower))
    );
    
    return opdMatch || locationMatch;
  });

  if (loading) {
    return <div className="flex items-center justify-center p-8">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">Manajemen Data Master</h2>
        <p className="text-muted-foreground">Kelola unit organisasi (OPD) dan kategori item</p>
      </div>

      <Tabs defaultValue="opd" className="space-y-6">
        <TabsList className="grid grid-cols-2 w-full max-w-md">
          <TabsTrigger value="opd" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            OPD dan Lokasi
          </TabsTrigger>
          <TabsTrigger value="categories" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Kategori Item
          </TabsTrigger>
        </TabsList>

        {/* OPD Tab */}
        <TabsContent value="opd" className="space-y-6">
          <Card className="shadow-lg">
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    OPD dan Lokasi
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-2">
                    Kelola OPD dan Lokasi yang menerima distribusi barang
                  </p>
                </div>
                <Button onClick={handleCreateOPD}>
                  <Plus className="h-4 w-4 mr-2" />
                  Tambah OPD
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Cari OPD, PIC, atau alamat..."
                    value={searchOPD}
                    onChange={(e) => setSearchOPD(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Button
                  variant="outline"
                  size="default"
                  onClick={handleExpandAllOPDs}
                  className="flex items-center gap-2"
                >
                  <ChevronDown className="h-4 w-4" />
                  Expand All
                </Button>
                <Button
                  variant="outline"
                  size="default"
                  onClick={handleCollapseAllOPDs}
                  className="flex items-center gap-2"
                >
                  <ChevronRight className="h-4 w-4" />
                  Collapse All
                </Button>
              </div>

              <div className="rounded-lg border shadow-sm bg-card">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted">
                      <TableHead className="font-semibold">Nama OPD</TableHead>
                      <TableHead className="font-semibold">Penanggung Jawab</TableHead>
                      <TableHead className="font-semibold">Telepon</TableHead>
                      <TableHead className="font-semibold">Alamat</TableHead>
                      <TableHead className="font-semibold text-center">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOPDs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          Tidak ada data OPD dan Lokasi yang cocok dengan pencarian
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredOPDs.map((opd, index) => (
                        <>
                          <TableRow 
                            key={opd.id} 
                            className={`hover:bg-muted/50 transition-colors cursor-pointer ${
                              index % 2 === 0 ? 'bg-card' : 'bg-muted/50'
                            }`}
                            onClick={() => toggleOPDExpansion(opd.id)}
                          >
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="h-6 w-6 flex items-center justify-center">
                                  {expandedOPDs.has(opd.id) ? (
                                    <ChevronDown className="h-4 w-4" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4" />
                                  )}
                                </div>
                                <div className="font-medium">{opd.name}</div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">{opd.pic || '-'}</div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                {opd.phone || '-'}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">{opd.address || '-'}</div>
                            </TableCell>
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-center gap-1">
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEditOPD(opd);
                                  }}
                                  className="hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-950"
                                  title="Edit OPD"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteOPD(opd);
                                  }}
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                                  title="Hapus OPD"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                          {expandedOPDs.has(opd.id) && (
                            <TableRow>
                              <TableCell colSpan={5} className="bg-muted/30 p-4">
                                <div className="space-y-3">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-sm font-semibold">
                                      <MapPin className="h-4 w-4" />
                                      Lokasi {opd.name}
                                    </div>
                                    <Button 
                                      size="sm" 
                                      variant="outline"
                                      onClick={() => handleCreateLocation(opd.id)}
                                    >
                                      <Plus className="h-3 w-3 mr-1" />
                                      Tambah Lokasi
                                    </Button>
                                  </div>
                                  <div className="pl-6">
                                    {(() => {
                                      const locations = opdLocations[opd.id] || [];
                                      
                                      // Jika tidak ada lokasi sama sekali
                                      if (locations.length === 0) {
                                        return (
                                          <p className="text-sm text-muted-foreground">
                                            Belum ada lokasi. Klik "Tambah Lokasi" untuk menambahkan.
                                          </p>
                                        );
                                      }
                                      
                                      // Jika tidak ada pencarian, tampilkan semua lokasi
                                      if (!searchOPD || searchOPD.trim() === '') {
                                        return (
                                          <div className="space-y-3">
                                            {locations.map((loc) => (
                                              <div key={loc.id} className="group relative bg-card border border-border rounded-lg p-4 hover:shadow-md hover:border-primary/40 transition-all duration-200">
                                                <div className="flex items-start gap-4">
                                                  {/* Location Icon & Name */}
                                                  <div className="flex-shrink-0 mt-0.5">
                                                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                                      <MapPin className="h-5 w-5 text-primary" />
                                                    </div>
                                                  </div>
                                                  
                                                  {/* Location Details */}
                                                  <div className="flex-1 min-w-0 space-y-2 pr-20">
                                                    <h4 className="font-semibold text-base text-foreground">
                                                      {loc.location_name}
                                                    </h4>
                                                    
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                                                      {/* Kolom Kiri: PIC dan Telepon */}
                                                      <div className="space-y-2">
                                                        {loc.pic && (
                                                          <div className="flex items-start">
                                                            <span className="text-muted-foreground font-medium w-[85px] flex-shrink-0">Nama PIC</span>
                                                            <span className="text-muted-foreground font-medium mr-2">:</span>
                                                            <span className="text-foreground">{loc.pic}</span>
                                                          </div>
                                                        )}
                                                        {loc.contact && (
                                                          <div className="flex items-start">
                                                            <span className="text-muted-foreground font-medium w-[85px] flex-shrink-0">Telepon</span>
                                                            <span className="text-muted-foreground font-medium mr-2">:</span>
                                                            <span className="text-foreground">{loc.contact}</span>
                                                          </div>
                                                        )}
                                                      </div>
                                                      
                                                      {/* Kolom Kanan: Bandwidth dan Alamat */}
                                                      <div className="space-y-2">
                                                        {loc.bandwidth && (
                                                          <div className="flex items-start">
                                                            <span className="text-muted-foreground font-medium w-[85px] flex-shrink-0">Bandwidth</span>
                                                            <span className="text-muted-foreground font-medium mr-2">:</span>
                                                            <span className="text-foreground">{loc.bandwidth} Mbps</span>
                                                          </div>
                                                        )}
                                                        {loc.address && (
                                                          <div className="flex items-start">
                                                            <span className="text-muted-foreground font-medium w-[85px] flex-shrink-0">Alamat</span>
                                                            <span className="text-muted-foreground font-medium mr-2">:</span>
                                                            <span className="text-foreground">{loc.address}</span>
                                                          </div>
                                                        )}
                                                      </div>
                                                    </div>
                                                  </div>
                                                  
                                                  {/* Action Buttons */}
                                                  <div className="flex-shrink-0 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Button 
                                                      variant="ghost" 
                                                      size="sm"
                                                      onClick={() => handleEditLocation(opd.id, loc)}
                                                      className="h-8 w-8 p-0 hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-950"
                                                      title="Edit Lokasi"
                                                    >
                                                      <Edit className="h-4 w-4" />
                                                    </Button>
                                                    <Button 
                                                      variant="ghost" 
                                                      size="sm"
                                                      onClick={() => handleDeleteLocation(opd.id, loc)}
                                                      className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                                                      title="Hapus Lokasi"
                                                    >
                                                      <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                  </div>
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        );
                                      }
                                      
                                      // Jika ada pencarian, filter lokasi
                                      const filteredLocations = locations.filter(loc =>
                                        loc.location_name.toLowerCase().includes(searchOPD.toLowerCase()) ||
                                        (loc.pic && loc.pic.toLowerCase().includes(searchOPD.toLowerCase())) ||
                                        (loc.contact && loc.contact.toLowerCase().includes(searchOPD.toLowerCase())) ||
                                        (loc.address && loc.address.toLowerCase().includes(searchOPD.toLowerCase()))
                                      );
                                      
                                      if (filteredLocations.length === 0) {
                                        return (
                                          <div className="text-sm text-muted-foreground italic">
                                            Tidak ada lokasi yang cocok dengan pencarian
                                          </div>
                                        );
                                      }
                                      
                                      return (
                                        <div className="space-y-3">
                                          {filteredLocations.map((loc) => (
                                          <div key={loc.id} className="group relative bg-card border border-border rounded-lg p-4 hover:shadow-md hover:border-primary/40 transition-all duration-200">
                                            <div className="flex items-start gap-4">
                                              {/* Location Icon & Name */}
                                              <div className="flex-shrink-0 mt-0.5">
                                                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                                  <MapPin className="h-5 w-5 text-primary" />
                                                </div>
                                              </div>
                                              
                                              {/* Location Details */}
                                              <div className="flex-1 min-w-0 space-y-2 pr-20">
                                                <h4 className="font-semibold text-base text-foreground">
                                                  {loc.location_name}
                                                </h4>
                                                
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                                                  {/* Kolom Kiri: PIC dan Telepon */}
                                                  <div className="space-y-2">
                                                    {loc.pic && (
                                                      <div className="flex items-start">
                                                        <span className="text-muted-foreground font-medium w-[85px] flex-shrink-0">Nama PIC</span>
                                                        <span className="text-muted-foreground font-medium mr-2">:</span>
                                                        <span className="text-foreground">{loc.pic}</span>
                                                      </div>
                                                    )}
                                                    {loc.contact && (
                                                      <div className="flex items-start">
                                                        <span className="text-muted-foreground font-medium w-[85px] flex-shrink-0">Telepon</span>
                                                        <span className="text-muted-foreground font-medium mr-2">:</span>
                                                        <span className="text-foreground">{loc.contact}</span>
                                                      </div>
                                                    )}
                                                  </div>
                                                  
                                                  {/* Kolom Kanan: Bandwidth dan Alamat */}
                                                  <div className="space-y-2">
                                                    {loc.bandwidth && (
                                                      <div className="flex items-start">
                                                        <span className="text-muted-foreground font-medium w-[85px] flex-shrink-0">Bandwidth</span>
                                                        <span className="text-muted-foreground font-medium mr-2">:</span>
                                                        <span className="text-foreground">{loc.bandwidth} Mbps</span>
                                                      </div>
                                                    )}
                                                    {loc.address && (
                                                      <div className="flex items-start">
                                                        <span className="text-muted-foreground font-medium w-[85px] flex-shrink-0">Alamat</span>
                                                        <span className="text-muted-foreground font-medium mr-2">:</span>
                                                        <span className="text-foreground">{loc.address}</span>
                                                      </div>
                                                    )}
                                                  </div>
                                                </div>
                                              </div>
                                              
                                              {/* Action Buttons */}
                                              <div className="flex-shrink-0 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button 
                                                  variant="ghost" 
                                                  size="sm"
                                                  onClick={() => handleEditLocation(opd.id, loc)}
                                                  className="h-8 w-8 p-0 hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-950"
                                                  title="Edit Lokasi"
                                                >
                                                  <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button 
                                                  variant="ghost" 
                                                  size="sm"
                                                  onClick={() => handleDeleteLocation(opd.id, loc)}
                                                  className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                                                  title="Hapus Lokasi"
                                                >
                                                  <Trash2 className="h-4 w-4" />
                                                </Button>
                                              </div>
                                            </div>
                                          </div>
                                          ))}
                                        </div>
                                      );
                                    })()}
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Categories Tab */}
        <TabsContent value="categories" className="space-y-6">
          <CategoryManagement />
        </TabsContent>
      </Tabs>

      {/* OPD Dialog */}
      <Dialog open={isOPDDialogOpen} onOpenChange={setIsOPDDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{editingOPD ? 'Edit OPD' : 'Tambah OPD Baru'}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-1">
            <div className="space-y-4 pb-4">
            <div className="space-y-2">
              <Label htmlFor="opdName">Nama OPD (Maks. 30 karakter) *</Label>
              <Input
                id="opdName"
                value={opdForm.name}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value.length <= 30) {
                    setOpdForm(prev => ({ ...prev, name: value }));
                  }
                }}
                placeholder="Contoh: Dinas Komunikasi dan Informatika"
                maxLength={30}
                required
              />
              <p className="text-xs text-muted-foreground">
                {opdForm.name?.length || 0}/30 karakter
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="opdPic">Penanggung Jawab (Maks. 30 karakter)</Label>
              <Input
                id="opdPic"
                value={opdForm.pic}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value.length <= 30) {
                    setOpdForm(prev => ({ ...prev, pic: value }));
                  }
                }}
                placeholder="Nama penanggung jawab OPD"
                maxLength={30}
              />
              <p className="text-xs text-muted-foreground">
                {opdForm.pic?.length || 0}/30 karakter
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="opdPhone">Telepon (Maks. 15 digit)</Label>
              <Input
                id="opdPhone"
                type="tel"
                value={opdForm.phone}
                onChange={(e) => {
                  const value = e.target.value.replace(/[^0-9-]/g, '');
                  if (value.length <= 15) {
                    setOpdForm(prev => ({ ...prev, phone: value }));
                  }
                }}
                placeholder="Nomor telepon"
                maxLength={15}
              />
              <p className="text-xs text-muted-foreground">
                {opdForm.phone?.length || 0}/15 digit
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="opdAddress">Alamat (Maks. 60 karakter)</Label>
              <Textarea
                id="opdAddress"
                value={opdForm.address}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value.length <= 60) {
                    setOpdForm(prev => ({ ...prev, address: value }));
                  }
                }}
                placeholder="Alamat lengkap OPD"
                rows={3}
                maxLength={60}
              />
              <p className="text-xs text-muted-foreground">
                {opdForm.address?.length || 0}/60 karakter
              </p>
            </div>
            </div>
          </div>
          <div className="border-t pt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setIsOPDDialogOpen(false)}>
              <X className="h-4 w-4 mr-2" />
              Batal
            </Button>
            <Button type="button" onClick={handleSaveOPD}>
              <Save className="h-4 w-4 mr-2" />
              {editingOPD ? 'Update' : 'Simpan'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* OPD Location Dialog */}
      <Dialog open={isLocationDialogOpen} onOpenChange={setIsLocationDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              {editingLocation ? 'Edit Lokasi' : 'Tambah Lokasi Baru'}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-1">
            <div className="space-y-4 pb-4">
            <div className="space-y-2">
              <Label htmlFor="locationName">Nama Lokasi (Maks. 30 karakter) *</Label>
              <Input
                id="locationName"
                value={locationForm.location_name}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value.length <= 30) {
                    setLocationForm(prev => ({ ...prev, location_name: value }));
                  }
                }}
                placeholder="Contoh: Taman 1, Gedung A, Lantai 2"
                required
                maxLength={30}
              />
              <p className="text-xs text-muted-foreground">
                {locationForm.location_name?.length || 0}/30 karakter
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="locationPic">Nama PIC (Maks. 30 karakter)</Label>
              <Input
                id="locationPic"
                value={locationForm.pic}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value.length <= 30) {
                    setLocationForm(prev => ({ ...prev, pic: value }));
                  }
                }}
                placeholder="Nama penanggung jawab lokasi"
                maxLength={30}
              />
              <p className="text-xs text-muted-foreground">
                {locationForm.pic?.length || 0}/30 karakter
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="locationContact">Telepon (Maks. 15 digit)</Label>
              <Input
                id="locationContact"
                type="tel"
                value={locationForm.contact}
                onChange={(e) => {
                  const value = e.target.value.replace(/[^0-9-]/g, '');
                  if (value.length <= 15) {
                    setLocationForm(prev => ({ ...prev, contact: value }));
                  }
                }}
                placeholder="Contoh: 021-12345678"
                maxLength={15}
              />
              <p className="text-xs text-muted-foreground">
                {locationForm.contact?.length || 0}/15 digit
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="locationBandwidth">Bandwidth</Label>
              <div className="relative">
                <Input
                  id="locationBandwidth"
                  type="number"
                  value={locationForm.bandwidth}
                  onChange={(e) => setLocationForm(prev => ({ ...prev, bandwidth: e.target.value }))}
                  placeholder="Contoh: 100"
                  className="pr-16"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  Mbps
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="locationAddress">Alamat (Maks. 60 karakter)</Label>
              <Textarea
                id="locationAddress"
                value={locationForm.address}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value.length <= 60) {
                    setLocationForm(prev => ({ ...prev, address: value }));
                  }
                }}
                placeholder="Alamat lengkap lokasi"
                rows={2}
                maxLength={60}
              />
              <p className="text-xs text-muted-foreground">
                {locationForm.address?.length || 0}/60 karakter
              </p>
            </div>
            </div>
          </div>
          <div className="border-t pt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setIsLocationDialogOpen(false)}>
              <X className="h-4 w-4 mr-2" />
              Batal
            </Button>
            <Button type="button" onClick={handleSaveLocation}>
              <Save className="h-4 w-4 mr-2" />
              {editingLocation ? 'Update' : 'Simpan'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete OPD AlertDialog */}
      <AlertDialog open={isDeleteOPDDialogOpen} onOpenChange={setIsDeleteOPDDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi Penghapusan OPD</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus OPD "{deletingOPD?.name}"? 
              <span className="font-semibold text-destructive"> Semua lokasi di dalamnya juga akan terhapus.</span> Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDeleteOPD}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Location AlertDialog */}
      <AlertDialog open={isDeleteLocationDialogOpen} onOpenChange={setIsDeleteLocationDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi Penghapusan Lokasi</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus lokasi "{deletingLocation?.location.location_name}"? Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDeleteLocation}
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
