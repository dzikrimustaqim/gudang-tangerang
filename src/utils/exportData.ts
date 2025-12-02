import * as XLSX from 'xlsx';
import { format } from 'date-fns';

export interface ExportFilters {
  dataType: 'stock' | 'distribution';
  // Stock filters
  filterLocation?: 'all' | 'Gudang' | 'OPD';
  filterCategory?: string; // 'all' or category_id
  filterCondition?: 'all' | 'Layak Pakai' | 'Rusak Ringan' | 'Rusak/Hilang';
  groupBy?: 'none' | 'category' | 'location' | 'condition';
  // Distribution filters
  filterDirection?: 'all' | 'Gudang → OPD' | 'OPD → Gudang' | 'OPD → OPD';
  filterPeriod?: 'all' | 'today' | 'week' | 'month' | 'custom';
  customDateRange?: { from: string; to: string };
  sortByDist?: 'newest' | 'oldest';
  // Common
  format?: 'xlsx' | 'csv';
}

export async function exportData(filters: ExportFilters) {
  try {
    // Use relative path since we're accessing from same origin through nginx
    const baseUrl = '';
    
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
  // Fetch all items (no pagination)
  const itemsResponse = await fetch(`${baseUrl}/api/v1/items`);
  if (!itemsResponse.ok) throw new Error('Gagal mengambil data stok');
  
  const itemsData = await itemsResponse.json();
  let items = itemsData.data || itemsData; // Handle both paginated and non-paginated response

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

  // Sort by entry_date descending (newest first)
  items.sort((a: any, b: any) => new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime());

  const timestamp = format(new Date(), 'yyyyMMdd_HHmmss');
  const exportFormat = filters.format || 'xlsx';

  // Export based on format
  if (exportFormat === 'csv') {
    exportStockToCSV(items, timestamp, filters.groupBy);
  } else {
    exportStockToExcel(items, timestamp, filters.groupBy);
  }
}

function exportStockToExcel(items: any[], timestamp: string, groupBy?: string) {
  const wb = XLSX.utils.book_new();

  if (groupBy && groupBy !== 'none') {
    // Grouped export - multiple sheets
    const grouped = groupItems(items, groupBy);
    
    // Custom sort based on groupBy type
    const sortedKeys = Object.keys(grouped).sort((a, b) => {
      if (groupBy === 'location') {
        // Gudang always first for location grouping
        if (a === 'Gudang') return -1;
        if (b === 'Gudang') return 1;
        return a.localeCompare(b);
      } else if (groupBy === 'condition') {
        // Custom order for condition: Layak Pakai, Rusak Ringan, Rusak/Hilang
        const conditionOrder: Record<string, number> = {
          'Layak Pakai': 1,
          'Rusak Ringan': 2,
          'Rusak/Hilang': 3
        };
        const orderA = conditionOrder[a] || 999;
        const orderB = conditionOrder[b] || 999;
        return orderA - orderB;
      } else {
        // Alphabetical for category and others
        return a.localeCompare(b);
      }
    });
    
    sortedKeys.forEach((groupKey) => {
      const groupItems = grouped[groupKey];
      const sheetData = prepareStockSheetData(groupItems);
      
      // Add subtotal row
      sheetData.push({
        'No.': '' as any,
        'Serial Number': '',
        'Kategori': '',
        'Merek': '',
        'Tipe': '',
        'Kondisi': '',
        'Lokasi': '',
        'OPD': '',
        'Tanggal Masuk': `SUBTOTAL: ${groupItems.length} item`,
        'Keterangan': ''
      });

      const ws = XLSX.utils.json_to_sheet(sheetData);
      const colWidths = [
        { wch: 5 },   // No.
        { wch: 18 },  // Serial Number
        { wch: 18 },  // Kategori
        { wch: 15 },  // Merek
        { wch: 15 },  // Tipe
        { wch: 13 },  // Kondisi
        { wch: 10 },  // Lokasi
        { wch: 30 },  // OPD
        { wch: 13 },  // Tanggal Masuk
        { wch: 35 }   // Keterangan
      ];
      ws['!cols'] = colWidths;
      
      // Add text wrapping for better readability
      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
      for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
          if (!ws[cellAddress]) continue;
          if (!ws[cellAddress].s) ws[cellAddress].s = {};
          ws[cellAddress].s.alignment = { wrapText: true, vertical: 'top' };
        }
      }

      // Sanitize sheet name - remove illegal characters for Excel
      const sheetName = groupKey.replace(/[:\\/?*\[\]]/g, '-').substring(0, 31);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    });

    // Add summary sheet (with same custom sort)
    const summaryData = Object.keys(grouped).sort((a, b) => {
      if (groupBy === 'location') {
        if (a === 'Gudang') return -1;
        if (b === 'Gudang') return 1;
        return a.localeCompare(b);
      } else if (groupBy === 'condition') {
        const conditionOrder: Record<string, number> = {
          'Layak Pakai': 1,
          'Rusak Ringan': 2,
          'Rusak/Hilang': 3
        };
        const orderA = conditionOrder[a] || 999;
        const orderB = conditionOrder[b] || 999;
        return orderA - orderB;
      } else {
        return a.localeCompare(b);
      }
    }).map((key) => ({
      'Grup': key,
      'Jumlah Item': grouped[key].length
    }));
    const summarySheet = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, summarySheet, 'Ringkasan');
  } else {
    // Flat export
    const sheetData = prepareStockSheetData(items);
    const ws = XLSX.utils.json_to_sheet(sheetData);
    
    const colWidths = [
      { wch: 5 },   // No.
      { wch: 18 },  // Serial Number
      { wch: 18 },  // Kategori
      { wch: 15 },  // Merek
      { wch: 15 },  // Tipe
      { wch: 13 },  // Kondisi
      { wch: 10 },  // Lokasi
      { wch: 30 },  // OPD
      { wch: 13 },  // Tanggal Masuk
      { wch: 35 }   // Keterangan
    ];
    ws['!cols'] = colWidths;
    
    // Add text wrapping for better readability
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    for (let R = range.s.r; R <= range.e.r; ++R) {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
        if (!ws[cellAddress]) continue;
        if (!ws[cellAddress].s) ws[cellAddress].s = {};
        ws[cellAddress].s.alignment = { wrapText: true, vertical: 'top' };
      }
    }

    XLSX.utils.book_append_sheet(wb, ws, 'Data Stok');
  }

  const filename = `Stok_${timestamp}.xlsx`;
  XLSX.writeFile(wb, filename);
}

