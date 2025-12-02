import { ITEM_CONDITIONS, DISTRIBUTION_DIRECTIONS } from '@/constants';
import type { DistributionDirection } from '@/types';

export interface DistributionFormData {
  serial_number: string;
  direction: '' | DistributionDirection;
  target_opd_id: string;
  specific_location: string;
  condition: string;
  distribution_datetime: string;
  processed_by: string;
  notes: string;
}

export function validateDistributionForm(data: DistributionFormData): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!data.serial_number.trim()) {
    errors.serial_number = 'Nomor serial wajib diisi';
  }

  if (!data.direction) {
    errors.direction = 'Arah distribusi wajib dipilih';
  }

  if (data.direction === 'Gudang → OPD' || data.direction === 'OPD → OPD') {
    if (!data.target_opd_id) {
      errors.target_opd_id = 'Tujuan wajib dipilih';
    }
  }

  if (!data.processed_by.trim()) {
    errors.processed_by = 'Nama penanggung jawab wajib diisi';
  }

  return errors;
}

export function isValidCondition(condition: string): condition is (typeof ITEM_CONDITIONS)[number] {
  return (ITEM_CONDITIONS as readonly string[]).includes(condition);
}

export function isValidDirection(direction: string): direction is (typeof DISTRIBUTION_DIRECTIONS)[number] {
  return (DISTRIBUTION_DIRECTIONS as readonly string[]).includes(direction);
}