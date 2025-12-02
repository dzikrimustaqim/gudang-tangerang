import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { ITEM_CONDITIONS, DISTRIBUTION_DIRECTIONS } from '@/constants';
import type { OPD, DistributionDirection } from '@/types';
import type { DistributionFormData } from '@/utils/validation';

interface DistributionFormFieldsProps {
  formData: DistributionFormData;
  errors: Record<string, string>;
  opds: OPD[];
  isEditing?: boolean;
  onChange: (field: keyof DistributionFormData, value: string) => void;
  existingDistributionCode?: string;
}

export function DistributionFormFields({
  formData,
  errors,
  opds,
  isEditing = false,
  onChange,
  existingDistributionCode
}: DistributionFormFieldsProps) {
  const availableOPDs = opds.filter(opd => opd.is_active);

  return (
    <div className="space-y-4">
      {/* Code and Serial Number - Side by side when editing */}
      {isEditing ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Distribution Code */}
          <div className="space-y-2">
            <Label htmlFor="code">Kode</Label>
            <Input
              value={existingDistributionCode || `DST-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 999) + 1).padStart(3, '0')}`}
              readOnly
              className="bg-muted/50 border-muted text-muted-foreground cursor-not-allowed font-mono"
            />
          </div>
          
          {/* Serial Number */}
          <div className="space-y-2">
            <Label htmlFor="serial">Nomor Serial</Label>
            <Input
              value={formData.serial_number}
              readOnly
              className="bg-muted/50 border-muted text-muted-foreground cursor-not-allowed font-mono"
            />
            {errors.serial_number && (
              <p className="text-sm text-red-500">{errors.serial_number}</p>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="serial">Nomor Serial</Label>
          <Input
            value={formData.serial_number}
            onChange={(e) => onChange('serial_number', e.target.value)}
            placeholder="contoh: LT-001-2024"
            className={errors.serial_number ? 'border-red-500' : ''}
          />
          {errors.serial_number && (
            <p className="text-sm text-red-500">{errors.serial_number}</p>
          )}
        </div>
      )}

      {/* Date - Only for editing */}
      {isEditing && (
        <div className="space-y-2">
          <Label htmlFor="date">Tanggal</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'w-full justify-start text-left font-normal',
                  !formData.distribution_datetime && 'text-muted-foreground'
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {formData.distribution_datetime 
                  ? format(new Date(formData.distribution_datetime), 'dd/MM/yyyy', { locale: localeId })
                  : 'Pilih tanggal'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={formData.distribution_datetime ? new Date(formData.distribution_datetime) : undefined}
                onSelect={(date) => {
                  if (date) {
                    onChange('distribution_datetime', format(date, 'yyyy-MM-dd'));
                  }
                }}
                initialFocus
                locale={localeId}
                disabled={(date) => date > new Date()}
              />
            </PopoverContent>
          </Popover>
        </div>
      )}

      {/* Direction */}
      <div className="space-y-2">
        <Label htmlFor="direction">Jenis Distribusi</Label>
        <Select 
          value={formData.direction} 
          onValueChange={(value) => {
            onChange('direction', value);
            onChange('target_opd_id', '');
            onChange('specific_location', value === 'OPD → Gudang' ? 'Gudang' : '');
          }}
        >
          <SelectTrigger className={errors.direction ? 'border-red-500' : ''}>
            <SelectValue placeholder="Pilih jenis distribusi" />
          </SelectTrigger>
          <SelectContent>
            {DISTRIBUTION_DIRECTIONS.map((direction) => (
              <SelectItem key={direction} value={direction}>
                {direction}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.direction && (
          <p className="text-sm text-red-500">{errors.direction}</p>
        )}
      </div>

      {/* Target */}
      <div className="space-y-2">
        <Label htmlFor="target">Tujuan</Label>
        {formData.direction === 'OPD → Gudang' ? (
          <div className="p-3 rounded-md bg-muted/20 border border-muted">
            <div className="text-sm text-muted-foreground">Gudang</div>
            <div className="text-xs text-muted-foreground mt-1">
              Otomatis terisi untuk distribusi OPD → Gudang
            </div>
          </div>
        ) : (
          <Select 
            value={formData.target_opd_id} 
            onValueChange={(value) => onChange('target_opd_id', value)}
          >
            <SelectTrigger className={errors.target_opd_id ? 'border-red-500' : ''}>
              <SelectValue placeholder="Pilih tujuan" />
            </SelectTrigger>
            <SelectContent>
              {availableOPDs.map((opd) => (
                <SelectItem key={opd.id} value={opd.id}>
                  {opd.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {errors.target_opd_id && (
          <p className="text-sm text-red-500">{errors.target_opd_id}</p>
        )}
      </div>

      {/* Location */}
      <div className="space-y-2">
        <Label htmlFor="location">Lokasi</Label>
        {formData.direction === 'OPD → Gudang' ? (
          <div className="p-3 rounded-md bg-muted/20 border border-muted">
            <div className="text-sm text-muted-foreground">Gudang</div>
            <div className="text-xs text-muted-foreground mt-1">
              Otomatis terisi untuk pengembalian ke gudang
            </div>
          </div>
        ) : (
          <Input
            value={formData.specific_location}
            onChange={(e) => onChange('specific_location', e.target.value)}
            placeholder="Contoh: Ruang Server, Ruang Admin"
          />
        )}
      </div>

      {/* Condition */}
      <div className="space-y-2">
        <Label htmlFor="condition">Kondisi</Label>
        <Select 
          value={formData.condition} 
          onValueChange={(value) => onChange('condition', value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Pilih kondisi" />
          </SelectTrigger>
          <SelectContent>
            {ITEM_CONDITIONS.map((condition) => (
              <SelectItem key={condition} value={condition}>
                {condition}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Processed By */}
      <div className="space-y-2">
        <Label htmlFor="processed_by">Diproses Oleh</Label>
        <Input
          value={formData.processed_by}
          onChange={(e) => onChange('processed_by', e.target.value)}
          placeholder="Contoh: Admin Gudang, Staff IT"
          className={errors.processed_by ? 'border-red-500' : ''}
        />
        {errors.processed_by && (
          <p className="text-sm text-red-500">{errors.processed_by}</p>
        )}
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <Label htmlFor="notes">Catatan Distribusi</Label>
        <Textarea
          value={formData.notes}
          onChange={(e) => onChange('notes', e.target.value)}
          placeholder="Catatan tambahan untuk distribusi ini..."
          rows={3}
        />
      </div>
    </div>
  );
}