function exportStockToCSV(items: any[], timestamp: string, groupBy?: string) {
  if (groupBy && groupBy !== 'none') {
    // Grouped CSV - add group headers
    const grouped = groupItems(items, groupBy);
    const sortedKeys = Object.keys(grouped).sort((a, b) => {
      if (groupBy === 'location') {
        if (a === 'Gudang') return -1;
        if (b === 'Gudang') return 1;
        return a.localeCompare(b);
      } else if (groupBy === 'condition') {
        const conditionOrder: Record<string, number> = {
          'Layak Pakai': 1,
          'Rusak Ringan': 2,
          'Rusak/Hilang': 3
        };
        return (conditionOrder[a] || 999) - (conditionOrder[b] || 999);
      }
      return a.localeCompare(b);
    });

    const allData: any[] = [];
    sortedKeys.forEach((key) => {
      // Add group header
      allData.push({ 'No.': `=== ${key} ===`, 'Serial Number': '', 'Kategori': '', 'Merek': '', 'Tipe': '', 'Kondisi': '', 'Lokasi': '', 'OPD': '', 'Tanggal Masuk': '', 'Keterangan': '' });
      // Add group data
      const groupData = prepareStockSheetData(grouped[key]);
      allData.push(...groupData);
      // Add subtotal
      allData.push({ 'No.': '', 'Serial Number': '', 'Kategori': '', 'Merek': '', 'Tipe': '', 'Kondisi': '', 'Lokasi': '', 'OPD': '', 'Tanggal Masuk': `SUBTOTAL: ${grouped[key].length} item`, 'Keterangan': '' });
      // Add empty row
      allData.push({ 'No.': '', 'Serial Number': '', 'Kategori': '', 'Merek': '', 'Tipe': '', 'Kondisi': '', 'Lokasi': '', 'OPD': '', 'Tanggal Masuk': '', 'Keterangan': '' });
    });

    const ws = XLSX.utils.json_to_sheet(allData);
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Stok_Grouped_${timestamp}.csv`;
    link.click();
  } else {
    // Flat CSV
    const sheetData = prepareStockSheetData(items);
    const ws = XLSX.utils.json_to_sheet(sheetData);
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Stok_${timestamp}.csv`;
    link.click();
  }
}



