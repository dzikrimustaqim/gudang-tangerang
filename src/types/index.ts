// Common types for the warehouse management system
export interface Category {
  id: string;
  name: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Item {
  id: string;
  serial_number: string;
  name?: string;
  category_id: string;
  category: Category | string;
  brand: string;
  type: string;
  condition: 'Layak Pakai' | 'Rusak Ringan' | 'Rusak/Hilang';
  latest_condition?: 'Layak Pakai' | 'Rusak Ringan' | 'Rusak/Hilang'; // Kondisi terbaru dari riwayat distribusi
  latest_direction?: 'Gudang → OPD' | 'OPD → Gudang' | 'OPD → OPD'; // Arah transaksi terakhir
  latest_opd_id?: string; // OPD terbaru dari riwayat distribusi
  latest_opd?: OPD; // Data OPD terbaru
  latest_specific_location?: string; // Lokasi spesifik terbaru
  latest_location?: OPDLocation; // Data lokasi terbaru
  description?: string;
  entry_date?: string;
  exit_date?: string;
  current_location: 'Gudang' | 'OPD';
  current_opd_id?: string;
  current_opd?: OPD;
  specific_location?: string;
  location?: OPDLocation;
  is_active?: boolean;
}

export interface OPD {
  id: string;
  name: string;
  description?: string;
  pic?: string;
  address?: string;
  phone?: string;
  is_active: boolean;
}

export interface OPDLocation {
  id: string;
  opd_id: string;
  location_name: string;
  description?: string;
  pic?: string;
  contact?: string;
  link?: string;
  address?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Distribution {
  distribution_code: string;
  item_id: string;
  item?: Item;
  direction: 'Gudang → OPD' | 'OPD → Gudang' | 'OPD → OPD';
  source_opd_id?: string;
  source_opd?: OPD;
  source_location?: string;
  sourceLocation?: OPDLocation;
  target_opd_id?: string;
  target_opd?: OPD;
  specific_location?: string;
  location?: OPDLocation;
  notes?: string;
  distribution_date: string;
  processed_by: string;
  condition?: string;
}

export interface DashboardSummary {
  total_items: number;
  items_in_warehouse: number;
  items_in_opd: number;
  total_distributions: number;
  items_by_condition: Record<string, number>;
  items_by_category: Array<{ category_name: string; count: number }>;
  items_by_opd: Array<{ opd_name: string; count: number }>;
}

export type DistributionDirection = Distribution['direction'];
export type ItemCondition = 'Layak Pakai' | 'Rusak Ringan' | 'Rusak/Hilang';
export type ItemLocation = 'Gudang' | 'OPD';
