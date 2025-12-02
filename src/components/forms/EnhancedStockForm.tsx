import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Save, X, Calendar as CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import type { Category, Brand, Type } from '@/types/api';
import type { Item } from '@/types';

interface StockFormData {
  serial: string;
  category: string;
  brand: string;
  type: string;
  condition: string;
  notes: string;
  categoryId: string;
  brandId: string;
  typeId: string;
  entryDate?: string;
}

interface EnhancedStockFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: StockFormData) => void;
  isEditing?: boolean;
  initialData?: Partial<StockFormData> | Item | null;
  categories?: Category[];
  opds?: any[];
}

export default function EnhancedStockForm({ 
  isOpen, 
  onClose, 
  onSave, 
  isEditing = false, 
  initialData,
  categories = []
}: EnhancedStockFormProps) {
  const [formData, setFormData] = useState({
    serial: '',
    categoryId: '',
    brandId: '',
    typeId: '',
    condition: '',
    notes: '',
    entryDate: new Date().toISOString().split('T')[0]
  });
  const [entryDate, setEntryDate] = useState<Date>(new Date());

  const [availableBrands, setAvailableBrands] = useState<Brand[]>([]);
  const [availableTypes, setAvailableTypes] = useState<Type[]>([]);
  const [loadingBrands, setLoadingBrands] = useState(false);
  const [loadingTypes, setLoadingTypes] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<Item | null>(null);
  const [pendingBrandName, setPendingBrandName] = useState<string>('');
  const [pendingTypeName, setPendingTypeName] = useState<string>('');

  const conditions = ['Layak Pakai', 'Rusak Ringan', 'Rusak/Hilang'];

  // Store item data when dialog opens for editing
  useEffect(() => {
    if (isOpen && initialData && isEditing) {
      const isItemObject = 'serial_number' in initialData;
      
      if (isItemObject) {
        const item = initialData as Item;
        console.log('🔍 Edit Item - Initial Data:', {
          serial: item.serial_number,
          category: item.category_id,
          brand: item.brand,
          type: item.type,
          condition: item.condition
        });
        setItemToEdit(item);
        setPendingBrandName(item.brand || '');
        setPendingTypeName(item.type || '');
        const entryDateValue = item.entry_date ? new Date(item.entry_date) : new Date();
        setEntryDate(entryDateValue);
        setFormData({
          serial: item.serial_number || '',
          categoryId: item.category_id || '',
          brandId: '',
          typeId: '',
          condition: item.condition || 'Layak Pakai',
          notes: item.description || '',
          entryDate: format(entryDateValue, 'yyyy-MM-dd')
        });
      }
    } else if (isOpen && !isEditing) {
      console.log('➕ Add New Item');
      setItemToEdit(null);
      setPendingBrandName('');
      setPendingTypeName('');
      const today = new Date();
      setEntryDate(today);
      setFormData({
        serial: '',
        categoryId: '',
        brandId: '',
        typeId: '',
        condition: '',
        notes: '',
        entryDate: format(today, 'yyyy-MM-dd')
      });
      setAvailableBrands([]);
      setAvailableTypes([]);
    }
  }, [isOpen, initialData, isEditing]);

  // Listen for master data changes to refresh brands/types
  useEffect(() => {
    const handleMasterDataChange = () => {
      // Refresh brands if category is selected
      if (formData.categoryId) {
        const fetchBrands = async () => {
          try {
            const brands = await api.getBrands();
            const filteredBrands = brands.filter((b: Brand) => b.category_id === formData.categoryId);
            setAvailableBrands(filteredBrands);
          } catch (error) {
            console.error('Error refreshing brands:', error);
          }
        };
        fetchBrands();
      }
      
      // Refresh types if brand is selected
      if (formData.brandId) {
        const fetchTypes = async () => {
          try {
            const types = await api.getTypes();
            const filteredTypes = types.filter((t: Type) => t.brand_id === formData.brandId);
            setAvailableTypes(filteredTypes);
          } catch (error) {
            console.error('Error refreshing types:', error);
          }
        };
        fetchTypes();
      }
    };
    
    window.addEventListener('masterDataChanged', handleMasterDataChange);
    
    return () => {
      window.removeEventListener('masterDataChanged', handleMasterDataChange);
    };
  }, [formData.categoryId, formData.brandId]);

  // Fetch brands when category changes
  useEffect(() => {
    if (formData.categoryId) {
      const fetchBrands = async () => {
        try {
          setLoadingBrands(true);
          const brands = await api.getBrands();
          const filteredBrands = brands.filter((b: Brand) => b.category_id === formData.categoryId);
          console.log('📦 Fetched Brands for category:', formData.categoryId, 'Count:', filteredBrands.length);
          setAvailableBrands(filteredBrands);
          
          // If editing and we have pending brand name, auto-select matching brand
          if (isEditing && pendingBrandName) {
            console.log('🔍 Looking for brand:', pendingBrandName);
            const matchingBrand = filteredBrands.find((b: Brand) => b.name === pendingBrandName);
            if (matchingBrand) {
              console.log('✅ Found matching brand:', matchingBrand.name, 'ID:', matchingBrand.id);
              setFormData(prev => ({ ...prev, brandId: matchingBrand.id }));
              setPendingBrandName(''); // Clear after setting
            } else {
              console.log('❌ No matching brand found for:', pendingBrandName);
              console.log('Available brands:', filteredBrands.map(b => b.name));
            }
          } else if (!isEditing) {
            setFormData(prev => ({ ...prev, brandId: '', typeId: '' }));
            setAvailableTypes([]);
          }
        } catch (error) {
          console.error('Error fetching brands:', error);
          setAvailableBrands([]);
        } finally {
          setLoadingBrands(false);
        }
      };
      fetchBrands();
    } else {
      setAvailableBrands([]);
      setAvailableTypes([]);
      if (!isEditing) {
        setFormData(prev => ({ ...prev, brandId: '', typeId: '' }));
      }
    }
  }, [formData.categoryId, isEditing, pendingBrandName]);

  // Fetch types when brand changes
  useEffect(() => {
    if (formData.brandId) {
      const fetchTypes = async () => {
        try {
          setLoadingTypes(true);
          const types = await api.getTypes();
          const filteredTypes = types.filter((t: Type) => t.brand_id === formData.brandId);
          console.log('📦 Fetched Types for brand:', formData.brandId, 'Count:', filteredTypes.length);
          setAvailableTypes(filteredTypes);
          
          // If editing and we have pending type name, auto-select matching type
          if (isEditing && pendingTypeName) {
            console.log('🔍 Looking for type:', pendingTypeName);
            const matchingType = filteredTypes.find((t: Type) => t.name === pendingTypeName);
            if (matchingType) {
              console.log('✅ Found matching type:', matchingType.name, 'ID:', matchingType.id);
              setFormData(prev => ({ ...prev, typeId: matchingType.id }));
              setPendingTypeName(''); // Clear after setting
            } else {
              console.log('❌ No matching type found for:', pendingTypeName);
              console.log('Available types:', filteredTypes.map(t => t.name));
            }
          } else if (!isEditing) {
            setFormData(prev => ({ ...prev, typeId: '' }));
          }
        } catch (error) {
          console.error('Error fetching types:', error);
          setAvailableTypes([]);
        } finally {
          setLoadingTypes(false);
        }
      };
      fetchTypes();
    } else {
      setAvailableTypes([]);
      if (!isEditing) {
        setFormData(prev => ({ ...prev, typeId: '' }));
      }
    }
  }, [formData.brandId, isEditing, pendingTypeName]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validasi serial number
    if (!formData.serial.trim()) {
      alert('Nomor serial wajib diisi!');
      return;
    }
    
    // Validasi kategori
    if (!formData.categoryId) {
      alert('Silakan pilih kategori item!');
      return;
    }
    
    // Validasi brand
    if (!formData.brandId) {
      alert('Silakan pilih merek item!');
      return;
    }
    
    // Validasi type
    if (!formData.typeId) {
      alert('Silakan pilih tipe item!');
      return;
    }
    
    // Validasi kondisi
    if (!formData.condition) {
      alert('Silakan pilih kondisi item!');
      return;
    }
    
    // Validasi tanggal masuk
    const entryDate = new Date(formData.entryDate);
    const today = new Date();
    today.setHours(23, 59, 59, 999); // Set ke akhir hari
    
    const minDate = new Date();
    minDate.setFullYear(minDate.getFullYear() - 10);
    minDate.setHours(0, 0, 0, 0); // Set ke awal hari
    
    if (entryDate > today) {
      alert('Tanggal masuk tidak boleh lebih dari hari ini!');
      return;
    }
    
    if (entryDate < minDate) {
      alert('Tanggal masuk tidak boleh lebih dari 10 tahun yang lalu!');
      return;
    }
    
    // Find selected category, brand, and type details
    const selectedCategory = categories.find(cat => cat.id === formData.categoryId);
    const selectedBrand = availableBrands.find(brand => brand.id === formData.brandId);
    const selectedType = availableTypes.find(type => type.id === formData.typeId);

    const itemData = {
      serial: formData.serial,
      category: selectedCategory?.name || '',
      brand: selectedBrand?.name || '',
      type: selectedType?.name || '',
      condition: formData.condition,
      notes: formData.notes,
      categoryId: formData.categoryId,
      brandId: formData.brandId,
      typeId: formData.typeId,
      entryDate: formData.entryDate
    };

    onSave(itemData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Edit Item' : 'Tambah Item Baru'}
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto px-1">
          <div className="space-y-4 pb-4">
            <div className="space-y-2">
              <Label htmlFor="serial">Nomor Serial *</Label>
              <Input
                id="serial"
                value={formData.serial}
                onChange={(e) => setFormData(prev => ({ ...prev, serial: e.target.value }))}
                placeholder="Contoh: LT-001-2024"
                required
              />
            </div>

            {/* Kategori dan Merek - Berdampingan */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Kategori *</Label>
                <Select 
                  value={formData.categoryId} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, categoryId: value }))}
                >
                  <SelectTrigger className="text-left">
                    <SelectValue placeholder="Pilih kategori" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="brand">Merek *</Label>
                <Select 
                  key={`brand-${formData.brandId}`}
                  value={formData.brandId} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, brandId: value }))}
                  disabled={!formData.categoryId || loadingBrands}
                >
                  <SelectTrigger className="text-left">
                    <SelectValue placeholder={
                      loadingBrands ? "Memuat merek..." : 
                      !formData.categoryId ? "Pilih kategori terlebih dahulu" : 
                      availableBrands.length === 0 ? "Tidak ada merek tersedia" :
                      "Pilih merek"
                    } />
                  </SelectTrigger>
                  <SelectContent>
                    {availableBrands.map((brand) => (
                      <SelectItem key={brand.id} value={brand.id}>
                        {brand.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Tipe dan Kondisi - Berdampingan */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="type">Tipe *</Label>
                <Select 
                  key={`type-${formData.typeId}`}
                  value={formData.typeId} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, typeId: value }))}
                  disabled={!formData.brandId || loadingTypes}
                >
                  <SelectTrigger className="text-left">
                    <SelectValue placeholder={
                      loadingTypes ? "Memuat tipe..." :
                      !formData.brandId ? "Pilih merek terlebih dahulu" : 
                      availableTypes.length === 0 ? "Tidak ada tipe tersedia" :
                      "Pilih tipe"
                    } />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="condition">Kondisi *</Label>
                <Select 
                  value={formData.condition} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, condition: value }))}
                >
                  <SelectTrigger className="text-left">
                    <SelectValue placeholder="Pilih kondisi" />
                  </SelectTrigger>
                  <SelectContent>
                    {conditions.map((condition) => (
                      <SelectItem key={condition} value={condition}>
                        {condition}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="entryDate">Tanggal Masuk *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !entryDate && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {entryDate ? format(entryDate, 'dd/MM/yyyy', { locale: localeId }) : 'Pilih tanggal'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={entryDate}
                    onSelect={(date) => {
                      if (date) {
                        setEntryDate(date);
                        setFormData(prev => ({ ...prev, entryDate: format(date, 'yyyy-MM-dd') }));
                      }
                    }}
                    initialFocus
                    locale={localeId}
                    disabled={(date) => {
                      const today = new Date();
                      const tenYearsAgo = new Date();
                      tenYearsAgo.setFullYear(today.getFullYear() - 10);
                      return date > today || date < tenYearsAgo;
                    }}
                  />
                </PopoverContent>
              </Popover>
              <p className="text-xs text-muted-foreground">
                Tanggal tidak boleh lebih dari hari ini atau lebih dari 10 tahun yang lalu
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Catatan</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Catatan tambahan untuk item ini..."
                rows={3}
              />
            </div>
          </div>
        </div>
        
        {/* Sticky Footer dengan Tombol */}
        <div className="border-t pt-4 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button type="button" onClick={handleSubmit}>
            {isEditing ? 'Perbarui' : 'Tambah'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}