async function exportDistributionData(filters: ExportFilters, baseUrl: string) {
  // Fetch all distributions (no pagination)
  const distributionsResponse = await fetch(`${baseUrl}/api/v1/distributions`);
  if (!distributionsResponse.ok) throw new Error('Gagal mengambil data distribusi');
  
  const distributionsData = await distributionsResponse.json();
  let distributions = distributionsData.data || distributionsData; // Handle both paginated and non-paginated response

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
      to.setHours(23, 59, 59, 999);
      
      distributions = distributions.filter((d: any) => {
        const distDate = new Date(d.distribution_date);
        return distDate >= from && distDate <= to;
      });
    }
  }

  // Sort by distribution_date (newest or oldest based on filter)
  const sortOrder = filters.sortByDist || 'newest';
  if (sortOrder === 'newest') {
    distributions.sort((a: any, b: any) => new Date(b.distribution_date).getTime() - new Date(a.distribution_date).getTime());
  } else {
    distributions.sort((a: any, b: any) => new Date(a.distribution_date).getTime() - new Date(b.distribution_date).getTime());
  }

  const timestamp = format(new Date(), 'yyyyMMdd_HHmmss');
  const exportFormat = filters.format || 'xlsx';

  // Export based on format
  if (exportFormat === 'csv') {
    exportDistributionToCSV(distributions, timestamp, filters.groupBy);
  } else {
    exportDistributionToExcel(distributions, timestamp, filters.groupBy);
  }
}

function exportDistributionToExcel(distributions: any[], timestamp: string, groupBy?: string) {
  const wb = XLSX.utils.book_new();

  if (groupBy && groupBy !== 'none') {
    // Grouped export - multiple sheets
    const grouped = groupDistributions(distributions, groupBy);
    
    // Custom sort based on groupBy type
    const sortedKeys = Object.keys(grouped).sort((a, b) => {
      if (groupBy === 'location') {
        // For location grouping in distributions, use alphabetical (no Gudang sheet)
        return a.localeCompare(b);
      } else if (groupBy === 'condition') {
        // Custom order for condition: Layak Pakai, Rusak Ringan, Rusak/Hilang
        const conditionOrder: Record<string, number> = {
          'Layak Pakai': 1,
          'Rusak Ringan': 2,
          'Rusak/Hilang': 3
        };
        const orderA = conditionOrder[a] || 999;
        const orderB = conditionOrder[b] || 999;
        return orderA - orderB;
      } else {
        // Alphabetical for category and others
        return a.localeCompare(b);
      }
    });
    
    sortedKeys.forEach((groupKey) => {
      const groupDists = grouped[groupKey];
      const sheetData = prepareDistributionSheetData(groupDists);
      
      // Add subtotal row (updated columns: Kategori before Merek, removed Dari/Ke, added Diketahui)
      sheetData.push({
        'No.': '' as any,
        'Kode Distribusi': '',
        'Tanggal': '',
        'Serial Number': '',
        'Kategori': '',
        'Merek': '',
        'Tipe': '',
        'Arah': '',
        'Kondisi': '',
        'Diketahui': `SUBTOTAL: ${groupDists.length} distribusi`,
        'Lokasi Spesifik': '',
        'Diproses Oleh': '',
        'Catatan': ''
      });

      const ws = XLSX.utils.json_to_sheet(sheetData);
      const colWidths = [
        { wch: 5 },   // No.
        { wch: 18 },  // Kode Distribusi
        { wch: 12 },  // Tanggal
        { wch: 18 },  // Serial Number
        { wch: 15 },  // Kategori
        { wch: 20 },  // Merek
        { wch: 20 },  // Tipe
        { wch: 20 },  // Arah
        { wch: 12 },  // Kondisi
        { wch: 25 },  // Diketahui
        { wch: 30 },  // Lokasi Spesifik
        { wch: 20 },  // Diproses Oleh
        { wch: 50 }   // Catatan
      ];
      ws['!cols'] = colWidths;

      // Add text wrapping for all cells
      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
      for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
          if (!ws[cellAddress]) continue;
          if (!ws[cellAddress].s) ws[cellAddress].s = {};
          ws[cellAddress].s.alignment = { wrapText: true, vertical: 'top' };
        }
      }

      // Sanitize sheet name - remove illegal characters for Excel
      const sheetName = groupKey.replace(/[:\\\\/?*\[\]]/g, '-').substring(0, 31);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    });

    // Add summary sheet (with same custom sort)
    const summaryData = Object.keys(grouped).sort((a, b) => {
      if (groupBy === 'location') {
        return a.localeCompare(b);
      } else if (groupBy === 'condition') {
        const conditionOrder: Record<string, number> = {
          'Layak Pakai': 1,
          'Rusak Ringan': 2,
          'Rusak/Hilang': 3
        };
        const orderA = conditionOrder[a] || 999;
        const orderB = conditionOrder[b] || 999;
        return orderA - orderB;
      } else {
        return a.localeCompare(b);
      }
    }).map((key) => ({
      'Grup': key,
      'Jumlah Distribusi': grouped[key].length
    }));
    const summarySheet = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, summarySheet, 'Ringkasan');
  } else {
    // Flat export
    const sheetData = prepareDistributionSheetData(distributions);
    const ws = XLSX.utils.json_to_sheet(sheetData);

    const colWidths = [
      { wch: 4 },   // No.
      { wch: 16 },  // Kode Distribusi
      { wch: 11 },  // Tanggal
      { wch: 16 },  // Serial Number
      { wch: 18 },  // Kategori
      { wch: 15 },  // Merek
      { wch: 15 },  // Tipe
      { wch: 20 },  // Arah
      { wch: 12 },  // Kondisi
      { wch: 20 },  // Diketahui
      { wch: 25 },  // Lokasi Spesifik
      { wch: 18 },  // Diproses Oleh
      { wch: 40 }   // Catatan
    ];
    ws['!cols'] = colWidths;

    // Add text wrapping for all cells
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    for (let R = range.s.r; R <= range.e.r; ++R) {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
        if (!ws[cellAddress]) continue;
        if (!ws[cellAddress].s) ws[cellAddress].s = {};
        ws[cellAddress].s.alignment = { wrapText: true, vertical: 'top' };
      }
    }

    XLSX.utils.book_append_sheet(wb, ws, 'Data Distribusi');
  }

  const filename = `Distribusi_${timestamp}.xlsx`;
  XLSX.writeFile(wb, filename);
}

