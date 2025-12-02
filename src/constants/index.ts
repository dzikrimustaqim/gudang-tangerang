import { ItemCondition, DistributionDirection } from '@/types';

// App constants
export const APP_CONFIG = {
  name: 'Gudang Tangerang',
  version: '1.0.0',
  queryClientRetries: 1,
  refetchOnWindowFocus: false,
} as const;

// Warehouse constants - MUST match backend constants
export const WAREHOUSE_LOCATION = 'Gudang';

export const DIRECTION = {
  WAREHOUSE_TO_OPD: 'Gudang → OPD',
  OPD_TO_OPD: 'OPD → OPD',
  OPD_TO_WAREHOUSE: 'OPD → Gudang'
} as const;

export type DirectionType = typeof DIRECTION[keyof typeof DIRECTION];

// Item conditions
export const ITEM_CONDITIONS: ItemCondition[] = [
  'Layak Pakai',
  'Rusak Ringan', 
  'Rusak/Hilang'
] as const;

// Distribution directions
export const DISTRIBUTION_DIRECTIONS: DistributionDirection[] = [
  'Gudang → OPD',
  'OPD → Gudang',
  'OPD → OPD'
] as const;

// Dashboard tab configuration
export const DASHBOARD_TABS = [
  { id: 'overview', label: 'Ringkasan', icon: 'TrendingUp' },
  { id: 'stock', label: 'Stok', icon: 'Package' },
  { id: 'transactions', label: 'Distribusi', icon: 'ArrowRightLeft' },
  { id: 'master', label: 'Data Master', icon: 'Building2' },
  { id: 'reset', label: 'Reset', icon: 'Trash2' }
] as const;

// Color schemes for cards
export const CARD_COLORS = {
  blue: {
    gradient: 'from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900',
    text: 'text-blue-700 dark:text-blue-300',
    icon: 'text-blue-600 dark:text-blue-400',
    value: 'text-blue-900 dark:text-blue-100',
    subtitle: 'text-blue-600 dark:text-blue-400'
  },
  emerald: {
    gradient: 'from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900',
    text: 'text-emerald-700 dark:text-emerald-300',
    icon: 'text-emerald-600 dark:text-emerald-400',
    value: 'text-emerald-900 dark:text-emerald-100',
    subtitle: 'text-emerald-600 dark:text-emerald-400'
  },
  purple: {
    gradient: 'from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900',
    text: 'text-purple-700 dark:text-purple-300',
    icon: 'text-purple-600 dark:text-purple-400',
    value: 'text-purple-900 dark:text-purple-100',
    subtitle: 'text-purple-600 dark:text-purple-400'
  },
  amber: {
    gradient: 'from-amber-50 to-amber-100 dark:from-amber-950 dark:to-amber-900',
    text: 'text-amber-700 dark:text-amber-300',
    icon: 'text-amber-600 dark:text-amber-400',
    value: 'text-amber-900 dark:text-amber-100',
    subtitle: 'text-amber-600 dark:text-amber-400'
  }
} as const;

// Mock data constants
export const MOCK_DASHBOARD_DATA = {
  summary: {
    total_items: 1250,
    items_in_warehouse: 450,
    items_in_opd: 800,
    total_transactions: 2340,
    items_by_condition: {
      "Layak Pakai": 950,
      "Rusak Ringan": 200,
      "Rusak/Hilang": 100
    },
    items_by_category: [
      { category_name: "Laptop", count: 320 },
      { category_name: "Printer", count: 180 },
      { category_name: "Router", count: 150 },
      { category_name: "Switch", count: 120 },
      { category_name: "CCTV", count: 480 }
    ],
    items_by_opd: [
      { opd_name: "Diskominfo", count: 280 },
      { opd_name: "Dinas Kesehatan", count: 320 },
      { opd_name: "Dinas Pendidikan", count: 200 }
    ]
  },
  recentDistributions: [
    { id: 1, item: "Dell Latitude 5520", direction: "Gudang → OPD" as DistributionDirection, opd: "Diskominfo", date: "2025-01-20" },
    { id: 2, item: "HP LaserJet Pro", direction: "OPD → Gudang" as DistributionDirection, opd: "Dinas Kesehatan", date: "2025-01-20" },
    { id: 3, item: "Cisco Switch 24P", direction: "OPD → OPD" as DistributionDirection, opd: "Dinas Pendidikan", date: "2025-01-19" },
  ]
} as const;

// Helper functions for warehouse logic
export const isInWarehouse = (latestDirection: string | null): boolean => {
  return latestDirection === DIRECTION.OPD_TO_WAREHOUSE || !latestDirection;
};

export const isInOPD = (latestDirection: string | null): boolean => {
  return latestDirection === DIRECTION.WAREHOUSE_TO_OPD || 
         latestDirection === DIRECTION.OPD_TO_OPD;
};

export const getLocationDisplay = (
  latestDirection: string | null, 
  latestOpd: { name: string } | null,
  latestSpecificLocation: string | null
): string => {
  if (isInWarehouse(latestDirection)) {
    return WAREHOUSE_LOCATION;
  }
  
  if (isInOPD(latestDirection) && latestOpd && latestSpecificLocation) {
    return `${latestOpd.name} - ${latestSpecificLocation}`;
  }
  
  return '-';
};