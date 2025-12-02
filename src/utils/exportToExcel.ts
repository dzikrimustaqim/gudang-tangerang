import * as XLSX from 'xlsx';
import { format } from 'date-fns';

export interface ExportFilters {
  dataType: 'stock' | 'distribution';
  // Stock filters
  filterLocation?: 'all' | 'Gudang' | 'OPD';
  filterCategory?: string; // 'all' or category_id
  filterCondition?: 'all' | 'Layak Pakai' | 'Rusak Ringan' | 'Rusak/Hilang';
  groupBy?: 'none' | 'category' | 'location' | 'condition';
  sortBy?: 'serial' | 'category' | 'date';
  // Distribution filters
  filterDirection?: 'all' | 'Gudang → OPD' | 'OPD → Gudang' | 'OPD → OPD';
  filterPeriod?: 'all' | 'today' | 'week' | 'month' | 'custom';
  customDateRange?: { from: string; to: string };
  // Common
  format?: 'xlsx' | 'csv';
}

export async function exportToExcel(filters: ExportFilters) {
  try {
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    
    if (filters.dataType === 'stock') {
      await exportStockData(filters, baseUrl);
    } else {
      await exportDistributionData(filters, baseUrl);
    }
  } catch (error) {
    console.error('Export error:', error);
    throw new Error('Gagal mengekspor data. Silakan coba lagi.');
  }
}

async function exportStockData(filters: ExportFilters, baseUrl: string) {
  // Fetch items
  const itemsResponse = await fetch(`${baseUrl}/api/items`);
  if (!itemsResponse.ok) throw new Error('Gagal mengambil data stok');
  
  let items = await itemsResponse.json();

  // Apply filters
  if (filters.filterLocation && filters.filterLocation !== 'all') {
    items = items.filter((item: any) => item.current_location === filters.filterLocation);
  }

  if (filters.filterCategory && filters.filterCategory !== 'all') {
    items = items.filter((item: any) => item.category_id === filters.filterCategory);
  }

  if (filters.filterCondition && filters.filterCondition !== 'all') {
    items = items.filter((item: any) => item.condition === filters.filterCondition);
  }

  // Sort data
  if (filters.sortBy === 'serial') {
    items.sort((a: any, b: any) => a.serial_number.localeCompare(b.serial_number));
  } else if (filters.sortBy === 'category') {
    items.sort((a: any, b: any) => a.category.localeCompare(b.category));
  } else if (filters.sortBy === 'date') {
    items.sort((a: any, b: any) => new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime());
  }

  const timestamp = format(new Date(), 'yyyyMMdd_HHmmss');
  const exportFormat = filters.format || 'xlsx';

  // Export based on format
  if (exportFormat === 'csv') {
    exportStockToCSV(items, timestamp);
  } else {
    exportStockToExcel(items, timestamp, filters.groupBy);
  }
}

function exportStockToExcel(items: any[], timestamp: string, groupBy?: string) {
  // Prepare workbook
  const wb = XLSX.utils.book_new();

  if (filters.groupBy && filters.groupBy !== 'none') {
    // Grouped export
    const grouped = groupItems(items, filters.groupBy);
    
    Object.keys(grouped).forEach((groupKey) => {
      const groupItems = grouped[groupKey];
      const sheetData = prepareStockSheetData(groupItems);
      
      // Add subtotal row
      sheetData.push({
        'No.': '' as any,
        'Serial Number': '',
        'Kategori': '',
        'Brand': '',
        'Tipe': '',
        'Kondisi': '',
        'Lokasi': '',
        'OPD': '',
        'Tanggal Masuk': `SUBTOTAL: ${groupItems.length} item`,
        'Keterangan': ''
      });

      const ws = XLSX.utils.json_to_sheet(sheetData);
      
      // Auto-width columns
      const colWidths = [
        { wch: 5 },  // No
        { wch: 20 }, // Serial
        { wch: 15 }, // Kategori
        { wch: 15 }, // Brand
        { wch: 20 }, // Tipe
        { wch: 15 }, // Kondisi
        { wch: 12 }, // Lokasi
        { wch: 25 }, // OPD
        { wch: 15 }, // Tanggal
        { wch: 30 }  // Keterangan
      ];
      ws['!cols'] = colWidths;

      const sheetName = groupKey.substring(0, 31); // Excel sheet name limit
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    });

    // Add summary sheet
    const summaryData = Object.keys(grouped).map((key) => ({
      'Grup': key,
      'Jumlah Item': grouped[key].length
    }));
    const summarySheet = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, summarySheet, 'Ringkasan');

  } else {
    // Flat export
    const sheetData = prepareStockSheetData(items);
    const ws = XLSX.utils.json_to_sheet(sheetData);
    
    // Auto-width columns
    const colWidths = [
      { wch: 5 },  // No
      { wch: 20 }, // Serial
      { wch: 15 }, // Kategori
      { wch: 15 }, // Brand
      { wch: 20 }, // Tipe
      { wch: 15 }, // Kondisi
      { wch: 12 }, // Lokasi
      { wch: 25 }, // OPD
      { wch: 15 }, // Tanggal
      { wch: 30 }  // Keterangan
    ];
    ws['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, 'Data Stok');
  }

  // Generate filename
  const timestamp = format(new Date(), 'yyyyMMdd_HHmmss');
  const filename = `Stok_${timestamp}.xlsx`;

  // Download
  XLSX.writeFile(wb, filename);
}

