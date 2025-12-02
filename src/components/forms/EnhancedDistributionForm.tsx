import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Save, X, ArrowRight, Building2, MapPin, Info, AlertTriangle, Calendar as CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import type { OPD, OPDLocation } from '@/types';

interface DistributionFormData {
  id?: string;
  itemId: string;
  direction: 'Gudang → OPD' | 'OPD → Gudang' | 'OPD → OPD';
  sourceOpdId: string;
  targetOpdId: string;
  specificLocation: string;
  locationId: string;
  notes: string;
  condition: string;
  processedBy: string;
  created_at?: string; // For chronological ordering
  distributionCode?: string;
  originalDistributionDate?: string;
  distribution_date?: string;
  item?: {
    id: string;
    serial_number: string;
    name: string;
    category: string;
    brand: string;
    type: string;
    current_location: string;
  };
  sourceOpd?: { id: string; name: string };
  targetOpd?: { id: string; name: string };
  selectedLocation?: Location;
  transaction_date: string;
}

interface StockItem {
  id: string;
  serial_number: string;
  name: string;
  category: string | { id: string; name: string };
  brand: string | { id: string; name: string };
  type: string | { id: string; name: string };
  model?: string; // fallback for backward compatibility
  current_location: string;
  current_opd_id?: string;
  current_opd?: { id: string; name: string };
}

// Helper function to extract string value from category/brand/type
const getStringValue = (field: string | { id: string; name: string } | undefined): string => {
  try {
    if (!field) return '';
    if (typeof field === 'string') return field;
    if (typeof field === 'object' && field.name) return field.name;
    return '';
  } catch (err) {
    console.error('getStringValue error:', err, field);
    return '';
  }
};

interface EnhancedDistributionFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: DistributionFormData) => void;
  items: StockItem[];
  isEditing?: boolean;
  initialData?: Partial<DistributionFormData>;
}