function exportDistributionToCSV(distributions: any[], timestamp: string, groupBy?: string) {
  if (groupBy && groupBy !== 'none') {
    // Grouped CSV
    const grouped = groupDistributions(distributions, groupBy);
    const sortedKeys = Object.keys(grouped).sort((a, b) => {
      if (groupBy === 'location') {
        return a.localeCompare(b);
      } else if (groupBy === 'condition') {
        const conditionOrder: Record<string, number> = {
          'Layak Pakai': 1,
          'Rusak Ringan': 2,
          'Rusak/Hilang': 3
        };
        return (conditionOrder[a] || 999) - (conditionOrder[b] || 999);
      }
      return a.localeCompare(b);
    });

    const allData: any[] = [];
    sortedKeys.forEach((key) => {
      // Add group header (updated columns)
      allData.push({ 'No.': `=== ${key} ===`, 'Kode Distribusi': '', 'Tanggal': '', 'Serial Number': '', 'Kategori': '', 'Merek': '', 'Tipe': '', 'Arah': '', 'Kondisi': '', 'Diketahui': '', 'Lokasi Spesifik': '', 'Diproses Oleh': '', 'Catatan': '' });
      // Add group data
      const groupData = prepareDistributionSheetData(grouped[key]);
      allData.push(...groupData);
      // Add subtotal
      allData.push({ 'No.': '', 'Kode Distribusi': '', 'Tanggal': '', 'Serial Number': '', 'Kategori': '', 'Merek': '', 'Tipe': '', 'Arah': '', 'Kondisi': '', 'Diketahui': `SUBTOTAL: ${grouped[key].length} distribusi`, 'Lokasi Spesifik': '', 'Diproses Oleh': '', 'Catatan': '' });
      // Add empty row
      allData.push({ 'No.': '', 'Kode Distribusi': '', 'Tanggal': '', 'Serial Number': '', 'Kategori': '', 'Merek': '', 'Tipe': '', 'Arah': '', 'Kondisi': '', 'Diketahui': '', 'Lokasi Spesifik': '', 'Diproses Oleh': '', 'Catatan': '' });
    });

    const ws = XLSX.utils.json_to_sheet(allData);
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Distribusi_Grouped_${timestamp}.csv`;
    link.click();
  } else {
    // Flat CSV
    const sheetData = prepareDistributionSheetData(distributions);
    const ws = XLSX.utils.json_to_sheet(sheetData);
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Distribusi_${timestamp}.csv`;
    link.click();
  }
}



