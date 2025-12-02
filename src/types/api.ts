export interface Item {
  id: string;
  serial_number: string;
  category_id: string;
  category: Category;
  brand: string;
  type: string;
  condition: 'Layak Pakai' | 'Rusak Ringan' | 'Rusak/Hilang';
  description?: string;
  entry_date?: string;
  exit_date?: string;
  current_location: 'Gudang' | 'OPD';
  current_opd_id?: string;
  current_opd?: OPD;
  specific_location?: string;
  is_active: boolean;
  distributions?: Distribution[];
  created_at: string;
  updated_at: string;
}

export interface Distribution {
  distribution_code: string;
  item_id: string;
  item?: Item;
  direction: 'Gudang → OPD' | 'OPD → Gudang' | 'OPD → OPD';
  source_opd_id?: string;
  source_opd?: OPD;
  source_location?: string;
  target_opd_id?: string;
  target_opd?: OPD;
  specific_location?: string;
  notes?: string;
  distribution_date: string;
  processed_by?: string;
  condition?: 'Layak Pakai' | 'Rusak Ringan' | 'Rusak/Hilang';
  item_condition?: 'Layak Pakai' | 'Rusak Ringan' | 'Rusak/Hilang';
  sourceLocation?: {
    id: string;
    location_name: string;
    opd_id: string;
  };
  location?: {
    id: string;
    location_name: string;
  };
  created_at: string;
  updated_at: string;
}

export interface OPD {
  id: string;
  name: string;
  description?: string;
  pic?: string;
  address?: string;
  phone?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface OPDLocation {
  id: string;
  opd_id: string;
  location_name: string;
  description?: string;
  pic?: string;
  contact?: string;
  bandwidth?: string;
  address?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Brand {
  id: string;
  category_id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Type {
  id: string;
  brand_id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateItemRequest {
  serial_number: string;
  category_id: string;
  brand: string;
  type: string;
  condition: 'Layak Pakai' | 'Rusak Ringan' | 'Rusak/Hilang';
  description?: string;
  specific_location?: string;
}

export interface CreateDistributionRequest {
  item_id: string;
  direction: 'Gudang → OPD' | 'OPD → Gudang' | 'OPD → OPD';
  source_opd_id?: string;
  source_location?: string;
  target_opd_id?: string;
  specific_location?: string;
  notes?: string;
  processed_by?: string;
  distribution_date?: string;
  item_condition?: string;
}

export interface CreateOPDRequest {
  name: string;
  description?: string;
  pic?: string;
  address?: string;
  phone?: string;
}

export interface CreateOPDLocationRequest {
  location_name: string;
  description?: string;
  pic?: string;
  contact?: string;
  bandwidth?: string;
  address?: string;
}

export interface CreateCategoryRequest {
  name: string;
}

export interface CreateBrandRequest {
  category_id: string;
  name: string;
}

export interface CreateTypeRequest {
  brand_id: string;
  name: string;
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

export interface PaginatedResponse<T> {
  data: T[];
  total_count: number;
  page: number;
  limit: number;
  total_pages: number;
}