export default function EnhancedDistributionForm({ 
  isOpen, 
  onClose, 
  onSave, 
  items,
  isEditing = false, 
  initialData 
}: EnhancedDistributionFormProps) {
  // Initialize with default values
  const [formData, setFormData] = useState<FormData>({
    itemId: '',
    direction: '' as 'Gudang → OPD' | 'OPD → Gudang' | 'OPD → OPD' | '',
    sourceOpdId: '',
    targetOpdId: '',
    specificLocation: '',
    locationId: '',
    notes: '',
    condition: '', // Empty by default, user must select
    processedBy: '',
    transaction_date: (() => {
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    })()
  });

  const [opds, setOpds] = useState<OPD[]>([]);
  const [availableSourceLocations, setAvailableSourceLocations] = useState<OPDLocation[]>([]);
  const [availableTargetLocations, setAvailableTargetLocations] = useState<OPDLocation[]>([]);
  const [selectedItem, setSelectedItem] = useState<StockItem | null>(null);
  const [isLoadingOpds, setIsLoadingOpds] = useState(false);
  const [itemSearchValue, setItemSearchValue] = useState('');
  const [dateValidationError, setDateValidationError] = useState<string>('');
  const [transactionDate, setTransactionDate] = useState<Date>(new Date());
  // Removed: targetConflictError - now handled by backend validation only
  const [previousDirection, setPreviousDirection] = useState<string | null>(null);
  const [isFirstDistribution, setIsFirstDistribution] = useState<boolean>(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const conditions = ['Layak Pakai', 'Rusak Ringan', 'Rusak/Hilang'];

  // Determine available directions based on business logic (EDIT MODE ONLY)
  const availableDirections = useMemo(() => {
    console.log('=== Available Directions Calculation ===');
    console.log('isEditing:', isEditing);
    console.log('selectedItem:', selectedItem);
    console.log('isFirstDistribution:', isFirstDistribution);
    console.log('previousDirection:', previousDirection);
    console.log('formData.direction:', formData.direction);
    const includeCurrentDirection = (
      directions: Array<'Gudang → OPD' | 'OPD → Gudang' | 'OPD → OPD'>
    ) => {
      const unique = new Set<'Gudang → OPD' | 'OPD → Gudang' | 'OPD → OPD'>(directions);
      if (formData.direction) {
        unique.add(formData.direction);
      }
      return Array.from(unique);
    };
    
    if (!isEditing) {
      // For new distribution, allow selection based on item location
      if (selectedItem?.current_location === 'Gudang') {
        console.log('New distribution - Item in Gudang');
        return includeCurrentDirection(['Gudang → OPD']);
      } else if (selectedItem?.current_location === 'OPD') {
        console.log('New distribution - Item in OPD');
        return includeCurrentDirection(['OPD → OPD', 'OPD → Gudang']);
      }
      console.log('New distribution - Default all options');
      return includeCurrentDirection(['Gudang → OPD', 'OPD → OPD', 'OPD → Gudang']);
    }

    // EDIT MODE: Filter based on previous distribution
    // Rule 1: If this is FIRST distribution (no previous), must be "Gudang → OPD"
    if (isFirstDistribution) {
      console.log('EDIT MODE - First distribution, only Gudang → OPD');
      return includeCurrentDirection(['Gudang → OPD']);
    }

    // Rule 2: If there's previous distribution, check where item was BEFORE this distribution
    if (previousDirection) {
      // If previous was "OPD → Gudang", item is in Gudang, so must be "Gudang → OPD"
      if (previousDirection === 'OPD → Gudang') {
        console.log('EDIT MODE - Previous OPD→Gudang, only Gudang → OPD');
        return includeCurrentDirection(['Gudang → OPD']);
      }
      
      // If previous was "Gudang → OPD" or "OPD → OPD", item is in OPD
      if (previousDirection === 'Gudang → OPD' || previousDirection === 'OPD → OPD') {
        console.log('EDIT MODE - Previous Gudang→OPD or OPD→OPD, OPD options');
        return includeCurrentDirection(['OPD → OPD', 'OPD → Gudang']);
      }
    }

    // Fallback: Include current direction to ensure it's visible in Select
    const fallbackDirections = includeCurrentDirection(['Gudang → OPD', 'OPD → OPD', 'OPD → Gudang']);
    console.log('EDIT MODE - FALLBACK with current direction:', fallbackDirections);
    return fallbackDirections;
  }, [isEditing, selectedItem, isFirstDistribution, previousDirection, formData.direction]);

  // Close search results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setItemSearchValue('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch OPDs on mount
  useEffect(() => {
    const fetchOpds = async () => {
      if (!isOpen) return;
      
      try {
        setIsLoadingOpds(true);
        const opdsData = await api.getOPDs();
        setOpds(opdsData);
      } catch (error) {
        console.error('Error fetching OPDs:', error);
      } finally {
        setIsLoadingOpds(false);
      }
    };
    
    fetchOpds();
  }, [isOpen]);

  // Fetch previous distribution to determine available directions (EDIT MODE)
  useEffect(() => {
    console.log('=== Fetch Previous Distribution Effect ===');
    console.log('isEditing:', isEditing);
    console.log('initialData:', initialData);
    
    if (!isEditing || !initialData?.itemId || !initialData?.id) {
      console.log('Skipping fetch - conditions not met', {
        isEditing,
        hasItemId: !!initialData?.itemId,
        hasId: !!initialData?.id,
        initialData
      });
      setPreviousDirection(null);
      setIsFirstDistribution(false);
      return;
    }

    const fetchPreviousDistribution = async () => {
      try {
        console.log('Fetching distributions for item:', initialData.itemId);
        const response = await fetch(`/api/v1/distributions?item_id=${initialData.itemId}`);
        if (!response.ok) {
          console.log('API response not OK:', response.status);
          return;
        }

        const result = await response.json();
        const distributions: any[] = Array.isArray(result)
          ? result
          : Array.isArray(result?.data)
            ? result.data
            : [];
        console.log('All distributions:', distributions);

        const currentIdentifiers = new Set(
          [initialData.distributionCode, initialData.id].filter(Boolean) as string[]
        );
        const otherDistributions = distributions.filter((d: any) => {
          const codeMatch = d.distribution_code && currentIdentifiers.has(d.distribution_code);
          const idMatch = d.id && currentIdentifiers.has(d.id);
          return !(codeMatch || idMatch);
        });

        if (otherDistributions.length === 0) {
          console.log('No other distributions found - treating as first distribution');
          setPreviousDirection(null);
          setIsFirstDistribution(true);
          return;
        }

        // CRITICAL FIX: Use created_at directly (ISO string comparison) to avoid timezone bugs
        const currentCreatedAt = initialData.created_at;
        
        console.log('🔍 Looking for previous distribution before:', currentCreatedAt);
        console.log('📋 Other distributions count:', otherDistributions.length);
        console.log('📋 Other distributions:', otherDistributions.map((d: any) => ({
          code: d.distribution_code,
          created_at: d.created_at,
          direction: d.direction
        })));

        const previousDist = otherDistributions
          .filter((d: any) => {
            if (!currentCreatedAt) {
              console.log('  ⚠️ No currentCreatedAt - including all distributions');
              return true;
            }
            if (!d.created_at) {
              console.log('  ⚠️ Distribution missing created_at:', d.distribution_code);
              return false;
            }
            // Direct ISO string comparison (works because ISO format is sortable)
            const isBeforeCurrent = d.created_at < currentCreatedAt;
            console.log(
              `  Check ${d.distribution_code} (${d.created_at}) before current (${currentCreatedAt})? ${isBeforeCurrent}`
            );
            return isBeforeCurrent;
          })
          .sort((a: any, b: any) => {
            // Sort by created_at descending to get the most recent previous distribution
            return b.created_at > a.created_at ? 1 : b.created_at < a.created_at ? -1 : 0;
          })[0];

        console.log('✅ Previous distribution found:', previousDist ? previousDist.distribution_code : 'NONE');

        if (previousDist) {
          console.log('Setting previous direction:', previousDist.direction);
          setPreviousDirection(previousDist.direction);
          setIsFirstDistribution(false);
        } else {
          console.log('No previous distribution before this one - treating as first distribution');
          setPreviousDirection(null);
          setIsFirstDistribution(true);
        }
      } catch (error) {
        console.error('Error fetching previous distribution:', error);
        setPreviousDirection(null);
        setIsFirstDistribution(false);
      }
    };
    
    fetchPreviousDistribution();
  }, [
    isEditing,
    initialData?.itemId,
    initialData?.id,
    initialData?.created_at,
    initialData?.distributionCode,
    initialData?.transaction_date,
    initialData?.originalDistributionDate
  ]);

  useEffect(() => {
    if (isEditing && isFirstDistribution && formData.direction !== 'Gudang → OPD') {
      setFormData(prev => ({ ...prev, direction: 'Gudang → OPD' }));
    }
  }, [isEditing, isFirstDistribution, formData.direction]);

  // Load initialData into formData (EDIT MODE)
  useEffect(() => {
    console.log('=== Load Initial Data to FormData ===');
    console.log('isEditing:', isEditing);
    console.log('initialData:', initialData);
    console.log('isOpen:', isOpen);
    
    // CRITICAL: Only run when dialog is open AND we have initialData
    if (!isOpen || !initialData || !isEditing) {
      console.log('Skipping - missing conditions:', {
        isOpen,
        hasInitialData: !!initialData,
        isEditing
      });
      return;
    }
    
    console.log('Loading initialData to formData...');
    // Edit mode: load existing data
    // Format date WITHOUT timezone conversion to prevent date shift
    let formattedDate: string;
    let dateObject: Date;
    if (initialData.transaction_date) {
      // CRITICAL FIX: Extract date directly from ISO string to avoid timezone conversion
      // Example: "2025-11-14T18:10:58.000Z" -> "2025-11-14" (no conversion to local time)
      const isoString = typeof initialData.transaction_date === 'string' 
        ? initialData.transaction_date 
        : new Date(initialData.transaction_date).toISOString();
      formattedDate = isoString.split('T')[0]; // Get YYYY-MM-DD part only
      dateObject = new Date(formattedDate + 'T00:00:00'); // Create date without timezone shift
      console.log('📅 Original transaction_date:', initialData.transaction_date);
      console.log('📅 Formatted date (no timezone conversion):', formattedDate);
    } else {
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      formattedDate = `${year}-${month}-${day}`;
      dateObject = today;
    }
    
    setTransactionDate(dateObject);
    setFormData({
      itemId: initialData.itemId || '',
      direction: initialData.direction || 'Gudang → OPD',
      sourceOpdId: initialData.sourceOpdId || '',
      targetOpdId: initialData.targetOpdId || '',
      specificLocation: initialData.specificLocation || '',
      locationId: initialData.locationId || '',
      notes: initialData.notes || '',
      condition: initialData.condition || 'Layak Pakai',
      processedBy: initialData.processedBy || '',
      transaction_date: formattedDate
    });
    console.log('FormData set with initialData');
    console.log('Direction set to:', initialData.direction || 'Gudang → OPD');
    console.log('Full formData:', {
      itemId: initialData.itemId || '',
      direction: initialData.direction || 'Gudang → OPD',
      sourceOpdId: initialData.sourceOpdId || '',
      targetOpdId: initialData.targetOpdId || ''
    });
    
    // Load locations for edit mode
    if (initialData.targetOpdId) {
      console.log('Loading target locations for OPD:', initialData.targetOpdId);
      api.getOPDLocations(initialData.targetOpdId).then(locations => {
        setAvailableTargetLocations(locations);
        
        // Try to match specificLocation with location ID
        if (locations.length > 0) {
          let targetLocationId = initialData.locationId;
          
          // If no locationId but have specificLocation, try to find by name
          if (!targetLocationId && initialData.specificLocation) {
            const matchedLocation = locations.find(loc => 
              loc.location_name === initialData.specificLocation || 
              loc.id === initialData.specificLocation
            );
            if (matchedLocation) {
              targetLocationId = matchedLocation.id;
            }
          }
          
          // Set the locationId if found
          if (targetLocationId) {
            setFormData(prev => ({ ...prev, locationId: targetLocationId }));
          }
        }
      }).catch(err => console.error('Error loading locations:', err));
    }
  }, [initialData, isEditing, isOpen]);

  // Reset form for create mode
  useEffect(() => {
    if (!isEditing && isOpen) {
      console.log('Resetting formData to empty (create mode)');
      // Create mode: start with empty fields
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      const todayFormatted = `${year}-${month}-${day}`;
      
      setTransactionDate(today);
      setFormData({
        itemId: '',
        direction: '' as any,
        sourceOpdId: '',
        targetOpdId: '',
        specificLocation: '',
        locationId: '',
        notes: '',
        condition: '', // Empty by default, user must select
        processedBy: '',
        transaction_date: todayFormatted
      });
    }
  }, [isEditing, isOpen]);

  // Update selected item details
  useEffect(() => {
    if (formData.itemId) {
      const item = items.find(i => i.id === formData.itemId);
      setSelectedItem(item);
    } else {
      setSelectedItem(null);
    }
  }, [formData.itemId, items]);

  // Auto-set sourceOpdId for OPD transactions
  useEffect(() => {
    if (!isEditing && selectedItem && (formData.direction === 'OPD → OPD' || formData.direction === 'OPD → Gudang')) {
      // Item is in OPD, auto-set sourceOpdId from current location
      if (selectedItem.current_location === 'OPD' && selectedItem.current_opd_id) {
        setFormData(prev => ({ ...prev, sourceOpdId: selectedItem.current_opd_id || '' }));
      }
    }
  }, [formData.direction, selectedItem, isEditing]);

  // Update available locations when source OPD changes
  useEffect(() => {
    const fetchSourceLocations = async () => {
      if (formData.sourceOpdId) {
        try {
          const locations = await api.getOPDLocations(formData.sourceOpdId);
          setAvailableSourceLocations(locations);
        } catch (error) {
          console.error('Error fetching source locations:', error);
          setAvailableSourceLocations([]);
        }
      } else {
        setAvailableSourceLocations([]);
      }
    };
    
    fetchSourceLocations();
  }, [formData.sourceOpdId]);

  // Update available locations when target OPD changes
  useEffect(() => {
    const fetchTargetLocations = async () => {
      if (formData.targetOpdId) {
        try {
          const locations = await api.getOPDLocations(formData.targetOpdId);
          setAvailableTargetLocations(locations);
          // Only reset location in create mode, not edit mode
          if (!isEditing) {
            setFormData(prev => ({ ...prev, locationId: '', specificLocation: '' }));
          }
        } catch (error) {
          console.error('Error fetching target locations:', error);
          setAvailableTargetLocations([]);
        }
      } else {
        setAvailableTargetLocations([]);
      }
    };
    
    fetchTargetLocations();
  }, [formData.targetOpdId, isEditing]);

  // Match location in edit mode when locations are loaded
  useEffect(() => {
    if (isEditing && availableTargetLocations.length > 0 && !formData.locationId && initialData?.specificLocation) {
      const matchedLocation = availableTargetLocations.find(loc => 
        loc.location_name === initialData.specificLocation || 
        loc.id === initialData.specificLocation
      );
      if (matchedLocation) {
        setFormData(prev => ({ ...prev, locationId: matchedLocation.id }));
      }
    }
  }, [isEditing, availableTargetLocations, formData.locationId, initialData]);

  // Update specific location when location is selected
  useEffect(() => {
    if (formData.locationId) {
      const location = availableTargetLocations.find(loc => loc.id === formData.locationId);
      setFormData(prev => ({ ...prev, specificLocation: location?.id || '' }));
    }
  }, [formData.locationId, availableTargetLocations]);

  // Validate distribution date in edit mode
  useEffect(() => {
    if (!isEditing || !formData.itemId || !initialData?.id) {
      setDateValidationError('');
      return;
    }

    const validateDate = async () => {
      try {
        // Fetch all distributions for this item
        const response = await fetch(`/api/v1/distributions?item_id=${formData.itemId}`);
        if (!response.ok) throw new Error('Failed to fetch distributions');
        
        const result = await response.json();
        const distributions = result.data || [];
        
        // Sort by date
        const sortedDistributions = distributions
          .filter((d: any) => d.distribution_code !== initialData.id) // Exclude current distribution
          .sort((a: any, b: any) => new Date(a.distribution_date).getTime() - new Date(b.distribution_date).getTime());
        
        const currentDate = new Date(formData.transaction_date);
        const today = new Date();
        today.setHours(23, 59, 59, 999); // End of today
        
        // Check if date is in the future
        if (currentDate > today) {
          setDateValidationError('Tanggal tidak boleh di masa depan');
          return;
        }
        
        // Check if date is more than 10 years ago
        const minDate = new Date();
        minDate.setFullYear(minDate.getFullYear() - 10);
        minDate.setHours(0, 0, 0, 0);
        if (currentDate < minDate) {
          setDateValidationError('Tanggal tidak boleh lebih dari 10 tahun yang lalu');
          return;
        }
        
        // Validate against item entry date
        if (selectedItem?.entry_date) {
          const entryDate = new Date(selectedItem.entry_date);
          entryDate.setHours(0, 0, 0, 0);
          if (currentDate < entryDate) {
            setDateValidationError(`Tanggal tidak boleh sebelum item masuk gudang (${new Date(entryDate).toLocaleDateString('id-ID')})`);
            return;
          }
        }
        
        // Find previous and next distributions
        let previousDistribution = null;
        let nextDistribution = null;
        
        for (const d of sortedDistributions) {
          const dDate = new Date(d.distribution_date);
          if (dDate < currentDate) {
            previousDistribution = d;
          } else if (dDate > currentDate && !nextDistribution) {
            nextDistribution = d;
            break;
          }
        }
        
        // Validate against previous distribution
        if (previousDistribution) {
          const prevDate = new Date(previousDistribution.distribution_date);
          if (currentDate <= prevDate) {
            setDateValidationError(`Tanggal harus setelah distribusi sebelumnya (${new Date(prevDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })})`);
            return;
          }
        }
        
        // Validate against next distribution
        if (nextDistribution) {
          const nextDate = new Date(nextDistribution.distribution_date);
          if (currentDate >= nextDate) {
            setDateValidationError(`Tanggal harus sebelum distribusi berikutnya (${new Date(nextDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })})`);
            return;
          }
        }
        
        // All validations passed
        setDateValidationError('');
      } catch (error) {
        console.error('Error validating date:', error);
        setDateValidationError('Gagal memvalidasi tanggal');
      }
    };

    validateDate();
  }, [formData.transaction_date, formData.itemId, isEditing, initialData]);

  // Removed: Target conflict validation - now handled by backend only for consistent error messaging

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields for create mode
    if (!isEditing) {
      if (!formData.condition || formData.condition.trim() === '') {
        alert('Kondisi item wajib dipilih!');
        return;
      }
      if (!formData.processedBy || formData.processedBy.trim() === '') {
        alert('Diketahui wajib diisi!');
        return;
      }
    }
    
    // Prevent submission if validation failed in edit mode
    if (isEditing && dateValidationError) {
      return;
    }
    
    // Find selected OPDs and location details
    const sourceOpd = opds.find(opd => opd.id === formData.sourceOpdId);
    const targetOpd = opds.find(opd => opd.id === formData.targetOpdId);
    const selectedLocation = availableTargetLocations.find(loc => loc.id === formData.locationId);

    // Use location name for specific_location, not ID
    const specificLocationName = selectedLocation?.location_name || formData.specificLocation || '';

    // Format date for API
    const formattedDate = isEditing 
      ? new Date(formData.transaction_date + 'T00:00:00').toISOString()
      : new Date().toISOString();

    const distributionData = {
      ...formData,
      specificLocation: specificLocationName,
      item: selectedItem,
      sourceOpd: sourceOpd ? { id: sourceOpd.id.toString(), name: sourceOpd.name } : undefined,
      targetOpd: targetOpd ? { id: targetOpd.id.toString(), name: targetOpd.name } : undefined,
      selectedLocation,
      transaction_date: formattedDate,
      distribution_date: formData.transaction_date // Send raw date string for backend validation
    };

    onSave(distributionData);
  };

  const getDirectionDescription = () => {
    switch (formData.direction) {
      case 'Gudang → OPD':
        return 'Item akan dipindahkan dari Gudang ke OPD tujuan. Sistem otomatis mengetahui asal barang dari Gudang.';
      case 'OPD → Gudang':
        return 'Item akan dikembalikan ke Gudang. Sistem otomatis mengetahui asal barang dari OPD dan tujuan ke Gudang.';
      case 'OPD → OPD':
        return 'Item akan dipindahkan antar OPD. Sistem otomatis mengetahui track record asal barang dari OPD sebelumnya.';
      default:
        return '';
    }
  };



  // Don't render if no items available
  if (!isOpen) {
    return null;
  }

  if (items.length === 0) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tidak Ada Item</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-muted-foreground">
              Belum ada item yang tersedia untuk didistribusikan. Silakan tambahkan item terlebih dahulu di menu Stok.
            </p>
            <div className="flex justify-end">
              <Button type="button" variant="outline" onClick={onClose}>
                Tutup
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Edit Distribusi' : 'Buat Distribusi Baru'}
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto px-1">
          <div className="space-y-4 pb-4">
          {/* Item Selection with Search */}
          <div className="space-y-2">
            <Label htmlFor="item">Pilih Item *</Label>
            
            {/* Mode Create: Show searchbar */}
            {!isEditing && (
              <div className="relative" ref={searchContainerRef}>
                <Input
                  type="text"
                  placeholder="Ketik serial number, kategori, merek, atau tipe untuk mencari item..."
                  value={itemSearchValue}
                  onChange={(e) => {
                    try {
                      setItemSearchValue(e.target.value || '');
                    } catch (err) {
                      console.error('Input change error:', err);
                    }
                  }}
                  className="w-full"
                />
                
                {/* Search Results */}
                {itemSearchValue && itemSearchValue.length > 0 && items && items.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-[400px] overflow-y-auto">
                  {items
                    .filter((item) => {
                      try {
                        if (!item) return false;
                        const searchLower = itemSearchValue.toLowerCase();
                        const serialNumber = (item.serial_number || '').toLowerCase();
                        const itemName = (item.name || '').toLowerCase();
                        const categoryStr = getStringValue(item.category).toLowerCase();
                        const brandStr = getStringValue(item.brand).toLowerCase();
                        const typeStr = getStringValue(item.type || item.model).toLowerCase();
                        return (
                          serialNumber.includes(searchLower) ||
                          itemName.includes(searchLower) ||
                          categoryStr.includes(searchLower) ||
                          brandStr.includes(searchLower) ||
                          typeStr.includes(searchLower)
                        );
                      } catch (err) {
                        console.error('Filter error:', err);
                        return false;
                      }
                    })
                    .slice(0, 50)
                    .map((item) => {
                      try {
                        const categoryName = getStringValue(item.category) || '-';
                        const brandName = getStringValue(item.brand) || '-';
                        const typeName = getStringValue(item.type || item.model) || '-';
                        
                        return (
                          <div
                            key={item.id}
                            className="px-4 py-3 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0"
                            onClick={() => {
                              try {
                                setFormData(prev => ({ 
                                  ...prev, 
                                  itemId: item.id,
                                  direction: '' as any, // Reset arah distribusi saat item berubah
                                  sourceOpdId: '',
                                  targetOpdId: '',
                                  specificLocation: '',
                                  locationId: ''
                                }));
                                setItemSearchValue('');
                              } catch (err) {
                                console.error('Select error:', err);
                              }
                            }}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono font-semibold">
                                {item.serial_number || 'N/A'}
                              </code>
                              <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-800 rounded">
                                {item.current_location || '-'}
                              </span>
                            </div>
                            <div className="text-sm font-medium text-gray-700">
                              {categoryName} • {brandName} • {typeName}
                            </div>
                          </div>
                        );
                      } catch (err) {
                        console.error('Render item error:', err);
                        return null;
                      }
                    })
                    .filter(Boolean)
                  }
                </div>
              )}
              </div>
            )}
            
            {/* Show selected item (both modes) */}
            {selectedItem && (
              <div className="relative p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-sm">Item Terpilih</h4>
                  <div className="flex items-center gap-4">
                    <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-800 rounded font-medium">
                      {selectedItem.current_location}
                    </span>
                    {/* X button only in create mode */}
                    {!isEditing && (
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ 
                          ...prev, 
                          itemId: '',
                          direction: '' as any,
                          sourceOpdId: '',
                          targetOpdId: '',
                          specificLocation: '',
                          locationId: ''
                        }))}
                        className="text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded p-1 transition-colors"
                        title="Batalkan pilihan item"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div className="flex">
                    <span className="font-medium w-20">Serial</span>
                    <span className="mr-2">:</span>
                    <span>{selectedItem.serial_number}</span>
                  </div>
                  <div className="flex">
                    <span className="font-medium w-20">Merek</span>
                    <span className="mr-2">:</span>
                    <span>{getStringValue(selectedItem.brand)}</span>
                  </div>
                  <div className="flex">
                    <span className="font-medium w-20">Kategori</span>
                    <span className="mr-2">:</span>
                    <span>{getStringValue(selectedItem.category)}</span>
                  </div>
                  <div className="flex">
                    <span className="font-medium w-20">Tipe</span>
                    <span className="mr-2">:</span>
                    <span>{getStringValue(selectedItem.type || selectedItem.model)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Distribution Code - EDIT MODE ONLY */}
          {isEditing && initialData?.distributionCode && (
            <div className="space-y-2">
              <Label htmlFor="distributionCode">Kode</Label>
              <Input
                id="distributionCode"
                value={initialData.distributionCode}
                readOnly
                className="bg-gray-50 cursor-default"
              />
            </div>
          )}

          {/* Direction Selection */}
          <div className="space-y-2">
            <Label htmlFor="direction">Arah Distribusi *</Label>
            
            {/* Business Logic Alert - EDIT MODE ONLY */}
            {isEditing && isFirstDistribution && (
              <Alert className="bg-blue-50 border-blue-200">
                <Info className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-sm text-blue-800">
                  <strong>ℹ️ Distribusi Pertama:</strong> Item baru keluar dari gudang, hanya bisa dikirim ke OPD.
                </AlertDescription>
              </Alert>
            )}
            
            {isEditing && previousDirection === 'OPD → Gudang' && (
              <Alert className="bg-amber-50 border-amber-200">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-sm text-amber-800">
                  <strong>⚠️ Item di Gudang:</strong> Distribusi sebelumnya "{previousDirection}" menempatkan item di gudang. Hanya bisa dikirim ke OPD.
                </AlertDescription>
              </Alert>
            )}
            
            {isEditing && (previousDirection === 'Gudang → OPD' || previousDirection === 'OPD → OPD') && (
              <Alert className="bg-green-50 border-green-200">
                <Info className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-sm text-green-800">
                  <strong>✅ Item di OPD:</strong> Distribusi sebelumnya "{previousDirection}" menempatkan item di OPD. Bisa dipindah ke OPD lain atau dikembalikan ke gudang.
                </AlertDescription>
              </Alert>
            )}
            
            <Select 
              key={`direction-${isOpen}-${formData.direction}`}
              value={formData.direction ? formData.direction : undefined}
              onValueChange={(value: 'Gudang → OPD' | 'OPD → Gudang' | 'OPD → OPD') => {
                console.log('Direction changed to:', value);
                setFormData(prev => ({ 
                  ...prev, 
                  direction: value,
                  sourceOpdId: isEditing ? prev.sourceOpdId : '',
                  targetOpdId: '', // Always reset target OPD when direction changes
                  specificLocation: '', // Always reset location when direction changes
                  locationId: '' // Always reset locationId when direction changes
                }));
              }}
              disabled={!selectedItem && !isEditing}
            >
              <SelectTrigger className={(!selectedItem && !isEditing) ? "text-muted-foreground" : ""}>
                <SelectValue placeholder={(selectedItem || isEditing) ? "Pilih arah distribusi" : "Pilih item terlebih dahulu"} />
              </SelectTrigger>
              <SelectContent>
                {availableDirections.length > 0 ? (
                  availableDirections.map((direction) => (
                    <SelectItem key={direction} value={direction}>
                      {direction}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="" disabled>Tidak ada pilihan</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* OPD Tujuan dan Lokasi - Side by Side */}
          {/* Tampil selalu, tapi disabled atau tersembunyi berdasarkan kondisi */}
          {formData.direction !== 'OPD → Gudang' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* OPD Tujuan */}
              <div className="space-y-2">
                <Label htmlFor="targetOpd">OPD Tujuan *</Label>
                <Select 
                  key={`targetOpd-${formData.targetOpdId}-${isEditing}`}
                  value={formData.targetOpdId || undefined} 
                  onValueChange={(value) => setFormData(prev => ({ 
                    ...prev, 
                    targetOpdId: value,
                    locationId: '', // Always reset when OPD changes
                    specificLocation: ''
                  }))}
                  disabled={(!formData.direction || formData.direction === 'OPD → Gudang') && !isEditing}
                >
                  <SelectTrigger className={((!formData.direction || formData.direction === 'OPD → Gudang') && !isEditing) ? "text-muted-foreground" : ""}>
                    <SelectValue placeholder={(formData.direction && formData.direction !== 'OPD → Gudang') || isEditing ? "Pilih OPD tujuan" : "Pilih arah distribusi terlebih dahulu"} />
                  </SelectTrigger>
                  <SelectContent className="max-h-[200px]">
                    {opds.map((opd) => (
                      <SelectItem key={opd.id} value={opd.id}>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4" />
                          <span>{opd.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Lokasi */}
              <div className="space-y-2">
                <Label htmlFor="location">Lokasi *</Label>
                <Select 
                  key={`location-${formData.locationId}-${formData.specificLocation}-${availableTargetLocations.length}-${formData.targetOpdId}`}
                  value={(formData.locationId || formData.specificLocation) ? (formData.locationId || formData.specificLocation) : undefined} 
                  onValueChange={(value) => {
                    if (availableTargetLocations.length > 0 || isEditing) {
                      setFormData(prev => ({ ...prev, locationId: value, specificLocation: '' }));
                    } else {
                      setFormData(prev => ({ ...prev, specificLocation: value, locationId: '' }));
                    }
                  }}
                  disabled={!formData.targetOpdId && !isEditing}
                >
                  <SelectTrigger className={(!formData.targetOpdId && !isEditing) ? "text-muted-foreground" : ""}>
                    <SelectValue placeholder={formData.targetOpdId || isEditing ? "Pilih lokasi" : "Pilih OPD tujuan terlebih dahulu"} />
                  </SelectTrigger>
                  <SelectContent className="max-h-[200px]">
                    {formData.targetOpdId && availableTargetLocations.length > 0 ? (
                      availableTargetLocations.map((location) => (
                        <SelectItem key={location.id} value={location.id}>
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4" />
                            <span className="text-sm">{location.location_name}</span>
                          </div>
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="no-locations" disabled>
                        Tidak ada lokasi tersedia
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Info jika arah ke Gudang */}
          {formData.direction === 'OPD → Gudang' && (
            <div className="p-3 bg-green-50 rounded-lg border border-green-200">
              <p className="text-sm text-green-800">
                ℹ️ Item akan otomatis masuk ke <strong>Gudang</strong>. Tidak perlu memilih OPD Tujuan dan Lokasi.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Condition */}
            <div className="space-y-2">
              <Label htmlFor="condition">Kondisi Item *</Label>
              <Select 
                value={formData.condition} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, condition: value }))}
              >
                <SelectTrigger className="text-left">
                  <SelectValue placeholder="Pilih kondisi item" />
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

            {/* Diketahui */}
            <div className="space-y-2">
              <Label htmlFor="processedBy">Diketahui *</Label>
              <Input
                id="processedBy"
                value={formData.processedBy}
                onChange={(e) => setFormData(prev => ({ ...prev, processedBy: e.target.value }))}
                placeholder="Nama yang mengetahui"
              />
            </div>
          </div>

          {/* Distribution Date - Only in Edit Mode */}
          {isEditing && (
            <div className="space-y-2">
              <Label htmlFor="transaction_date">Tanggal Distribusi *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !transactionDate && 'text-muted-foreground',
                      dateValidationError && 'border-red-500'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {transactionDate ? format(transactionDate, 'dd/MM/yyyy', { locale: localeId }) : 'Pilih tanggal'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={transactionDate}
                    onSelect={(date) => {
                      if (date) {
                        setTransactionDate(date);
                        setFormData(prev => ({ ...prev, transaction_date: format(date, 'yyyy-MM-dd') }));
                      }
                    }}
                    initialFocus
                    locale={localeId}
                    disabled={(date) => date > new Date()}
                  />
                </PopoverContent>
              </Popover>
              {dateValidationError && (
                <p className="text-sm text-red-500 mt-1">
                  {dateValidationError}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Tanggal tidak boleh lebih lama dari distribusi sebelumnya atau lebih baru dari distribusi setelahnya, dan tidak boleh melebihi hari ini.
              </p>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Catatan Distribusi</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Catatan tambahan tentang distribusi ini..."
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
          <Button 
            type="button" 
            onClick={handleSubmit}
            disabled={isEditing && !!dateValidationError}
          >
            {isEditing ? 'Perbarui' : 'Simpan'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