function prepareStockSheetData(items: any[]) {
  return items.map((item: any, index: number) => {
    let entryDate = '-';
    try {
      if (item.entry_date) {
        entryDate = format(new Date(item.entry_date), 'dd/MM/yyyy');
      }
    } catch (error) {
      entryDate = '-';
    }
    
    return {
      'No.': index + 1,
      'Serial Number': item.serial_number || '-',
      'Kategori': typeof item.category === 'object' ? item.category?.name : item.category || '-',
      'Merek': item.brand || '-',
      'Tipe': item.type || '-',
      'Kondisi': item.condition || '-',
      'Lokasi': item.current_location || '-',
      'OPD': item.current_opd?.name || (item.current_location === 'Gudang' ? '-' : 'N/A'),
      'Tanggal Masuk': entryDate,
      'Keterangan': item.description || '-'
    };
  });
}

function prepareDistributionSheetData(distributions: any[]) {
  return distributions.map((d: any, index: number) => {
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

    let distributionDate = '-';
    try {
      if (d.distribution_date) {
        distributionDate = format(new Date(d.distribution_date), 'dd/MM/yyyy');
      }
    } catch (error) {
      distributionDate = '-';
    }

    // Build a robust human-readable direction string (Arah)
    const buildDirection = (dist: any) => {
      const hasSource = !!dist.source_opd?.name;
      const hasTarget = !!dist.target_opd?.name || !!dist.destination_location;

      // Prefer explicit source/target names when available
      if (hasSource && hasTarget) {
        const sourceName = dist.source_opd?.name || '-';
        const targetName = dist.target_opd?.name || dist.destination_location || '-';
        return `${sourceName} → ${targetName}`;
      }

      if (!hasSource && hasTarget) {
        // If direction mentions Gudang, prefer 'Gudang → target'
        if (dist.direction && /Gudang/i.test(dist.direction)) {
          const targetName = dist.target_opd?.name || dist.destination_location || dist.direction.replace(/.*(?:→|->|–|—|-|to)+/i, '').trim() || '-';
          return `Gudang → ${targetName}`;
        }
      }

      if (hasSource && !hasTarget) {
        if (dist.direction && /Gudang/i.test(dist.direction)) {
          const sourceName = dist.source_opd?.name || dist.direction.replace(/(?:→|->|–|—|-|to).*/i, '').trim() || '-';
          return `${sourceName} → Gudang`;
        }
      }

      // If explicit names not available, try to parse the direction string with many separators
      if (dist.direction && typeof dist.direction === 'string') {
        // Normalize separators to a single arrow
        const normalized = dist.direction.replace(/\s*(→|->|–|—|\-|to)\s*/gi, '→');
        const parts = normalized.split('→').map((p: string) => p.trim()).filter(Boolean);
        if (parts.length === 2) {
          return `${parts[0] || '-'} → ${parts[1] || '-'}`;
        }
        // If only one part, return it
        if (parts.length === 1) return parts[0];
        // Otherwise return original direction
        return dist.direction;
      }

      // Last-resort fallbacks
      if (hasSource) return `${dist.source_opd?.name || '-'} → -`;
      if (hasTarget) return `- → ${dist.target_opd?.name || dist.destination_location || '-'}`;

      return '-';
    };

    // Sanitize text to prevent Excel from interpreting special characters
    const sanitize = (text: string) => {
      if (!text || text === '-') return text;
      return `'${text}`;
    };

    return {
      'No.': index + 1,
      'Kode Distribusi': d.distribution_code || '-',
      'Tanggal': distributionDate,
      'Serial Number': d.item?.serial_number || '-',
      'Kategori': typeof d.item?.category === 'object' ? d.item?.category?.name : d.item?.category || '-',
      'Merek': d.item?.brand || '-',
      'Tipe': d.item?.type || '-',
      'Arah': sanitize(buildDirection(d)),
      'Kondisi': d.item_condition || d.item?.condition || '-',
      'Diketahui': d.processed_by || '-',
      'Lokasi Spesifik': d.specific_location || '-',
      'Diproses Oleh': d.processed_by || '-',
      'Catatan': d.notes || '-'
    };
  });
}

function groupItems(items: any[], groupBy: string) {
  const grouped: Record<string, any[]> = {};

  items.forEach((item) => {
    let key = '';
    
    if (groupBy === 'category') {
      // Extract category name from object or use string directly
      if (typeof item.category === 'object' && item.category?.name) {
        key = item.category.name;
      } else if (typeof item.category === 'string') {
        key = item.category;
      } else {
        key = 'Tanpa Kategori';
      }
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
      // Extract category name from object or use string directly
      if (typeof dist.item?.category === 'object' && dist.item?.category?.name) {
        key = dist.item.category.name;
      } else if (typeof dist.item?.category === 'string') {
        key = dist.item.category;
      } else {
        key = 'Tanpa Kategori';
      }
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
