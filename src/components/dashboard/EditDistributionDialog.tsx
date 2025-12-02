import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface distribution {
  id: string;
  distribution_code?: string;
  item_id: string;
  item?: {
    id: string;
    serial_number: string;
    name: string;
    category: string;
    brand: string;
    model: string;
    current_location: 'Gudang' | 'OPD';
    current_opd?: { id: string; name: string; };
  };
  direction: 'Gudang → OPD' | 'OPD → Gudang' | 'OPD → OPD';
  source_opd?: { id: string; name: string; };
  target_opd?: { id: string; name: string; };
  specific_location?: string;
  notes?: string;
  distribution_date: string;
  processed_by: string;
  condition?: string;
}

interface OPD {
  id: string;
  name: string;
  description?: string;
  is_active: boolean;
}

interface EditdistributionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: distribution) => void;
  distribution: distribution | null;
  opds: OPD[];
}

interface EditFormData {
  distribution_date: string;
  serial_number: string;
  direction: 'Gudang → OPD' | 'OPD → Gudang' | 'OPD → OPD';
  target_destination: string;
  specific_location: string;
  condition: string;
  processed_by: string;
  notes: string;
}

export default function EditdistributionDialog({
  isOpen,
  onClose,
  onSubmit,
  distribution,
  opds
}: EditdistributionDialogProps) {
  const [formData, setFormData] = useState<EditFormData>({
    distribution_date: '',
    serial_number: '',
    direction: 'Gudang → OPD',
    target_destination: '',
    specific_location: '',
    condition: 'Layak Pakai',
    processed_by: '',
    notes: ''
  });

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Initialize form data when dialog opens
  useEffect(() => {
    if (isOpen && distribution) {
      const date = new Date(distribution.distribution_date);
      // Format date in local timezone to prevent date shift
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const formattedDate = `${year}-${month}-${day}`;
      
      // Determine target destination based on direction
      let targetDestination = '';
      if (distribution.direction === 'Gudang → OPD' || distribution.direction === 'OPD → OPD') {
        targetDestination = distribution.target_opd?.name || '';
      } else if (distribution.direction === 'OPD → Gudang') {
        targetDestination = 'Gudang';
      }

      setFormData({
        distribution_date: formattedDate,
        serial_number: distribution.item?.serial_number || '',
        direction: distribution.direction,
        target_destination: targetDestination,
        specific_location: distribution.specific_location || '',
        condition: distribution.condition || 'Layak Pakai',
        processed_by: distribution.processed_by || 'Admin Gudang',
        notes: distribution.notes || ''
      });
      setValidationErrors({});
    }
  }, [isOpen, distribution]);

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.distribution_date) {
      errors.distribution_date = 'Tanggal wajib diisi';
    }

    if (!formData.serial_number.trim()) {
      errors.serial_number = 'Nomor serial wajib diisi';
    }

    if (!formData.direction) {
      errors.direction = 'Arah wajib dipilih';
    }

    if ((formData.direction === 'Gudang → OPD' || formData.direction === 'OPD → OPD') && !formData.target_destination) {
      errors.target_destination = 'Tujuan wajib dipilih';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = () => {
    if (!validateForm() || !distribution) return;

    // Find target OPD if applicable
    let targetOPD = undefined;
    if (formData.direction === 'Gudang → OPD' || formData.direction === 'OPD → OPD') {
      targetOPD = opds.find(opd => opd.name === formData.target_destination);
    }

    const updateddistribution: distribution = {
      ...distribution,
      distribution_date: new Date(formData.distribution_date).toISOString(),
      item: distribution.item ? {
        ...distribution.item,
        serial_number: formData.serial_number
      } : undefined,
      direction: formData.direction,
      target_opd: targetOPD ? { id: targetOPD.id, name: targetOPD.name } : undefined,
      target_opd_id: targetOPD?.id,
      specific_location: formData.specific_location,
      condition: formData.condition,
      processed_by: formData.processed_by,
      notes: formData.notes
    };

    onSubmit(updateddistribution);
    onClose();
  };

  const handleClose = () => {
    setValidationErrors({});
    onClose();
  };

  const availableDestinations = () => {
    if (formData.direction === 'OPD → Gudang') {
      return [{ id: 'gudang', name: 'Gudang' }];
    }
    return opds.filter(opd => opd.is_active);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Distribusi</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Date Only */}
          <div className="space-y-2">
            <Label htmlFor="date">Tanggal</Label>
            <Input
              type="date"
              value={formData.distribution_date}
              onChange={(e) => setFormData(prev => ({ ...prev, distribution_date: e.target.value }))}
              className={validationErrors.distribution_date ? 'border-red-500' : ''}
            />
            {validationErrors.distribution_date && (
              <p className="text-sm text-red-500">{validationErrors.distribution_date}</p>
            )}
          </div>

          {/* Serial Number */}
          <div className="space-y-2">
            <Label htmlFor="serial">Item (berdasarkan serial number)</Label>
            <Input
              value={formData.serial_number}
              onChange={(e) => setFormData(prev => ({ ...prev, serial_number: e.target.value }))}
              placeholder="contoh: LT-001-2024"
              className={validationErrors.serial_number ? 'border-red-500' : ''}
            />
            {validationErrors.serial_number && (
              <p className="text-sm text-red-500">{validationErrors.serial_number}</p>
            )}
          </div>

          {/* Direction - DISABLED in edit mode */}
          <div className="space-y-2">
            <Label htmlFor="direction">
              Arah Distribusi
              <span className="text-xs text-muted-foreground ml-2">(Tidak dapat diubah)</span>
            </Label>
            
            <Select 
              value={formData.direction} 
              onValueChange={(value) => setFormData(prev => ({ 
                ...prev, 
                direction: value as EditFormData['direction'],
                target_destination: value === 'OPD → Gudang' ? 'Gudang' : ''
              }))}
              disabled={true}
            >
              <SelectTrigger className="bg-muted cursor-not-allowed">
                <SelectValue placeholder="Pilih arah" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Gudang → OPD">Gudang → OPD</SelectItem>
                <SelectItem value="OPD → OPD">OPD → OPD</SelectItem>
                <SelectItem value="OPD → Gudang">OPD → Gudang</SelectItem>
              </SelectContent>
            </Select>
            
            <p className="text-xs text-amber-600">
              ⚠️ Arah distribusi tidak dapat diubah untuk menjaga konsistensi riwayat item
            </p>
          </div>

          {/* Target Destination */}
          <div className="space-y-2">
            <Label htmlFor="target">Ke (tujuan Gudang atau OPD)</Label>
            {formData.direction === 'OPD → Gudang' ? (
              <div className="p-3 rounded-md bg-muted/20 border border-muted">
                <div className="text-sm text-muted-foreground">
                  Gudang
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Otomatis terisi untuk Distribusi OPD → Gudang
                </div>
              </div>
            ) : (
              <Select 
                value={formData.target_destination} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, target_destination: value }))}
              >
                <SelectTrigger className={validationErrors.target_destination ? 'border-red-500' : ''}>
                  <SelectValue placeholder="Pilih tujuan" />
                </SelectTrigger>
                <SelectContent>
                  {availableDestinations().map((dest) => (
                    <SelectItem key={dest.id} value={dest.name}>
                      {dest.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {validationErrors.target_destination && (
              <p className="text-sm text-red-500">{validationErrors.target_destination}</p>
            )}
          </div>

          {/* Location */}
          <div className="space-y-2">
            <Label htmlFor="location">Lokasi</Label>
            <Input
              value={formData.specific_location}
              onChange={(e) => setFormData(prev => ({ ...prev, specific_location: e.target.value }))}
              placeholder="Contoh: Ruang Server, Lantai 2"
            />
          </div>

          {/* Condition */}
          <div className="space-y-2">
            <Label htmlFor="condition">Kondisi</Label>
            <Select 
              value={formData.condition} 
              onValueChange={(value) => setFormData(prev => ({ ...prev, condition: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pilih kondisi" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Layak Pakai">Layak Pakai</SelectItem>
                <SelectItem value="Rusak Ringan">Rusak Ringan</SelectItem>
                <SelectItem value="Rusak/Hilang">Rusak/Hilang</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Processed By */}
          <div className="space-y-2">
            <Label htmlFor="processed_by">Diproses Oleh</Label>
            <Input
              value={formData.processed_by}
              onChange={(e) => setFormData(prev => ({ ...prev, processed_by: e.target.value }))}
              placeholder="Contoh: Admin Gudang, Staff IT"
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Catatan Distribusi</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Catatan tambahan untuk Distribusi ini..."
              rows={3}
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={handleClose}>
            Batal
          </Button>
          <Button 
            type="button"
            onClick={handleSubmit}
            disabled={!formData.direction || !formData.serial_number.trim()}
          >
            Perbarui
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