async function exportDistributionData(filters: ExportFilters, baseUrl: string) {
  // Fetch distributions
  const distributionsResponse = await fetch(`${baseUrl}/api/distributions`);
  if (!distributionsResponse.ok) throw new Error('Gagal mengambil data distribusi');
  
  let distributions = await distributionsResponse.json();

  // Apply filters
  if (filters.filterDirection && filters.filterDirection !== 'all') {
    distributions = distributions.filter((d: any) => d.direction === filters.filterDirection);
  }

  if (filters.filterPeriod && filters.filterPeriod !== 'all') {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    if (filters.filterPeriod === 'today') {
      distributions = distributions.filter((d: any) => {
        const distDate = new Date(d.distribution_date);
        return distDate >= today;
      });
    } else if (filters.filterPeriod === 'week') {
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      distributions = distributions.filter((d: any) => {
        const distDate = new Date(d.distribution_date);
        return distDate >= weekAgo;
      });
    } else if (filters.filterPeriod === 'month') {
      const monthAgo = new Date(today);
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      distributions = distributions.filter((d: any) => {
        const distDate = new Date(d.distribution_date);
        return distDate >= monthAgo;
      });
    } else if (filters.filterPeriod === 'custom' && filters.customDateRange) {
      const from = new Date(filters.customDateRange.from);
      const to = new Date(filters.customDateRange.to);
      to.setHours(23, 59, 59, 999); // Include end date
      
      distributions = distributions.filter((d: any) => {
        const distDate = new Date(d.distribution_date);
        return distDate >= from && distDate <= to;
      });
    }
  }

  // Sort by date (newest first)
  if (filters.sortBy === 'date' || !filters.sortBy) {
    distributions.sort((a: any, b: any) => 
      new Date(b.distribution_date).getTime() - new Date(a.distribution_date).getTime()
    );
  }

  // Prepare data
  const sheetData = distributions.map((d: any, index: number) => {
    let from = '';
    let to = '';

    if (d.direction === 'Gudang → OPD') {
      from = 'Gudang';
      to = d.target_opd?.name || d.destination_location || '-';
    } else if (d.direction === 'OPD → Gudang') {
      from = d.source_opd?.name || '-';
      to = 'Gudang';
    } else if (d.direction === 'OPD → OPD') {
      from = d.source_opd?.name || '-';
      to = d.target_opd?.name || '-';
    }

    return {
      'No.': index + 1,
      'Kode Distribusi': d.distribution_code || '-',
      'Tanggal': format(new Date(d.distribution_date), 'dd/MM/yyyy'),
      'Serial Number': d.item?.serial_number || '-',
      'Nama Barang': d.item?.name || '-',
      'Kategori': d.item?.category || '-',
      'Arah': d.direction,
      'Dari': from,
      'Ke': to,
      'Lokasi Spesifik': d.specific_location || '-',
      'Kondisi': d.item_condition || d.item?.condition || '-',
      'Diproses Oleh': d.processed_by || '-',
      'Catatan': d.notes || '-'
    };
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(sheetData);

  // Auto-width columns
  const colWidths = [
    { wch: 5 },  // No
    { wch: 18 }, // Kode
    { wch: 12 }, // Tanggal
    { wch: 20 }, // Serial
    { wch: 25 }, // Nama
    { wch: 15 }, // Kategori
    { wch: 15 }, // Arah
    { wch: 20 }, // Dari
    { wch: 20 }, // Ke
    { wch: 20 }, // Lokasi
    { wch: 15 }, // Kondisi
    { wch: 20 }, // Diproses
    { wch: 30 }  // Catatan
  ];
  ws['!cols'] = colWidths;

  XLSX.utils.book_append_sheet(wb, ws, 'Data Distribusi');

  // Add summary if grouped
  if (filters.groupBy && filters.groupBy !== 'none') {
    const grouped = groupDistributions(distributions, filters.groupBy);
    const summaryData = Object.keys(grouped).map((key) => ({
      'Grup': key,
      'Jumlah Distribusi': grouped[key].length
    }));
    const summarySheet = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, summarySheet, 'Ringkasan');
  }

  // Generate filename
  const timestamp = format(new Date(), 'yyyyMMdd_HHmmss');
  const filename = `Distribusi_${timestamp}.xlsx`;

  // Download
  XLSX.writeFile(wb, filename);
}

function prepareStockSheetData(items: any[]) {
  return items.map((item, index) => ({
    'No.': index + 1,
    'Serial Number': item.serial_number || '-',
    'Kategori': item.category || '-',
    'Brand': item.brand || '-',
    'Tipe': item.type || '-',
    'Kondisi': item.condition || '-',
    'Lokasi': item.current_location || '-',
    'OPD': item.current_opd?.name || (item.current_location === 'Gudang' ? '-' : 'N/A'),
    'Tanggal Masuk': item.entry_date ? format(new Date(item.entry_date), 'dd/MM/yyyy') : '-',
    'Keterangan': item.description || '-'
  }));
}

function groupItems(items: any[], groupBy: string) {
  const grouped: Record<string, any[]> = {};

  items.forEach((item) => {
    let key = '';
    
    if (groupBy === 'category') {
      key = item.category || 'Tanpa Kategori';
    } else if (groupBy === 'location') {
      if (item.current_location === 'Gudang') {
        key = 'Gudang';
      } else {
        key = item.current_opd?.name || 'OPD Tidak Diketahui';
      }
    } else if (groupBy === 'condition') {
      key = item.condition || 'Tidak Diketahui';
    }

    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push(item);
  });

  return grouped;
}

function groupDistributions(distributions: any[], groupBy: string) {
  const grouped: Record<string, any[]> = {};

  distributions.forEach((dist) => {
    let key = '';
    
    if (groupBy === 'category') {
      key = dist.item?.category || 'Tanpa Kategori';
    } else if (groupBy === 'location') {
      key = dist.direction;
    } else if (groupBy === 'condition') {
      key = dist.item_condition || dist.item?.condition || 'Tidak Diketahui';
    }

    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push(dist);
  });

  return grouped;
}
