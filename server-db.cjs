const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const mysql = require('mysql2/promise');

const app = express();
const PORT = process.env.PORT || 8080;

// Constants - NO HARDCODING
const WAREHOUSE_LOCATION = 'Gudang';
const DIRECTION = {
  WAREHOUSE_TO_OPD: 'Gudang → OPD',
  OPD_TO_OPD: 'OPD → OPD',
  OPD_TO_WAREHOUSE: 'OPD → Gudang'
};

// Middleware
app.use(cors());
app.use(express.json());

// Database connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'warehouse_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Helper function to generate alphanumeric transaction code
function generateTransactionCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Test database connection
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('✓ Database connected successfully');
    connection.release();
  } catch (error) {
    console.error('✗ Database connection failed:', error.message);
    process.exit(1);
  }
}

// Health check
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    res.status(500).json({ status: 'error', database: 'disconnected' });
  }
});

// Data Integrity Check - Detect anomalies
app.get('/api/v1/data/integrity', async (req, res) => {
  try {
    // Find items with invalid first transaction (not WAREHOUSE_TO_OPD)
    const [invalidFirstTransactions] = await pool.query(`
      SELECT 
        i.id,
        i.serial_number,
        i.brand,
        i.type,
        d.distribution_code,
        d.direction as first_direction,
        d.distribution_date as first_date
      FROM items i
      INNER JOIN (
        SELECT 
          item_id,
          direction,
          distribution_code,
          distribution_date,
          ROW_NUMBER() OVER (PARTITION BY item_id ORDER BY distribution_date ASC, created_at ASC) as rn
        FROM distributions
      ) d ON i.id = d.item_id AND d.rn = 1
      WHERE d.direction != ?
      ORDER BY i.serial_number
    `, [DIRECTION.WAREHOUSE_TO_OPD]);
    
    // Find inconsistent source_location (doesn't match previous transaction's specific_location)
    const [inconsistentLocations] = await pool.query(`
      SELECT 
        i.serial_number,
        d1.distribution_code as prev_code,
        d1.specific_location as expected_source,
        d1.distribution_date as prev_date,
        d2.distribution_code as curr_code,
        d2.source_location as actual_source,
        d2.direction,
        d2.distribution_date as curr_date
      FROM distributions d1
      INNER JOIN (
        SELECT 
          item_id,
          distribution_code,
          source_location,
          specific_location,
          direction,
          distribution_date,
          created_at,
          LAG(specific_location) OVER (PARTITION BY item_id ORDER BY distribution_date, created_at) as prev_location,
          LAG(distribution_code) OVER (PARTITION BY item_id ORDER BY distribution_date, created_at) as prev_code,
          LAG(distribution_date) OVER (PARTITION BY item_id ORDER BY distribution_date, created_at) as prev_date
        FROM distributions
      ) d2 ON d1.distribution_code = d2.prev_code
      INNER JOIN items i ON d1.item_id = i.id
      WHERE d2.direction IN (?, ?)
        AND d1.specific_location != d2.source_location
      ORDER BY i.serial_number, d2.distribution_date
    `, [DIRECTION.OPD_TO_OPD, DIRECTION.OPD_TO_WAREHOUSE]);
    
    res.json({
      status: 'ok',
      anomalies: {
        invalid_first_transactions: {
          count: invalidFirstTransactions.length,
          description: 'Item yang transaksi pertamanya bukan dari Gudang ke OPD',
          items: invalidFirstTransactions
        },
        inconsistent_source_locations: {
          count: inconsistentLocations.length,
          description: 'Transaksi dengan source_location yang tidak sesuai dengan specific_location transaksi sebelumnya',
          items: inconsistentLocations
        }
      },
      recommendation: (invalidFirstTransactions.length > 0 || inconsistentLocations.length > 0)
        ? 'Ditemukan anomali data historis. Gunakan endpoint /api/v1/data/fix-integrity untuk memperbaiki.'
        : 'Tidak ada anomali data ditemukan. Semua transaksi valid.'
    });
  } catch (error) {
    console.error('Error checking data integrity:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Fix Data Integrity Issues
app.post('/api/v1/data/fix-integrity', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    // Delete invalid first transactions (transactions that are not WAREHOUSE_TO_OPD)
    const [invalidFirstTransactions] = await connection.query(`
      SELECT 
        i.serial_number,
        d.distribution_code,
        d.direction as first_direction,
        d.distribution_date
      FROM items i
      INNER JOIN (
        SELECT 
          item_id,
          direction,
          distribution_code,
          distribution_date,
          ROW_NUMBER() OVER (PARTITION BY item_id ORDER BY distribution_date ASC, created_at ASC) as rn
        FROM distributions
      ) d ON i.id = d.item_id AND d.rn = 1
      WHERE d.direction != ?
    `, [DIRECTION.WAREHOUSE_TO_OPD]);
    
    const deletedCodes = [];
    for (const row of invalidFirstTransactions) {
      await connection.query(
        'DELETE FROM distributions WHERE distribution_code = ?',
        [row.distribution_code]
      );
      deletedCodes.push(row.distribution_code);
    }
    
    // Fix inconsistent source_location
    const [inconsistentLocations] = await connection.query(`
      SELECT 
        d2.distribution_code,
        d1.specific_location as correct_source_location
      FROM distributions d1
      INNER JOIN (
        SELECT 
          item_id,
          distribution_code,
          source_location,
          LAG(specific_location) OVER (PARTITION BY item_id ORDER BY distribution_date, created_at) as prev_location,
          LAG(distribution_code) OVER (PARTITION BY item_id ORDER BY distribution_date, created_at) as prev_code,
          direction
        FROM distributions
      ) d2 ON d1.distribution_code = d2.prev_code
      WHERE d2.direction IN (?, ?)
        AND d1.specific_location != d2.source_location
    `, [DIRECTION.OPD_TO_OPD, DIRECTION.OPD_TO_WAREHOUSE]);
    
    const fixedCodes = [];
    for (const row of inconsistentLocations) {
      await connection.query(
        'UPDATE distributions SET source_location = ? WHERE distribution_code = ?',
        [row.correct_source_location, row.distribution_code]
      );
      fixedCodes.push(row.distribution_code);
    }
    
    await connection.commit();
    
    res.json({
      status: 'success',
      message: `Fixed ${deletedCodes.length + fixedCodes.length} data integrity issues`,
      details: {
        invalid_first_transactions_deleted: deletedCodes.length,
        deleted_distribution_codes: deletedCodes,
        inconsistent_locations_fixed: fixedCodes.length,
        fixed_distribution_codes: fixedCodes
      }
    });
  } catch (error) {
    await connection.rollback();
    console.error('Error fixing data integrity:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    connection.release();
  }
});

// Dashboard API
app.get('/api/v1/dashboard/summary', async (req, res) => {
  try {
    // Fetch items with latest condition from distributions
    const [items] = await pool.query(`
      SELECT 
        i.*,
        (
          SELECT d.item_condition
          FROM distributions d
          WHERE d.item_id = i.id
          ORDER BY d.distribution_date DESC, d.created_at DESC
          LIMIT 1
        ) as latest_condition_from_dist
      FROM items i
      WHERE i.is_active = TRUE
    `);
    
    const [distributions] = await pool.query('SELECT * FROM distributions');
    
    // Items by condition - use latest_condition from distributions, fallback to item.condition
    const conditionCounts = items.reduce((acc, item) => {
      // Business Logic: Jika ada distribusi gunakan kondisi dari distribusi terakhir,
      // jika belum ada distribusi gunakan kondisi dari Tambah Item Baru
      const condition = item.latest_condition_from_dist || item.condition;
      acc[condition] = (acc[condition] || 0) + 1;
      return acc;
    }, {});
    
    // Items by category
    const [categoryStats] = await pool.query(`
      SELECT c.name, COUNT(i.id) as count
      FROM categories c
      LEFT JOIN items i ON c.id = i.category_id AND i.is_active = TRUE
      GROUP BY c.id, c.name
    `);
    
    // Items by OPD - use latest distribution data
    const [opdStats] = await pool.query(`
      SELECT o.name, COUNT(DISTINCT i.id) as count
      FROM opds o
      LEFT JOIN (
        SELECT DISTINCT 
          i.id,
          COALESCE(
            (SELECT d.target_opd_id 
             FROM distributions d 
             WHERE d.item_id = i.id AND d.direction IN ('Gudang → OPD', 'OPD → OPD')
             ORDER BY d.distribution_date DESC, d.created_at DESC 
             LIMIT 1),
            i.current_opd_id
          ) as effective_opd_id
        FROM items i
        WHERE i.is_active = TRUE AND i.current_location = 'OPD'
      ) i ON o.id = i.effective_opd_id
      GROUP BY o.id, o.name
    `);
    
    const summary = {
      total_items: items.length,
      items_in_warehouse: items.filter(item => item.current_location === WAREHOUSE_LOCATION).length,
      items_in_opd: items.filter(item => item.current_location === 'OPD').length,
      total_distributions: distributions.length,
      items_by_condition: conditionCounts,
      items_by_category: categoryStats,
      items_by_opd: opdStats
    };
    
    res.json(summary);
  } catch (error) {
    console.error('Error fetching dashboard summary:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/v1/dashboard/recent-distributions', async (req, res) => {
  try {
    const [distributions] = await pool.query(`
      SELECT
        t.distribution_code, t.item_id, t.direction,
        t.source_opd_id, t.source_location, t.target_opd_id, t.specific_location,
        t.item_condition, t.notes, t.distribution_date, t.processed_by,
        t.created_at, t.updated_at,
        i.serial_number, i.brand, i.type,
        c.name as category_name,
        so.name as source_opd_name,
        to_opd.name as target_opd_name,
        ol.id as location_id,
        ol.location_name,
        ol.opd_id as location_opd_id,
        ol_source.id as source_location_id,
        ol_source.location_name as source_location_name,
        ol_source.opd_id as source_location_opd_id
      FROM distributions t
      LEFT JOIN items i ON t.item_id = i.id
      LEFT JOIN categories c ON i.category_id = c.id
      LEFT JOIN opds so ON t.source_opd_id = so.id
      LEFT JOIN opds to_opd ON t.target_opd_id = to_opd.id
      LEFT JOIN opd_locations ol ON t.specific_location = ol.location_name
      LEFT JOIN opd_locations ol_source ON t.source_location = ol_source.location_name
      ORDER BY t.created_at DESC
      LIMIT 10
    `);

    const enricheddistributions = distributions.map(t => {
      return {
        distribution_code: t.distribution_code,
        item_id: t.item_id,
        direction: t.direction,
        source_opd_id: t.source_opd_id,
        source_location: t.source_location,
        target_opd_id: t.target_opd_id,
        specific_location: t.specific_location,
        notes: t.notes,
        distribution_date: t.distribution_date,
        processed_by: t.processed_by,
        created_at: t.created_at,
        updated_at: t.updated_at,
        item: t.serial_number ? {
          id: t.item_id,
          serial_number: t.serial_number,
          brand: t.brand,
          type: t.type,
          condition: t.item_condition,
          category: { name: t.category_name }
        } : null,
        source_opd: t.source_opd_name ? { id: t.source_opd_id, name: t.source_opd_name } : null,
        target_opd: t.target_opd_name ? { id: t.target_opd_id, name: t.target_opd_name } : null,
        location: t.location_id ? {
          id: t.location_id,
          location_name: t.location_name,
          opd_id: t.location_opd_id
        } : null,
        sourceLocation: t.source_location_id ? {
          id: t.source_location_id,
          location_name: t.source_location_name,
          opd_id: t.source_location_opd_id
        } : null
      };
    });
    
    res.json(enricheddistributions);
  } catch (error) {
    console.error('Error fetching recent distributions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Items API
app.get('/api/v1/items', async (req, res) => {
  try {
    // NO LIMIT - Fetch ALL items
    const query = `
      SELECT 
        i.*,
        c.name as category_name,
        o.name as current_opd_name,
        ol.id as location_id,
        ol.location_name,
        ol.description as location_description,
        ol.pic as location_pic,
        ol.contact as location_contact,
        ol.bandwidth as location_bandwidth,
        ol.address as location_address,
        (
          SELECT d.item_condition
          FROM distributions d
          WHERE d.item_id = i.id
          ORDER BY d.distribution_date DESC, d.created_at DESC
          LIMIT 1
        ) as latest_condition_from_dist,
        (
          SELECT d.direction
          FROM distributions d
          WHERE d.item_id = i.id
          ORDER BY d.distribution_date DESC, d.created_at DESC
          LIMIT 1
        ) as latest_direction,
        (
          SELECT d.target_opd_id
          FROM distributions d
          WHERE d.item_id = i.id AND d.direction = ?
          ORDER BY d.distribution_date DESC, d.created_at DESC
          LIMIT 1
        ) as latest_opd_id_to_opd,
        (
          SELECT d.target_opd_id
          FROM distributions d
          WHERE d.item_id = i.id AND d.direction = ?
          ORDER BY d.distribution_date DESC, d.created_at DESC
          LIMIT 1
        ) as latest_opd_id_opd_to_opd,
        (
          SELECT d.specific_location
          FROM distributions d
          WHERE d.item_id = i.id AND d.direction = ?
          ORDER BY d.distribution_date DESC, d.created_at DESC
          LIMIT 1
        ) as latest_location_to_opd,
        (
          SELECT d.specific_location
          FROM distributions d
          WHERE d.item_id = i.id AND d.direction = ?
          ORDER BY d.distribution_date DESC, d.created_at DESC
          LIMIT 1
        ) as latest_location_opd_to_opd
      FROM items i
      LEFT JOIN categories c ON i.category_id = c.id
      LEFT JOIN opds o ON i.current_opd_id = o.id
      LEFT JOIN opd_locations ol ON i.specific_location = ol.location_name
      WHERE i.is_active = TRUE
      ORDER BY i.created_at DESC
    `;
    
    const [items] = await pool.query(query, [
      DIRECTION.WAREHOUSE_TO_OPD,
      DIRECTION.OPD_TO_OPD,
      DIRECTION.WAREHOUSE_TO_OPD,
      DIRECTION.OPD_TO_OPD
    ]);
    
    const [[{ total }]] = await pool.query('SELECT COUNT(*) as total FROM items WHERE is_active = TRUE');
    
    // Determine the latest opd_id and specific_location based on direction
    const processedItems = items.map(item => {
      // Business Logic for latest_opd_id and latest_specific_location:
      // 1. If latest_direction is 'OPD → OPD', use opd_to_opd values
      // 2. Else if latest_direction is 'Gudang → OPD', use to_opd values
      // 3. Else (no distribution), use item's original current_opd_id and specific_location
      
      let latest_opd_id;
      let latest_specific_location;
      
      if (item.latest_direction === DIRECTION.OPD_TO_OPD && item.latest_opd_id_opd_to_opd) {
        latest_opd_id = item.latest_opd_id_opd_to_opd;
        latest_specific_location = item.latest_location_opd_to_opd;
      } else if (item.latest_direction === DIRECTION.WAREHOUSE_TO_OPD && item.latest_opd_id_to_opd) {
        latest_opd_id = item.latest_opd_id_to_opd;
        latest_specific_location = item.latest_location_to_opd;
      } else if (item.latest_direction === DIRECTION.OPD_TO_WAREHOUSE) {
        // Item kembali ke gudang - tidak ada OPD
        latest_opd_id = null;
        latest_specific_location = WAREHOUSE_LOCATION;
      } else {
        // Belum ada distribusi - gunakan data dari Tambah Item Baru
        latest_opd_id = item.current_opd_id;
        latest_specific_location = item.specific_location;
      }
      
      // Business Logic for latest_condition:
      // 1. If there's a distribution, use latest_condition_from_dist
      // 2. Else (no distribution), use item's original condition
      const latest_condition = item.latest_condition_from_dist || item.condition;
      
      return {
        ...item,
        latest_condition,
        latest_opd_id,
        latest_specific_location
      };
    });
    
    // Fetch OPDs and locations for latest data
    const opdIds = [...new Set(processedItems.map(i => i.latest_opd_id).filter(Boolean))];
    const locationNames = [...new Set(processedItems.map(i => i.latest_specific_location).filter(Boolean))];
    
    let opdsMap = {};
    let locationsMap = {};
    
    if (opdIds.length > 0) {
      const [opds] = await pool.query('SELECT id, name FROM opds WHERE id IN (?)', [opdIds]);
      opdsMap = opds.reduce((acc, opd) => ({ ...acc, [opd.id]: opd }), {});
    }
    
    if (locationNames.length > 0) {
      const placeholders = locationNames.map(() => '?').join(',');
      const [locations] = await pool.query(
        `SELECT id, location_name, opd_id FROM opd_locations WHERE location_name IN (${placeholders})`,
        locationNames
      );
      locationsMap = locations.reduce((acc, loc) => ({ ...acc, [loc.location_name]: loc }), {});
    }
    
    const enrichedItems = processedItems.map(item => {
      // Remove temporary columns and location-specific columns from the spread
      const { 
        location_id, location_name, location_description, 
        location_pic, location_contact, location_bandwidth, location_address,
        category_name, current_opd_name, 
        latest_condition_from_dist, latest_condition, latest_direction,
        latest_opd_id, latest_specific_location,
        latest_opd_id_to_opd, latest_opd_id_opd_to_opd,
        latest_location_to_opd, latest_location_opd_to_opd,
        ...itemData 
      } = item;
      
      const latestOpd = latest_opd_id ? opdsMap[latest_opd_id] : null;
      const latestLocation = latest_specific_location ? locationsMap[latest_specific_location] : null;
      
      return {
        ...itemData,
        latest_condition,
        latest_direction: latest_direction || null,
        latest_opd_id,
        latest_opd: latestOpd,
        latest_specific_location,
        latest_location: latestLocation,
        category: { id: item.category_id, name: item.category_name },
        current_opd: item.current_opd_id ? { id: item.current_opd_id, name: item.current_opd_name } : null,
        location: item.location_id ? {
          id: item.location_id,
          location_name: item.location_name,
          description: item.location_description,
          pic: item.location_pic,
          contact: item.location_contact,
          bandwidth: item.location_bandwidth,
          address: item.location_address
        } : null
      };
    });
    
    // Return all data without pagination - truly unlimited
    res.json({
      data: enrichedItems,
      total: total
    });
  } catch (error) {
    console.error('Error fetching items:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/v1/items', async (req, res) => {
  try {
    const id = uuidv4();
    const {
      serial_number,
      category_id,
      brand,
      type,
      condition = 'Layak Pakai',
      description,
      entry_date,
      specific_location
    } = req.body;
    
    // Validasi required fields
    if (!serial_number || !serial_number.trim()) {
      return res.status(400).json({ error: 'Serial number wajib diisi' });
    }
    
    if (!category_id || !category_id.trim()) {
      return res.status(400).json({ error: 'Kategori wajib dipilih' });
    }
    
    if (!brand || !brand.trim()) {
      return res.status(400).json({ error: 'Merek wajib dipilih' });
    }
    
    if (!type || !type.trim()) {
      return res.status(400).json({ error: 'Tipe wajib dipilih' });
    }
    
    if (!condition || !condition.trim()) {
      return res.status(400).json({ error: 'Kondisi wajib dipilih' });
    }
    
    // Use provided entry_date or default to today
    let entryDateValue = entry_date || new Date().toISOString().split('T')[0];
    
    // Validasi tanggal masuk
    const entryDate = new Date(entryDateValue);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    
    const minDate = new Date();
    minDate.setFullYear(minDate.getFullYear() - 10);
    minDate.setHours(0, 0, 0, 0);
    
    if (entryDate > today) {
      return res.status(400).json({ error: 'Tanggal masuk tidak boleh lebih dari hari ini' });
    }
    
    if (entryDate < minDate) {
      return res.status(400).json({ error: 'Tanggal masuk tidak boleh lebih dari 10 tahun yang lalu' });
    }
    
    await pool.query(`
      INSERT INTO items (
        id, serial_number, category_id, brand, type, \`condition\`,
        description, entry_date, current_location, specific_location, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE)
    `, [id, serial_number, category_id, brand, type, condition, description, entryDateValue, WAREHOUSE_LOCATION, specific_location]);
    
    const [[newItem]] = await pool.query('SELECT * FROM items WHERE id = ?', [id]);
    
    res.status(201).json(newItem);
  } catch (error) {
    console.error('Error creating item:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      res.status(400).json({ error: 'Serial number already exists' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

app.get('/api/v1/items/:id', async (req, res) => {
  try {
    const [[item]] = await pool.query('SELECT * FROM items WHERE id = ? AND is_active = TRUE', [req.params.id]);
    
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }
    
    res.json(item);
  } catch (error) {
    console.error('Error fetching item:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/v1/items/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    // Map 'description' from frontend to database field (allow empty string)
    if ('description' in updates) {
      // Keep the description value, even if it's an empty string
      updates.description = updates.description || ''; // Convert null/undefined to empty string
      delete updates.notes; // Remove if exists
    }
    
    // Validasi tanggal masuk jika ada di updates
    if (updates.entry_date) {
      const entryDate = new Date(updates.entry_date);
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      
      const minDate = new Date();
      minDate.setFullYear(minDate.getFullYear() - 10);
      minDate.setHours(0, 0, 0, 0);
      
      if (entryDate > today) {
        return res.status(400).json({ error: 'Tanggal masuk tidak boleh lebih dari hari ini' });
      }
      
      if (entryDate < minDate) {
        return res.status(400).json({ error: 'Tanggal masuk tidak boleh lebih dari 10 tahun yang lalu' });
      }
    }
    
    // Whitelist allowed fields
    const allowedFields = ['serial_number', 'brand', 'type', 'category_id', 'condition', 'current_location', 'current_opd_id', 'specific_location', 'description', 'entry_date'];
    const filteredUpdates = {};
    
    Object.keys(updates).forEach(key => {
      if (allowedFields.includes(key)) {
        filteredUpdates[key] = updates[key];
      }
    });
    
    if (Object.keys(filteredUpdates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }
    
    const fields = Object.keys(filteredUpdates).map(key => `\`${key}\` = ?`).join(', ');
    const values = [...Object.values(filteredUpdates), id];
    
    await pool.query(`UPDATE items SET ${fields} WHERE id = ?`, values);
    
    const [[updatedItem]] = await pool.query('SELECT * FROM items WHERE id = ?', [id]);
    
    if (!updatedItem) {
      return res.status(404).json({ error: 'Item not found' });
    }
    
    res.json(updatedItem);
  } catch (error) {
    console.error('Error updating item:', error);
    console.error('Error details:', error.message);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

app.delete('/api/v1/items/:id', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    // Check if item exists and is active
    const [[item]] = await connection.query(
      'SELECT id, serial_number FROM items WHERE id = ? AND is_active = TRUE',
      [req.params.id]
    );
    
    if (!item) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ error: 'Item not found or already deleted' });
    }
    
    // BUSINESS LOGIC: When deleting an item, also delete all its distributions
    // This maintains data consistency - can't have distributions without an item
    
    // Soft delete: set is_active to FALSE and append timestamp to serial_number to avoid unique constraint
    const timestamp = Date.now();
    await connection.query(
      'UPDATE items SET is_active = FALSE, serial_number = CONCAT(serial_number, "_deleted_", ?) WHERE id = ?',
      [timestamp, req.params.id]
    );
    
    // Also delete all distributions for this item
    // In real world: if item is deleted, its movement history becomes irrelevant
    const [deleteResult] = await connection.query(
      'DELETE FROM distributions WHERE item_id = ?',
      [req.params.id]
    );
    
    await connection.commit();
    
    res.status(200).json({ 
      message: 'Item deleted successfully',
      deleted_distributions: deleteResult.affectedRows,
      item_id: req.params.id
    });
  } catch (error) {
    await connection.rollback();
    console.error('Error deleting item:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    connection.release();
  }
});

app.get('/api/v1/items/search', async (req, res) => {
  try {
    const query = req.query.q?.toLowerCase() || '';
    
    const [items] = await pool.query(`
      SELECT * FROM items
      WHERE is_active = TRUE
      AND (
        LOWER(serial_number) LIKE ?
        OR LOWER(brand) LIKE ?
        OR LOWER(model) LIKE ?
      )
      LIMIT 20
    `, [`%${query}%`, `%${query}%`, `%${query}%`]);
    
    res.json(items);
  } catch (error) {
    console.error('Error searching items:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// distributions API
app.get('/api/v1/distributions', async (req, res) => {
  try {
    const itemId = req.query.item_id; // Filter by item_id if provided
    
    // Build WHERE clause dynamically
    const whereClause = itemId ? 'WHERE t.item_id = ?' : '';
    const queryParams = itemId ? [itemId] : [];
    
    // NO LIMIT - Fetch ALL data
    const [distributions] = await pool.query(`
      SELECT 
        t.distribution_code, t.item_id, t.direction,
        t.source_opd_id, t.source_location, t.target_opd_id, t.specific_location,
        t.item_condition, t.notes, t.distribution_date, t.processed_by,
        t.created_at, t.updated_at,
        i.serial_number, i.brand, i.type,
        c.name as category_name,
        so.name as source_opd_name,
        to_opd.name as target_opd_name,
        ol.id as location_id,
        ol.location_name,
        ol.description as location_description,
        ol.pic as location_pic,
        ol.contact as location_contact,
        ol.bandwidth as location_bandwidth,
        ol.address as location_address,
        ol.opd_id as location_opd_id,
        ol_source.id as source_location_id,
        ol_source.location_name as source_location_name,
        ol_source.opd_id as source_location_opd_id
      FROM distributions t
      LEFT JOIN items i ON t.item_id = i.id
      LEFT JOIN categories c ON i.category_id = c.id
      LEFT JOIN opds so ON t.source_opd_id = so.id
      LEFT JOIN opds to_opd ON t.target_opd_id = to_opd.id
      LEFT JOIN opd_locations ol ON t.specific_location = ol.location_name
      LEFT JOIN opd_locations ol_source ON t.source_location = ol_source.location_name
      ${whereClause}
      ORDER BY t.created_at DESC
    `, queryParams);
    
    const countQuery = itemId 
      ? 'SELECT COUNT(*) as total FROM distributions WHERE item_id = ?' 
      : 'SELECT COUNT(*) as total FROM distributions';
    const [[{ total }]] = await pool.query(countQuery, itemId ? [itemId] : []);
    
    const enricheddistributions = distributions.map(t => {
      return {
        distribution_code: t.distribution_code,
        item_id: t.item_id,
        direction: t.direction,
        source_opd_id: t.source_opd_id,
        source_location: t.source_location,
        target_opd_id: t.target_opd_id,
        specific_location: t.specific_location,
        item_condition: t.item_condition, // Kondisi item saat distribusi
        notes: t.notes,
        distribution_date: t.distribution_date,
        processed_by: t.processed_by,
        created_at: t.created_at,
        updated_at: t.updated_at,
        item: t.serial_number ? {
          id: t.item_id,
          serial_number: t.serial_number,
          brand: t.brand,
          type: t.type,
          condition: t.item_condition,
          category: { name: t.category_name }
        } : null,
        source_opd: t.source_opd_name ? { id: t.source_opd_id, name: t.source_opd_name } : null,
        target_opd: t.target_opd_name ? { id: t.target_opd_id, name: t.target_opd_name } : null,
        location: t.location_id ? {
          id: t.location_id,
          location_name: t.location_name,
          description: t.location_description,
          pic: t.location_pic,
          contact: t.location_contact,
          bandwidth: t.location_bandwidth,
          address: t.location_address,
          opd_id: t.location_opd_id
        } : null,
        sourceLocation: t.source_location_id ? {
          id: t.source_location_id,
          location_name: t.source_location_name,
          opd_id: t.source_location_opd_id
        } : null
      };
    });
    
    // Return all data without pagination - truly unlimited
    res.json({
      data: enricheddistributions,
      total: total
    });
  } catch (error) {
    console.error('Error fetching distributions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/v1/distributions', async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    // Generate 6-character alphanumeric transaction code (uppercase letters + numbers)
    const distribution_code = generateTransactionCode();
    const {
      item_id,
      direction,
      source_opd_id,
      target_opd_id,
      specific_location,
      item_condition,
      notes,
      processed_by
    } = req.body;
    
    // DEBUG: Log received direction value
    console.log('Received direction:', direction, 'Length:', direction?.length, 'Charcode:', direction?.split('').map(c => c.charCodeAt(0)));
    
    // Get current item data
    const [[item]] = await connection.query('SELECT current_location, current_opd_id, specific_location FROM items WHERE id = ?', [item_id]);
    
    if (!item) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ error: 'Item not found' });
    }
    
    // Get latest distribution transaction to determine actual current location
    const [[latestDistribution]] = await connection.query(`
      SELECT direction, target_opd_id, specific_location
      FROM distributions
      WHERE item_id = ?
      ORDER BY distribution_date DESC, created_at DESC
      LIMIT 1
    `, [item_id]);
    
    // BUSINESS LOGIC VALIDATION
    // Rule 0: FIRST TRANSACTION MUST BE WAREHOUSE_TO_OPD
    if (!latestDistribution && direction !== DIRECTION.WAREHOUSE_TO_OPD) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ 
        error: `Transaksi pertama item HARUS dari ${WAREHOUSE_LOCATION} ke OPD. Gunakan direction "${DIRECTION.WAREHOUSE_TO_OPD}"`,
        hint: 'Item belum pernah didistribusikan sebelumnya'
      });
    }
    
    // Determine actual current location based on latest distribution
    let actualLocation;
    let actualOpdId;
    let actualSpecificLocation;
    
    if (!latestDistribution) {
      // No distribution history, item is in WAREHOUSE
      actualLocation = WAREHOUSE_LOCATION;
      actualOpdId = null;
      actualSpecificLocation = null;
    } else {
      // Determine location from latest distribution direction
      if (latestDistribution.direction === DIRECTION.OPD_TO_WAREHOUSE) {
        actualLocation = WAREHOUSE_LOCATION;
        actualOpdId = null;
        actualSpecificLocation = latestDistribution.specific_location;
      } else if (latestDistribution.direction === DIRECTION.WAREHOUSE_TO_OPD || latestDistribution.direction === DIRECTION.OPD_TO_OPD) {
        actualLocation = 'OPD';
        actualOpdId = latestDistribution.target_opd_id;
        actualSpecificLocation = latestDistribution.specific_location;
      }
    }
    
    // Rule 1: If item is in WAREHOUSE, only allow WAREHOUSE_TO_OPD
    if (actualLocation === WAREHOUSE_LOCATION && direction !== DIRECTION.WAREHOUSE_TO_OPD) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ 
        error: `Item saat ini berada di ${WAREHOUSE_LOCATION}. Hanya bisa didistribusikan ke OPD. Gunakan direction "${DIRECTION.WAREHOUSE_TO_OPD}"` 
      });
    }
    
    // Rule 2: If item is in OPD, only allow OPD_TO_OPD or OPD_TO_WAREHOUSE
    if (actualLocation === 'OPD' && direction === DIRECTION.WAREHOUSE_TO_OPD) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ 
        error: `Item sedang berada di OPD. Gunakan "${DIRECTION.OPD_TO_OPD}" untuk pindah ke OPD lain atau "${DIRECTION.OPD_TO_WAREHOUSE}" untuk pengembalian` 
      });
    }
    
    // Rule 3: Validate source_opd_id matches actual current location for OPD distributions
    if (direction === DIRECTION.OPD_TO_OPD || direction === DIRECTION.OPD_TO_WAREHOUSE) {
      if (!source_opd_id || source_opd_id !== actualOpdId) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({ 
          error: 'Source OPD tidak sesuai dengan lokasi item saat ini',
          current_opd_id: actualOpdId,
          provided_source_opd_id: source_opd_id
        });
      }
    }
    
    // Rule 4: For OPD → OPD, source and target location must be different
    if (direction === DIRECTION.OPD_TO_OPD) {
      // Check if OPD is same
      if (source_opd_id === target_opd_id) {
        // If same OPD, check if location is also same
        if (actualSpecificLocation === specific_location) {
          await connection.rollback();
          connection.release();
          return res.status(400).json({ 
            error: 'Lokasi asal dan tujuan tidak boleh sama. Item sudah berada di lokasi tersebut.' 
          });
        }
      }
    }
    
    // Determine source_location based on direction and actual location
    // For WAREHOUSE_TO_OPD, use "Gudang Utama" as source_location
    // For OPD distributions (OPD_TO_OPD or OPD_TO_WAREHOUSE), use actual current specific_location from latest distribution
    const sourceLocation = (direction === DIRECTION.WAREHOUSE_TO_OPD)
      ? 'Gudang Utama'
      : actualSpecificLocation;
    
    // For OPD_TO_WAREHOUSE, if specific_location is null/empty, use "Gudang Utama"
    const targetLocation = (direction === DIRECTION.OPD_TO_WAREHOUSE && (!specific_location || specific_location.trim() === ''))
      ? 'Gudang Utama'
      : specific_location;
    
    // Insert transaction with item condition snapshot
    await connection.query(`
      INSERT INTO distributions (
        distribution_code, item_id, direction, source_opd_id, source_location, target_opd_id,
        specific_location, item_condition, notes, distribution_date, processed_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)
    `, [distribution_code, item_id, direction, source_opd_id, sourceLocation, target_opd_id, targetLocation, item_condition, notes, processed_by]);
    
    // Update item location based on transaction direction
    // NOTE: Do NOT update items.condition - it represents the INITIAL condition when item entered warehouse
    // Latest condition is tracked in distributions.item_condition
    
    if (direction === DIRECTION.WAREHOUSE_TO_OPD) {
      await connection.query(`
        UPDATE items
        SET current_location = 'OPD', current_opd_id = ?, specific_location = ?
        WHERE id = ?
      `, [target_opd_id, targetLocation, item_id]);
    } else if (direction === DIRECTION.OPD_TO_WAREHOUSE) {
      await connection.query(`
        UPDATE items
        SET current_location = ?, current_opd_id = NULL, specific_location = ?
        WHERE id = ?
      `, [WAREHOUSE_LOCATION, targetLocation, item_id]);
    } else if (direction === DIRECTION.OPD_TO_OPD) {
      await connection.query(`
        UPDATE items
        SET current_opd_id = ?, specific_location = ?
        WHERE id = ?
      `, [target_opd_id, targetLocation, item_id]);
    }
    
    await connection.commit();
    
    const [[newTransaction]] = await connection.query('SELECT * FROM distributions WHERE distribution_code = ?', [distribution_code]);
    
    res.status(201).json(newTransaction);
  } catch (error) {
    await connection.rollback();
    console.error('Error creating transaction:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    connection.release();
  }
});

app.put('/api/v1/distributions/:distribution_code', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { distribution_code } = req.params;
    const { 
      direction, 
      source_opd_id, 
      target_opd_id, 
      specific_location, 
      item_condition, 
      notes, 
      processed_by, 
      distribution_date 
    } = req.body;
    
    console.log('=== UPDATE TRANSACTION ===');
    console.log('Transaction Code:', distribution_code);
    console.log('Request body:', req.body);
    
    // Start transaction
    await connection.beginTransaction();
    
    // Get current transaction
    const [[transaction]] = await connection.query('SELECT * FROM distributions WHERE distribution_code = ?', [distribution_code]);
    
    if (!transaction) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    console.log('Current transaction:', transaction);
    console.log('Item ID:', transaction.item_id);
    
    // Initialize update arrays early - CRITICAL: Must be declared before use in AUTO-RECALCULATE
    const updateFields = [];
    const updateValues = [];
    
    // Track which fields have been auto-set to prevent overwriting
    const autoSetFields = new Set();
    
    // BUSINESS LOGIC VALIDATION - DISTRIBUTION DATE
    if (distribution_date !== undefined && distribution_date !== null) {
      console.log('🔍 DATE VALIDATION - Received distribution_date:', distribution_date);
      
      // Normalize both dates to YYYY-MM-DD format for comparison (ignore time)
      let currentDateInDb;
      if (transaction.distribution_date instanceof Date) {
        currentDateInDb = transaction.distribution_date.toISOString().split('T')[0];
      } else if (typeof transaction.distribution_date === 'string') {
        currentDateInDb = transaction.distribution_date.split('T')[0];
      } else {
        currentDateInDb = String(transaction.distribution_date).split('T')[0];
      }
      
      let newDateNormalized;
      if (typeof distribution_date === 'string') {
        newDateNormalized = distribution_date.split('T')[0];
      } else {
        newDateNormalized = String(distribution_date).split('T')[0];
      }
      
      console.log('🔍 Date comparison - DB:', currentDateInDb, '| New:', newDateNormalized, '| Same?', newDateNormalized === currentDateInDb);
      
      // CRITICAL FIX: Skip ALL validations if date hasn't changed
      if (newDateNormalized !== currentDateInDb) {
        console.log('⚠️ Date CHANGED - Running validations...');
        
        // Parse dates and normalize to date-only (no time component)
        const newDate = new Date(newDateNormalized + 'T00:00:00');
        
        // Get today in WIB timezone (UTC+7)
        const todayUTC = new Date();
        const todayWIB = new Date(todayUTC.getTime() + (7 * 60 * 60 * 1000)); // Add 7 hours
        const todayWIBString = todayWIB.toISOString().split('T')[0];
        const today = new Date(todayWIBString + 'T00:00:00');
        
        // Rule 1: Distribution date cannot be in the future
        if (newDate > today) {
          await connection.rollback();
          connection.release();
          return res.status(400).json({ 
            error: '❌ TANGGAL TIDAK VALID',
            reason: 'Tanggal distribusi tidak boleh di masa depan',
            rule: 'Distribusi adalah event yang sudah terjadi, bukan yang akan terjadi',
            provided_date: newDateNormalized,
            max_allowed: todayWIBString,
            solution: `Gunakan tanggal hari ini (${todayWIBString}) atau tanggal yang lebih awal`,
            why: 'Sistem hanya mencatat distribusi yang sudah terjadi'
          });
        }
        
        // Rule 2: Distribution date must be after or equal to item entry_date
        const [[item]] = await connection.query('SELECT entry_date FROM items WHERE id = ?', [transaction.item_id]);
        if (item && item.entry_date) {
          const entryDateStr = item.entry_date instanceof Date
            ? item.entry_date.toISOString().split('T')[0]
            : (item.entry_date || '').split('T')[0];
          const entryDate = new Date(entryDateStr + 'T00:00:00');
          
          if (newDate < entryDate) {
            await connection.rollback();
            connection.release();
            return res.status(400).json({ 
              error: '❌ TANGGAL TIDAK VALID',
              reason: 'Tanggal distribusi tidak boleh lebih awal dari tanggal item masuk gudang',
              rule: 'Item harus masuk gudang terlebih dahulu sebelum bisa didistribusikan',
              item_entry_date: entryDateStr,
              provided_date: newDateNormalized,
              solution: `Gunakan tanggal ${entryDateStr} atau setelahnya`,
              why: `Item baru masuk gudang pada ${entryDateStr}, tidak mungkin didistribusikan sebelum tanggal tersebut`
            });
          }
        }
        
        // Rule 3: Distribution date must be after or equal to previous distribution (if exists)
        // Use created_at to determine the actual chronological order
        const [[previousDistribution]] = await connection.query(`
          SELECT distribution_code, distribution_date, direction, created_at
          FROM distributions
          WHERE item_id = ? AND distribution_code != ? AND created_at < (SELECT created_at FROM distributions WHERE distribution_code = ?)
          ORDER BY created_at DESC
          LIMIT 1
        `, [transaction.item_id, distribution_code, distribution_code]);
        
        if (previousDistribution) {
          const prevDateStr = previousDistribution.distribution_date instanceof Date
            ? previousDistribution.distribution_date.toISOString().split('T')[0]
            : (previousDistribution.distribution_date || '').split('T')[0];
          const prevDate = new Date(prevDateStr + 'T00:00:00');
          
          if (newDate < prevDate) {
            await connection.rollback();
            connection.release();
            return res.status(400).json({ 
              error: '❌ TANGGAL TIDAK VALID - TIMELINE TERBALIK',
              reason: 'Tanggal distribusi harus sama atau lebih lambat dari distribusi sebelumnya',
              rule: 'Timeline distribusi harus berurutan secara kronologis (boleh di hari yang sama)',
              timeline: {
                previous: `${prevDateStr} - ${previousDistribution.direction}`,
                current_old: `${currentDateInDb} - ${transaction.direction}`,
                current_new: `${newDateNormalized} - ${transaction.direction} ❌ TIDAK VALID`
              },
              solution: `Gunakan tanggal ${prevDateStr} atau setelahnya`,
              why: 'Distribusi tidak bisa terjadi sebelum distribusi sebelumnya terjadi'
            });
          }
        }
        
        // Rule 4: Distribution date must be before or equal to next distribution (if exists)
        // Use created_at to determine the actual chronological order
        const [[nextDistribution]] = await connection.query(`
          SELECT distribution_code, distribution_date, direction, created_at
          FROM distributions
          WHERE item_id = ? AND distribution_code != ? AND created_at > (SELECT created_at FROM distributions WHERE distribution_code = ?)
          ORDER BY created_at ASC
          LIMIT 1
        `, [transaction.item_id, distribution_code, distribution_code]);
        
        console.log('🔍 Rule 4 - Next distribution check:');
        console.log('   nextDistribution:', nextDistribution);
        console.log('   newDate:', newDate, '| newDateNormalized:', newDateNormalized);
        
        if (nextDistribution) {
          console.log('   Next dist found:', nextDistribution.distribution_code);
          console.log('   Next dist date:', nextDistribution.distribution_date);
          console.log('   Next dist created_at:', nextDistribution.created_at);
          console.log('   Next dist found:', nextDistribution.distribution_code);
          console.log('   Next dist date:', nextDistribution.distribution_date);
          console.log('   Next dist created_at:', nextDistribution.created_at);
          
          const nextDateStr = nextDistribution.distribution_date instanceof Date
            ? nextDistribution.distribution_date.toISOString().split('T')[0]
            : (nextDistribution.distribution_date || '').split('T')[0];
          const nextDate = new Date(nextDateStr + 'T00:00:00');
          
          console.log('   nextDateStr:', nextDateStr);
          console.log('   nextDate:', nextDate);
          console.log('   Comparison: newDate > nextDate?', newDate > nextDate);
          console.log('   newDate:', newDate.toISOString());
          console.log('   nextDate:', nextDate.toISOString());
          
          if (newDate > nextDate) {
            await connection.rollback();
            connection.release();
            return res.status(400).json({ 
              error: '❌ TANGGAL TIDAK VALID - TIMELINE TERBALIK',
              reason: 'Tanggal distribusi harus sama atau lebih awal dari distribusi berikutnya',
              rule: 'Timeline distribusi harus berurutan secara kronologis (boleh di hari yang sama)',
              timeline: {
                current_old: `${currentDateInDb} - ${transaction.direction}`,
                current_new: `${newDateNormalized} - ${transaction.direction} ❌ TIDAK VALID`,
                next: `${nextDateStr} - ${nextDistribution.direction}`
              },
              solution: `Gunakan tanggal ${nextDateStr} atau sebelumnya`,
              why: 'Distribusi tidak bisa terjadi setelah distribusi berikutnya terjadi'
            });
          }
        }
        
        // Rule 5: Max 10 years ago (reasonable business constraint)
        const minDate = new Date();
        minDate.setFullYear(minDate.getFullYear() - 10);
        minDate.setHours(0, 0, 0, 0);
        
        if (newDate < minDate) {
          await connection.rollback();
          connection.release();
          return res.status(400).json({ 
            error: '❌ TANGGAL TIDAK VALID',
            reason: 'Tanggal distribusi tidak boleh lebih dari 10 tahun yang lalu',
            rule: 'Data historis maksimal 10 tahun untuk menjaga kualitas data',
            provided_date: newDateNormalized,
            min_allowed: minDate.toISOString().split('T')[0],
            solution: 'Periksa kembali tanggal yang Anda masukkan',
            why: 'Tanggal terlalu lama kemungkinan kesalahan input'
          });
        }
      } else {
        console.log('✅ Date unchanged - SKIPPING all date validations');
      }
    }
    
    // BUSINESS LOGIC VALIDATION - DIRECTION
    // Only validate if direction is being changed
    if (direction && direction !== transaction.direction) {
      
      // Get previous distribution (before current one) to determine if this is the FIRST distribution
      // Use created_at for chronological order
      const [[previousDistribution]] = await connection.query(`
        SELECT direction, target_opd_id, specific_location, created_at
        FROM distributions
        WHERE item_id = ? AND created_at < ? AND distribution_code != ?
        ORDER BY created_at DESC
        LIMIT 1
      `, [transaction.item_id, transaction.created_at, distribution_code]);
      
      // Rule 1: FIRST DISTRIBUTION MUST BE "Gudang → OPD"
      if (!previousDistribution && direction !== DIRECTION.WAREHOUSE_TO_OPD) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({ 
          error: `❌ TIDAK BISA MENGUBAH ARAH DISTRIBUSI`,
          reason: `Ini adalah distribusi PERTAMA untuk item ini`,
          rule: `Distribusi pertama HARUS dari "${WAREHOUSE_LOCATION}" ke "OPD"`,
          current_direction: transaction.direction,
          attempted_direction: direction,
          solution: `Distribusi pertama hanya bisa mengirim item dari gudang ke OPD. Anda bisa mengubah OPD tujuan, tapi arah tetap harus "${DIRECTION.WAREHOUSE_TO_OPD}"`,
          example: `Contoh BENAR: Ubah dari "Gudang → OPD A" ke "Gudang → OPD B" (mengganti target OPD)`,
          why: 'Item baru masuk gudang, belum pernah di OPD sebelumnya'
        });
      }
      
      // Rule 2: Cannot change FROM "Gudang → OPD" TO "OPD → xxx" if this is first distribution
      if (!previousDistribution && transaction.direction === DIRECTION.WAREHOUSE_TO_OPD && 
          (direction === DIRECTION.OPD_TO_OPD || direction === DIRECTION.OPD_TO_WAREHOUSE)) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({ 
          error: `❌ TIDAK BISA MENGUBAH ARAH DISTRIBUSI`,
          reason: `Ini adalah distribusi PERTAMA untuk item ini`,
          rule: `Distribusi pertama HARUS tetap "${DIRECTION.WAREHOUSE_TO_OPD}"`,
          current_direction: transaction.direction,
          attempted_direction: direction,
          solution: `Item baru pertama kali keluar dari gudang. Tidak mungkin langsung "${direction}" karena item belum pernah berada di OPD sebelumnya`,
          allowed: `Yang BOLEH diubah: Target OPD tujuan (misal dari "BPKD" ke "Dinas Kominfo")`,
          not_allowed: `Yang TIDAK BOLEH: Mengubah arah menjadi "OPD → OPD" atau "OPD → Gudang"`,
          why: 'Pada saat distribusi pertama, item masih di gudang, bukan di OPD'
        });
      }
      
      // Rule 3: If there's previous distribution, validate direction change makes sense
      if (previousDistribution) {
        // Determine where item was BEFORE this distribution
        let itemLocationBeforeThisDistribution;
        
        if (previousDistribution.direction === DIRECTION.OPD_TO_WAREHOUSE) {
          itemLocationBeforeThisDistribution = WAREHOUSE_LOCATION;
        } else if (previousDistribution.direction === DIRECTION.WAREHOUSE_TO_OPD || 
                   previousDistribution.direction === DIRECTION.OPD_TO_OPD) {
          itemLocationBeforeThisDistribution = 'OPD';
        }
        
        // If item was in WAREHOUSE before this distribution, new direction must be "Gudang → OPD"
        if (itemLocationBeforeThisDistribution === WAREHOUSE_LOCATION && direction !== DIRECTION.WAREHOUSE_TO_OPD) {
          await connection.rollback();
          connection.release();
          return res.status(400).json({ 
            error: `❌ TIDAK BISA MENGUBAH ARAH DISTRIBUSI`,
            reason: `Item berada di ${WAREHOUSE_LOCATION} sebelum distribusi ini terjadi`,
            rule: `Item yang di gudang hanya bisa dikirim ke OPD`,
            timeline_info: {
              before_this: `Item di ${WAREHOUSE_LOCATION} (distribusi sebelumnya: ${previousDistribution.direction})`,
              current: transaction.direction,
              attempted: direction
            },
            solution: `Arah distribusi harus tetap "${DIRECTION.WAREHOUSE_TO_OPD}" karena item berasal dari gudang`,
            allowed: `Yang BOLEH diubah: OPD tujuan (misal dari BPKD ke Dinas Kominfo)`,
            not_allowed: `Tidak bisa mengubah menjadi "${direction}" karena item tidak sedang berada di OPD`,
            why: `Distribusi sebelumnya "${previousDistribution.direction}" menempatkan item di gudang`
          });
        }
        
        // If item was in OPD before this distribution, new direction must be "OPD → OPD" or "OPD → Gudang"
        if (itemLocationBeforeThisDistribution === 'OPD' && direction === DIRECTION.WAREHOUSE_TO_OPD) {
          await connection.rollback();
          connection.release();
          return res.status(400).json({ 
            error: `❌ TIDAK BISA MENGUBAH ARAH DISTRIBUSI`,
            reason: `Item berada di OPD sebelum distribusi ini terjadi`,
            rule: `Item yang di OPD hanya bisa dipindah ke OPD lain atau dikembalikan ke gudang`,
            timeline_info: {
              before_this: `Item di OPD (distribusi sebelumnya: ${previousDistribution.direction})`,
              current: transaction.direction,
              attempted: direction
            },
            solution: `Arah distribusi harus "${DIRECTION.OPD_TO_OPD}" atau "${DIRECTION.OPD_TO_WAREHOUSE}"`,
            allowed_options: [
              `"${DIRECTION.OPD_TO_OPD}" - Memindahkan item ke OPD lain`,
              `"${DIRECTION.OPD_TO_WAREHOUSE}" - Mengembalikan item ke gudang`
            ],
            not_allowed: `Tidak bisa "${DIRECTION.WAREHOUSE_TO_OPD}" karena item tidak di gudang`,
            why: `Distribusi sebelumnya "${previousDistribution.direction}" menempatkan item di OPD`
          });
        }
      }
    }
    
    // ✅ AUTO-RECALCULATE source_location when direction changes
    // If direction is being changed, recalculate source from previous distribution's target
    // IMPORTANT: Only do this if direction is EXPLICITLY changed by user
    if (direction && direction !== transaction.direction) {
      console.log('🔄 Direction changed - recalculating source_location from previous distribution');
      console.log(`   Old direction: ${transaction.direction}`);
      console.log(`   New direction: ${direction}`);
      
      const [[prevDist]] = await connection.query(`
        SELECT target_opd_id, specific_location, direction
        FROM distributions
        WHERE item_id = ? AND created_at < ?
        ORDER BY created_at DESC LIMIT 1
      `, [transaction.item_id, transaction.created_at]);
      
      if (prevDist) {
        // Auto-set source from previous distribution's target
        // Only for OPD-based directions (OPD → OPD, OPD → Gudang)
        if (direction === DIRECTION.OPD_TO_OPD || direction === DIRECTION.OPD_TO_WAREHOUSE) {
          // Always recalculate source_opd_id from previous when direction changes
          if (source_opd_id === undefined) {
            updateFields.push('source_opd_id = ?');
            updateValues.push(prevDist.target_opd_id);
            console.log(`   ✅ Auto-set source_opd_id from previous target: ${prevDist.target_opd_id}`);
          }
          
          // Always recalculate source_location from previous when direction changes
          updateFields.push('source_location = ?');
          updateValues.push(prevDist.specific_location);
          console.log(`   ✅ Auto-set source_location from previous target: ${prevDist.specific_location}`);
        } else if (direction === DIRECTION.WAREHOUSE_TO_OPD) {
          // For Gudang → OPD, source is always "Gudang Utama"
          updateFields.push('source_location = ?');
          updateValues.push('Gudang Utama');
          console.log(`   ✅ Auto-set source_location to "Gudang Utama" for ${DIRECTION.WAREHOUSE_TO_OPD}`);
        }
      } else {
        console.log('   ⚠️  No previous distribution found - cannot auto-recalculate source');
      }
      
      // ✅ CRITICAL FIX: AUTO-SET target fields when direction changes to/from "OPD → Gudang"
      if (direction === DIRECTION.OPD_TO_WAREHOUSE) {
        // Direction changed TO "OPD → Gudang"
        // Force set target_opd_id = NULL (karena tujuan adalah Gudang, bukan OPD)
        updateFields.push('target_opd_id = ?');
        updateValues.push(null);
        autoSetFields.add('target_opd_id');
        console.log(`   ✅ Auto-set target_opd_id to NULL for ${DIRECTION.OPD_TO_WAREHOUSE}`);
        
        // Force set specific_location = "Gudang Utama"
        updateFields.push('specific_location = ?');
        updateValues.push('Gudang Utama');
        autoSetFields.add('specific_location');
        console.log(`   ✅ Auto-set specific_location to "Gudang Utama" for ${DIRECTION.OPD_TO_WAREHOUSE}`);
      } else if (transaction.direction === DIRECTION.OPD_TO_WAREHOUSE && direction !== DIRECTION.OPD_TO_WAREHOUSE) {
        // Direction changed FROM "OPD → Gudang" to other direction
        // Now needs valid target_opd_id
        if (!target_opd_id) {
          await connection.rollback();
          connection.release();
          return res.status(400).json({
            error: '❌ OPD TUJUAN WAJIB DIISI',
            reason: `Direction berubah dari "${DIRECTION.OPD_TO_WAREHOUSE}" ke "${direction}"`,
            rule: 'Distribusi antar OPD atau dari Gudang ke OPD memerlukan OPD tujuan yang valid',
            solution: 'Pilih OPD tujuan terlebih dahulu',
            why: 'Item tidak lagi kembali ke Gudang, melainkan ke OPD tertentu'
          });
        }
        console.log(`   ✅ Validated target_opd_id for direction change from ${DIRECTION.OPD_TO_WAREHOUSE}`);
      }
    } else if (direction === undefined) {
      console.log('ℹ️  Direction not changed - skip source recalculation');
    }
    
    // BUSINESS LOGIC VALIDATION - SAME LOCATION
    // Prevent distributing item to the same exact location it's already at
    if (direction === DIRECTION.OPD_TO_OPD) {
      // For OPD → OPD, check if target location is same as current location
      if (target_opd_id && specific_location) {
        // Get current item location from previous distribution (where item is NOW)
        const [[currentItemLocation]] = await connection.query(`
          SELECT target_opd_id, specific_location, direction
          FROM distributions
          WHERE item_id = ? AND created_at < ?
          ORDER BY created_at DESC
          LIMIT 1
        `, [transaction.item_id, transaction.created_at]);
        
        if (currentItemLocation) {
          const sameOPD = currentItemLocation.target_opd_id === target_opd_id;
          const sameLocation = currentItemLocation.specific_location === specific_location;
          
          if (sameOPD && sameLocation) {
            await connection.rollback();
            connection.release();
            return res.status(400).json({ 
              error: `Konflik lokasi tujuan dengan lokasi saat ini`,
              reason: `Item sudah berada di lokasi yang Anda pilih`,
              rule: `Distribusi harus memindahkan item ke lokasi yang BERBEDA`,
              current_location: {
                opd_id: currentItemLocation.target_opd_id,
                location: currentItemLocation.specific_location
              },
              attempted_location: {
                opd_id: target_opd_id,
                location: specific_location
              },
              solution: `Pilih OPD atau lokasi yang berbeda dari lokasi item saat ini`,
              why: `Distribusi adalah proses PEMINDAHAN barang. Tidak ada gunanya "memindahkan" barang ke lokasi yang sama.`
            });
          }
        }
      }
    }
    
    // BUSINESS LOGIC VALIDATION - TARGET CONFLICT WITH NEXT DISTRIBUTION
    // Prevent target location from conflicting with next distribution's target
    if (target_opd_id !== undefined || specific_location !== undefined || direction !== undefined) {
      console.log('🔍 Checking target conflict...');
      
      const [[nextDist]] = await connection.query(`
        SELECT distribution_code, direction, target_opd_id, specific_location
        FROM distributions
        WHERE item_id = ? AND created_at > ?
        ORDER BY created_at ASC
        LIMIT 1
      `, [transaction.item_id, transaction.created_at]);
      
      if (nextDist) {
        console.log('   Current target_opd_id:', target_opd_id ?? transaction.target_opd_id);
        console.log('   Current specific_location:', specific_location ?? transaction.specific_location);
        console.log('   Current direction:', direction ?? transaction.direction);
        console.log('   Next dist:', nextDist);
        
        // Determine what the new target will be after this edit
        const newTargetOpdId = target_opd_id !== undefined ? target_opd_id : transaction.target_opd_id;
        const newSpecificLocation = specific_location !== undefined ? specific_location : transaction.specific_location;
        const newDirection = direction !== undefined ? direction : transaction.direction;
        
        // Check 1: Direct target conflict (same target location)
        if (newTargetOpdId !== null && newSpecificLocation !== null) {
          const sameOPD = nextDist.target_opd_id === newTargetOpdId;
          const sameLocation = nextDist.specific_location === newSpecificLocation;
          
          if (sameOPD && sameLocation) {
            await connection.rollback();
            connection.release();
            return res.status(400).json({ 
              error: `Konflik lokasi tujuan dengan distribusi berikutnya`,
              reason: `Lokasi tujuan yang Anda pilih sama dengan tujuan distribusi berikutnya`,
              rule: `Setiap distribusi harus memindahkan item ke lokasi yang berbeda`,
              next_distribution: {
                code: nextDist.distribution_code,
                target_location: newSpecificLocation
              },
              solution: `Pilih lokasi tujuan yang berbeda dari distribusi berikutnya`,
              why: `Untuk menjaga kejelasan alur pergerakan barang`
            });
          }
        }
        
        // Check 2: CASCADE conflict - check if next distribution can accept new source
        // If current ends at Gudang, next must be able to start from Gudang
        // If current ends at OPD, next must be able to start from OPD
        if (newDirection === DIRECTION.OPD_TO_WAREHOUSE) {
          // Current will end at Gudang, next source will be CASCADE'd to Gudang
          // Next direction MUST be "Gudang → OPD" or will become invalid
          // Check: if next target is also Gudang, it's impossible (Gudang → Gudang invalid)
          if (nextDist.target_opd_id === null && nextDist.specific_location === 'Gudang Utama') {
            await connection.rollback();
            connection.release();
            return res.status(400).json({
              error: `Konflik CASCADE dengan distribusi berikutnya`,
              reason: `Distribusi saat ini diubah agar berakhir di Gudang`,
              conflict: `Distribusi berikutnya (${nextDist.distribution_code}) juga berakhir di Gudang`,
              rule: `Tidak bisa ada distribusi "Gudang → Gudang" - item tidak bisa dari Gudang ke Gudang`,
              solution: `Ubah tujuan distribusi berikutnya ke OPD terlebih dahulu, atau ubah tujuan distribusi ini ke OPD`,
              why: `CASCADE akan mengubah source distribusi berikutnya menjadi Gudang, tapi targetnya juga Gudang - invalid`
            });
          }
        }
        
        console.log('   ✅ No target or cascade conflict');
      } else {
        console.log('   ℹ️  No next distribution - no conflict possible');
      }
    }
    
    // Update transaction record - support all fields
    // updateFields and updateValues already initialized at the top
    
    if (direction !== undefined) {
      updateFields.push('direction = ?');
      updateValues.push(direction);
    }
    
    if (source_opd_id !== undefined) {
      updateFields.push('source_opd_id = ?');
      updateValues.push(source_opd_id);
    }
    
    if (target_opd_id !== undefined && !autoSetFields.has('target_opd_id')) {
      updateFields.push('target_opd_id = ?');
      updateValues.push(target_opd_id);
    }
    
    if (specific_location !== undefined && !autoSetFields.has('specific_location')) {
      updateFields.push('specific_location = ?');
      updateValues.push(specific_location);
    }
    
    if (item_condition !== undefined) {
      updateFields.push('item_condition = ?');
      updateValues.push(item_condition);
    }
    
    if (notes !== undefined) {
      updateFields.push('notes = ?');
      updateValues.push(notes);
    }
    
    if (processed_by !== undefined) {
      updateFields.push('processed_by = ?');
      updateValues.push(processed_by);
    }
    
    if (distribution_date !== undefined) {
      updateFields.push('distribution_date = ?');
      updateValues.push(distribution_date);
    }
    
    if (updateFields.length > 0) {
      updateValues.push(distribution_code);
      const updateQuery = `UPDATE distributions SET ${updateFields.join(', ')} WHERE distribution_code = ?`;
      console.log('Update transaction query:', updateQuery);
      console.log('Update transaction values:', updateValues);
      
      const [result] = await connection.query(updateQuery, updateValues);
      console.log('Transaction update result:', result);
    }
    
    // NOTE: We do NOT update items.condition here
    // items.condition represents the INITIAL condition when item entered warehouse
    // Latest condition is tracked in distributions.item_condition
    
    // ✅ CRITICAL FIX: TIMELINE VALIDATION when direction changes to/from Gudang
    // Ensure next distribution is consistent with new direction
    if (direction && direction !== transaction.direction) {
      const [[nextDist]] = await connection.query(`
        SELECT distribution_code, direction, source_location, source_opd_id
        FROM distributions
        WHERE item_id = ? AND created_at > ?
        ORDER BY created_at ASC LIMIT 1
      `, [transaction.item_id, transaction.created_at]);

      if (nextDist) {
        console.log('📋 Next distribution found:', nextDist);
        console.log('   Current direction change:', transaction.direction, '→', direction);
        console.log('✅ Timeline validation passed - CASCADE will handle source and direction updates');
      }
    }
    
    // ✅ CASCADE UPDATE: Update next distribution's source to match current distribution's target
    // This ensures Rule 2 & 3: Next distribution's "asal" auto-updates after edit
    // CASCADE if: target changed, specific_location changed, OR direction changed
    const shouldCascade = target_opd_id !== undefined || 
                          specific_location !== undefined || 
                          (direction && direction !== transaction.direction);
    
    if (shouldCascade) {
      console.log('🔄 CASCADE CHECK: target/location/direction changed');
      const [[nextDist]] = await connection.query(`
        SELECT distribution_code, source_opd_id, source_location, direction
        FROM distributions
        WHERE item_id = ? AND created_at > ?
        ORDER BY created_at ASC LIMIT 1
      `, [transaction.item_id, transaction.created_at]);

      if (nextDist) {
        // Get the CURRENT transaction data after update to determine cascade values
        const [[updatedTrans]] = await connection.query(`
          SELECT target_opd_id, specific_location, direction
          FROM distributions
          WHERE distribution_code = ?
        `, [distribution_code]);
        
        // ✅ CRITICAL FIX: Determine cascade values based on CURRENT distribution's direction
        let cascadeSourceOpdId, cascadeSourceLocation;
        
        if (updatedTrans.direction === DIRECTION.OPD_TO_WAREHOUSE) {
          // Current dist ends at Gudang → Next dist source is Gudang
          cascadeSourceOpdId = null;
          cascadeSourceLocation = 'Gudang Utama';
          console.log(`🏢 CASCADE FROM GUDANG: Current dist is "${DIRECTION.OPD_TO_WAREHOUSE}"`);
        } else {
          // Current dist ends at OPD → Next dist source is that OPD
          cascadeSourceOpdId = updatedTrans.target_opd_id;
          cascadeSourceLocation = updatedTrans.specific_location;
          console.log(`🏢 CASCADE FROM OPD: Current dist ends at OPD ${cascadeSourceOpdId}`);
        }
        
        // ✅ CASCADE UPDATE: Always update next distribution when current changes
        // Build cascade update - update source and recalculate direction
        const cascadeFields = [];
        const cascadeValues = [];
        
        // Only update source_opd_id if it's different
        if (nextDist.source_opd_id !== cascadeSourceOpdId) {
          cascadeFields.push('source_opd_id = ?');
          cascadeValues.push(cascadeSourceOpdId);
        }
        
        // Only update source_location if it's different
        if (nextDist.source_location !== cascadeSourceLocation) {
          cascadeFields.push('source_location = ?');
          cascadeValues.push(cascadeSourceLocation);
        }
        
        // ✅ AUTO-RECALCULATE DIRECTION when source changes
        // Determine correct direction based on NEW source and existing target
        let newDirection;
        if (cascadeSourceOpdId === null && cascadeSourceLocation === 'Gudang Utama') {
          // Source is Gudang
          if (nextDist.direction === DIRECTION.OPD_TO_WAREHOUSE) {
            // This should never happen - can't go from Gudang to Gudang
            console.log('⚠️  WARNING: Next dist is OPD→Gudang but source is also Gudang!');
            newDirection = DIRECTION.WAREHOUSE_TO_OPD; // Force to valid direction
          } else {
            newDirection = DIRECTION.WAREHOUSE_TO_OPD;
          }
        } else {
          // Source is OPD
          if (nextDist.direction === DIRECTION.OPD_TO_WAREHOUSE) {
            newDirection = DIRECTION.OPD_TO_WAREHOUSE; // Keep OPD → Gudang
          } else {
            newDirection = DIRECTION.OPD_TO_OPD; // Change to OPD → OPD
          }
        }
        
        // Add direction to cascade update if it changed
        if (nextDist.direction !== newDirection) {
          cascadeFields.push('direction = ?');
          cascadeValues.push(newDirection);
          console.log(`📐 CASCADE DIRECTION: ${nextDist.direction} → ${newDirection}`);
        }
        
        // Only execute UPDATE if there are changes
        if (cascadeFields.length > 0) {
          cascadeValues.push(nextDist.distribution_code);
          await connection.query(`
            UPDATE distributions 
            SET ${cascadeFields.join(', ')}
            WHERE distribution_code = ?
          `, cascadeValues);
          
          console.log(`✅ CASCADE: Updated next distribution ${nextDist.distribution_code}`);
          console.log(`   Updated fields: ${cascadeFields.join(', ')}`);
          console.log(`   New source_opd_id: ${cascadeSourceOpdId}`);
          console.log(`   New source_location: ${cascadeSourceLocation}`);
          console.log(`   New direction: ${newDirection}`);
        } else {
          console.log(`ℹ️  No cascade needed - next distribution already correct`);
        }
      } else {
        console.log('ℹ️  No next distribution found - no cascade needed');
      }
    } else {
      console.log('ℹ️  No target changes - skip cascade check');
    }
    
    // ✅ CRITICAL: Always sync item location with the LATEST distribution after any update
    // This ensures item location is always accurate, regardless of which distribution was edited
    console.log('📍 Syncing item location with latest distribution...');
    
    const [[latestDistribution]] = await connection.query(`
      SELECT direction, target_opd_id, specific_location
      FROM distributions
      WHERE item_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `, [transaction.item_id]);
    
    if (latestDistribution) {
      let itemLocation, itemOpdId, itemSpecificLocation;
      
      console.log('Latest distribution direction:', latestDistribution.direction);
      
      if (latestDistribution.direction === DIRECTION.OPD_TO_WAREHOUSE) {
        // Latest distribution sends item to Gudang
        itemLocation = 'Gudang';
        itemOpdId = null;
        itemSpecificLocation = 'Gudang Utama';
        console.log('✅ Item is at GUDANG');
      } else if (latestDistribution.direction === DIRECTION.WAREHOUSE_TO_OPD || 
                 latestDistribution.direction === DIRECTION.OPD_TO_OPD) {
        // Latest distribution sends item to OPD
        itemLocation = 'OPD';
        itemOpdId = latestDistribution.target_opd_id;
        itemSpecificLocation = latestDistribution.specific_location;
        console.log('✅ Item is at OPD:', itemOpdId, itemSpecificLocation);
      }
      
      console.log('Updating items table:');
      console.log('  current_location:', itemLocation);
      console.log('  current_opd_id:', itemOpdId);
      console.log('  specific_location:', itemSpecificLocation);
      
      await connection.query(`
        UPDATE items
        SET current_location = ?,
            current_opd_id = ?,
            specific_location = ?
        WHERE id = ?
      `, [itemLocation, itemOpdId, itemSpecificLocation, transaction.item_id]);
      
      console.log('✅ Item location synced successfully');
    } else {
      console.log('⚠️  No distributions found for item');
    }
    
    await connection.commit();
    console.log('Transaction committed successfully');
    
    // Fetch updated transaction with joins
    const [[updatedTransaction]] = await connection.query(`
      SELECT 
        t.*,
        i.serial_number,
        i.brand,
        i.type,
        i.category_id,
        cat.name as category_name,
        source_opd.name as source_opd_name,
        target_opd.name as target_opd_name
      FROM distributions t
      LEFT JOIN items i ON t.item_id = i.id
      LEFT JOIN categories cat ON i.category_id = cat.id
      LEFT JOIN opds source_opd ON t.source_opd_id = source_opd.id
      LEFT JOIN opds target_opd ON t.target_opd_id = target_opd.id
      WHERE t.distribution_code = ?
    `, [distribution_code]);
    
    console.log('Updated transaction:', updatedTransaction);
    console.log('=== END UPDATE ===\n');
    
    res.json(updatedTransaction);
  } catch (error) {
    await connection.rollback();
    console.error('Error updating transaction:', error);
    res.status(500).json({ error: 'Internal server error: ' + error.message });
  } finally {
    connection.release();
  }
});

app.delete('/api/v1/distributions/:distribution_code', async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    // Get distribution info before deleting
    const [[distribution]] = await connection.query(
      'SELECT item_id, direction, created_at, distribution_date FROM distributions WHERE distribution_code = ?',
      [req.params.distribution_code]
    );
    
    if (!distribution) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ error: 'Distribution not found' });
    }
    
    const { item_id, created_at } = distribution;
    
    // BUSINESS LOGIC: Check if there are distributions AFTER this one
    // Deleting a distribution in the middle of history would break the timeline
    const [[nextDistribution]] = await connection.query(`
      SELECT distribution_code, distribution_date, direction
      FROM distributions
      WHERE item_id = ? AND created_at > ?
      ORDER BY created_at ASC
      LIMIT 1
    `, [item_id, created_at]);
    
    if (nextDistribution) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ 
        error: 'Tidak dapat menghapus distribusi',
        reason: 'Distribusi ini bukan distribusi terakhir. Hanya distribusi terakhir yang dapat dihapus untuk menjaga integritas riwayat pergerakan item.',
        next_distribution: `${nextDistribution.distribution_date} - ${nextDistribution.direction}`
      });
    }
    
    // Delete the distribution (only if it's the last one)
    await connection.query(
      'DELETE FROM distributions WHERE distribution_code = ?',
      [req.params.distribution_code]
    );
    
    // Get previous distribution (before the deleted one) to restore item location
    const [[previousDistribution]] = await connection.query(`
      SELECT direction, target_opd_id, specific_location, item_condition
      FROM distributions
      WHERE item_id = ?
      ORDER BY distribution_date DESC, created_at DESC
      LIMIT 1
    `, [item_id]);
    
    if (previousDistribution) {
      // Restore item to previous distribution's target location
      // NOTE: Do NOT update items.condition - it represents the INITIAL condition
      if (previousDistribution.direction === DIRECTION.OPD_TO_WAREHOUSE) {
        // Previous was return to warehouse
        await connection.query(`
          UPDATE items
          SET current_location = ?, current_opd_id = NULL, specific_location = ?
          WHERE id = ?
        `, [WAREHOUSE_LOCATION, previousDistribution.specific_location, item_id]);
      } else if (previousDistribution.direction === DIRECTION.WAREHOUSE_TO_OPD || previousDistribution.direction === DIRECTION.OPD_TO_OPD) {
        // Previous was to OPD
        await connection.query(`
          UPDATE items
          SET current_location = 'OPD', current_opd_id = ?, specific_location = ?
          WHERE id = ?
        `, [previousDistribution.target_opd_id, previousDistribution.specific_location, item_id]);
      }
    } else {
      // No previous distribution, restore item to initial warehouse state
      // NOTE: Do NOT update items.condition - it already has the initial condition
      await connection.query(`
        UPDATE items
        SET current_location = ?, current_opd_id = NULL, specific_location = NULL
        WHERE id = ?
      `, [WAREHOUSE_LOCATION, item_id]);
    }
    
    await connection.commit();
    res.status(204).send();
  } catch (error) {
    await connection.rollback();
    console.error('Error deleting transaction:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    connection.release();
  }
});

// OPDs API
app.get('/api/v1/opds', async (req, res) => {
  try {
    const [opds] = await pool.query('SELECT * FROM opds WHERE is_active = TRUE ORDER BY name');
    res.json(opds);
  } catch (error) {
    console.error('Error fetching OPDs:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/v1/opds', async (req, res) => {
  try {
    const id = uuidv4();
    const { name, description, pic, address, phone } = req.body;
    
    // Check if OPD name already exists
    const [[existing]] = await pool.query('SELECT id FROM opds WHERE name = ? AND is_active = TRUE', [name]);
    if (existing) {
      return res.status(400).json({ error: 'Nama OPD sudah ada. Gunakan nama yang berbeda.' });
    }
    
    await pool.query(`
      INSERT INTO opds (id, name, description, pic, address, phone, is_active)
      VALUES (?, ?, ?, ?, ?, ?, TRUE)
    `, [id, name, description || null, pic || null, address || null, phone || null]);
    
    const [[newOpd]] = await pool.query('SELECT * FROM opds WHERE id = ?', [id]);
    
    res.status(201).json(newOpd);
  } catch (error) {
    console.error('Error creating OPD:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/v1/opds/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, pic, address, phone } = req.body;
    
    // Check if OPD name already exists (excluding current OPD)
    const [[existing]] = await pool.query('SELECT id FROM opds WHERE name = ? AND id != ? AND is_active = TRUE', [name, id]);
    if (existing) {
      return res.status(400).json({ error: 'Nama OPD sudah ada. Gunakan nama yang berbeda.' });
    }
    
    await pool.query(`
      UPDATE opds SET name = ?, description = ?, pic = ?, address = ?, phone = ? WHERE id = ?
    `, [name, description || null, pic || null, address || null, phone || null, id]);
    
    const [[updatedOpd]] = await pool.query('SELECT * FROM opds WHERE id = ?', [id]);
    
    if (!updatedOpd) {
      return res.status(404).json({ error: 'OPD not found' });
    }
    
    res.json(updatedOpd);
  } catch (error) {
    console.error('Error updating OPD:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/v1/opds/:id', async (req, res) => {
  try {
    // Soft delete: set is_active to FALSE and append timestamp to name to avoid unique constraint
    const timestamp = Date.now();
    const result = await pool.query(
      'UPDATE opds SET is_active = FALSE, name = CONCAT(name, "_deleted_", ?) WHERE id = ?',
      [timestamp, req.params.id]
    );
    
    if (result[0].affectedRows === 0) {
      return res.status(404).json({ error: 'OPD not found' });
    }
    
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting OPD:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Categories API
app.get('/api/v1/categories', async (req, res) => {
  try {
    const [categories] = await pool.query('SELECT * FROM categories WHERE is_active = TRUE ORDER BY name');
    res.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/v1/categories', async (req, res) => {
  try {
    const id = uuidv4();
    const { name } = req.body;
    
    // Check if category name already exists
    const [[existing]] = await pool.query('SELECT id FROM categories WHERE name = ? AND is_active = TRUE', [name]);
    if (existing) {
      return res.status(400).json({ error: 'Nama kategori sudah ada. Gunakan nama yang berbeda.' });
    }
    
    await pool.query(`
      INSERT INTO categories (id, name, is_active)
      VALUES (?, ?, TRUE)
    `, [id, name]);
    
    const [[newCategory]] = await pool.query('SELECT * FROM categories WHERE id = ?', [id]);
    
    res.status(201).json(newCategory);
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/v1/categories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    
    // Check if category name already exists (excluding current category)
    const [[existing]] = await pool.query('SELECT id FROM categories WHERE name = ? AND id != ? AND is_active = TRUE', [name, id]);
    if (existing) {
      return res.status(400).json({ error: 'Nama kategori sudah ada. Gunakan nama yang berbeda.' });
    }
    
    await pool.query(`
      UPDATE categories SET name = ? WHERE id = ?
    `, [name, id]);
    
    const [[updatedCategory]] = await pool.query('SELECT * FROM categories WHERE id = ?', [id]);
    
    if (!updatedCategory) {
      return res.status(404).json({ error: 'Category not found' });
    }
    
    res.json(updatedCategory);
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/v1/categories/:id', async (req, res) => {
  try {
    // Soft delete: set is_active to FALSE and append timestamp to name to avoid unique constraint
    const timestamp = Date.now();
    const result = await pool.query(
      'UPDATE categories SET is_active = FALSE, name = CONCAT(name, "_deleted_", ?) WHERE id = ?',
      [timestamp, req.params.id]
    );
    
    if (result[0].affectedRows === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }
    
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Brands API
app.get('/api/v1/brands', async (req, res) => {
  try {
    const { category_id } = req.query;
    let query = 'SELECT * FROM brands WHERE is_active = TRUE';
    const params = [];
    
    if (category_id) {
      query += ' AND category_id = ?';
      params.push(category_id);
    }
    
    query += ' ORDER BY name';
    const [brands] = await pool.query(query, params);
    res.json(brands);
  } catch (error) {
    console.error('Error fetching brands:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/v1/brands', async (req, res) => {
  try {
    const id = uuidv4();
    const { category_id, name } = req.body;
    
    // Check if brand name already exists in this category
    const [[existing]] = await pool.query('SELECT id FROM brands WHERE category_id = ? AND name = ? AND is_active = TRUE', [category_id, name]);
    if (existing) {
      return res.status(400).json({ error: 'Nama merek sudah ada di kategori ini. Gunakan nama yang berbeda.' });
    }
    
    await pool.query(`
      INSERT INTO brands (id, category_id, name, is_active)
      VALUES (?, ?, ?, TRUE)
    `, [id, category_id, name]);
    
    const [[newBrand]] = await pool.query('SELECT * FROM brands WHERE id = ?', [id]);
    
    res.status(201).json(newBrand);
  } catch (error) {
    console.error('Error creating brand:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/v1/brands/:id', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    const { id } = req.params;
    const { name } = req.body;
    
    console.log(`[Brand Update] Updating brand ${id} to name: ${name}`);
    
    // Get current brand to check category_id and old name
    const [[currentBrand]] = await connection.query('SELECT category_id, name FROM brands WHERE id = ?', [id]);
    if (!currentBrand) {
      await connection.rollback();
      console.log(`[Brand Update] Brand ${id} not found`);
      return res.status(404).json({ error: 'Brand not found' });
    }
    
    const oldBrandName = currentBrand.name;
    console.log(`[Brand Update] Old brand name: ${oldBrandName}, Category: ${currentBrand.category_id}`);
    
    // Check if brand name already exists in this category (excluding current brand)
    const [[existing]] = await connection.query('SELECT id FROM brands WHERE category_id = ? AND name = ? AND id != ? AND is_active = TRUE', [currentBrand.category_id, name, id]);
    if (existing) {
      await connection.rollback();
      console.log(`[Brand Update] Brand name ${name} already exists in category`);
      return res.status(400).json({ error: 'Nama merek sudah ada di kategori ini. Gunakan nama yang berbeda.' });
    }
    
    // Update brand name
    await connection.query('UPDATE brands SET name = ? WHERE id = ?', [name, id]);
    console.log(`[Brand Update] Brand name updated in brands table`);
    
    // Auto-sync: Update all items that use this brand
    const [updateResult] = await connection.query(
      'UPDATE items SET brand = ? WHERE brand = ? AND category_id = ?',
      [name, oldBrandName, currentBrand.category_id]
    );
    console.log(`[Brand Update] Updated ${updateResult.affectedRows} items with new brand name`);
    
    await connection.commit();
    console.log(`[Brand Update] Transaction committed successfully`);
    
    const [[updatedBrand]] = await pool.query('SELECT * FROM brands WHERE id = ?', [id]);
    
    res.json(updatedBrand);
  } catch (error) {
    await connection.rollback();
    console.error('[Brand Update] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    connection.release();
  }
});

app.delete('/api/v1/brands/:id', async (req, res) => {
  try {
    // Soft delete: set is_active to FALSE and append timestamp to name to avoid unique constraint
    const timestamp = Date.now();
    const result = await pool.query(
      'UPDATE brands SET is_active = FALSE, name = CONCAT(name, "_deleted_", ?) WHERE id = ?',
      [timestamp, req.params.id]
    );
    
    if (result[0].affectedRows === 0) {
      return res.status(404).json({ error: 'Brand not found' });
    }
    
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting brand:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Types API
app.get('/api/v1/types', async (req, res) => {
  try {
    const { brand_id } = req.query;
    let query = 'SELECT * FROM types WHERE is_active = TRUE';
    const params = [];
    
    if (brand_id) {
      query += ' AND brand_id = ?';
      params.push(brand_id);
    }
    
    query += ' ORDER BY name';
    const [types] = await pool.query(query, params);
    res.json(types);
  } catch (error) {
    console.error('Error fetching types:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/v1/types', async (req, res) => {
  try {
    const id = uuidv4();
    const { brand_id, name } = req.body;
    
    // Check if type name already exists in this brand
    const [[existing]] = await pool.query('SELECT id FROM types WHERE brand_id = ? AND name = ? AND is_active = TRUE', [brand_id, name]);
    if (existing) {
      return res.status(400).json({ error: 'Nama tipe sudah ada di merek ini. Gunakan nama yang berbeda.' });
    }
    
    await pool.query(`
      INSERT INTO types (id, brand_id, name, is_active)
      VALUES (?, ?, ?, TRUE)
    `, [id, brand_id, name]);
    
    const [[newType]] = await pool.query('SELECT * FROM types WHERE id = ?', [id]);
    
    res.status(201).json(newType);
  } catch (error) {
    console.error('Error creating type:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/v1/types/:id', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    const { id } = req.params;
    const { name } = req.body;
    
    // Get current type to check brand_id and old name
    const [[currentType]] = await connection.query('SELECT brand_id, name FROM types WHERE id = ?', [id]);
    if (!currentType) {
      await connection.rollback();
      return res.status(404).json({ error: 'Type not found' });
    }
    
    const oldTypeName = currentType.name;
    
    // Get brand info to match items
    const [[brand]] = await connection.query('SELECT name, category_id FROM brands WHERE id = ?', [currentType.brand_id]);
    
    // Check if type name already exists in this brand (excluding current type)
    const [[existing]] = await connection.query('SELECT id FROM types WHERE brand_id = ? AND name = ? AND id != ? AND is_active = TRUE', [currentType.brand_id, name, id]);
    if (existing) {
      await connection.rollback();
      return res.status(400).json({ error: 'Nama tipe sudah ada di merek ini. Gunakan nama yang berbeda.' });
    }
    
    // Update type name
    await connection.query('UPDATE types SET name = ? WHERE id = ?', [name, id]);
    
    // Auto-sync: Update all items that use this type with this brand
    if (brand) {
      await connection.query(
        'UPDATE items SET type = ? WHERE type = ? AND brand = ? AND category_id = ?',
        [name, oldTypeName, brand.name, brand.category_id]
      );
    }
    
    await connection.commit();
    
    const [[updatedType]] = await pool.query('SELECT * FROM types WHERE id = ?', [id]);
    
    res.json(updatedType);
  } catch (error) {
    await connection.rollback();
    console.error('Error updating type:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    connection.release();
  }
});

app.delete('/api/v1/types/:id', async (req, res) => {
  try {
    // Soft delete: set is_active to FALSE and append timestamp to name to avoid unique constraint
    const timestamp = Date.now();
    const result = await pool.query(
      'UPDATE types SET is_active = FALSE, name = CONCAT(name, "_deleted_", ?) WHERE id = ?',
      [timestamp, req.params.id]
    );
    
    if (result[0].affectedRows === 0) {
      return res.status(404).json({ error: 'Type not found' });
    }
    
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting type:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// OPD Locations API
app.get('/api/v1/opds/:opdId/locations', async (req, res) => {
  try {
    const { opdId } = req.params;
    const [locations] = await pool.query(
      'SELECT * FROM opd_locations WHERE opd_id = ? AND is_active = TRUE ORDER BY location_name',
      [opdId]
    );
    res.json(locations);
  } catch (error) {
    console.error('Error fetching OPD locations:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/v1/opds/:opdId/locations', async (req, res) => {
  try {
    const { opdId } = req.params;
    const id = uuidv4();
    const { location_name, description, pic, contact, bandwidth, address } = req.body;
    
    // Check if location name already exists in this OPD
    const [[existing]] = await pool.query('SELECT id FROM opd_locations WHERE opd_id = ? AND location_name = ? AND is_active = TRUE', [opdId, location_name]);
    if (existing) {
      return res.status(400).json({ error: 'Nama lokasi sudah ada di OPD ini. Gunakan nama yang berbeda.' });
    }
    
    await pool.query(`
      INSERT INTO opd_locations (id, opd_id, location_name, description, pic, contact, bandwidth, address, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, TRUE)
    `, [id, opdId, location_name, description || null, pic || null, contact || null, bandwidth || null, address || null]);
    
    const [[newLocation]] = await pool.query('SELECT * FROM opd_locations WHERE id = ?', [id]);
    
    res.status(201).json(newLocation);
  } catch (error) {
    console.error('Error creating OPD location:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/v1/opds/:opdId/locations/:id', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    const { opdId, id } = req.params;
    const { location_name, description, pic, contact, bandwidth, address } = req.body;
    
    // Get old location name
    const [[currentLocation]] = await connection.query('SELECT location_name FROM opd_locations WHERE id = ?', [id]);
    if (!currentLocation) {
      await connection.rollback();
      return res.status(404).json({ error: 'OPD location not found' });
    }
    
    const oldLocationName = currentLocation.location_name;
    
    // Check if location name already exists in this OPD (excluding current location)
    const [[existing]] = await connection.query('SELECT id FROM opd_locations WHERE opd_id = ? AND location_name = ? AND id != ? AND is_active = TRUE', [opdId, location_name, id]);
    if (existing) {
      await connection.rollback();
      return res.status(400).json({ error: 'Nama lokasi sudah ada di OPD ini. Gunakan nama yang berbeda.' });
    }
    
    // Update location
    await connection.query(
      'UPDATE opd_locations SET location_name = ?, description = ?, pic = ?, contact = ?, bandwidth = ?, address = ? WHERE id = ? AND opd_id = ?',
      [location_name, description || null, pic || null, contact || null, bandwidth || null, address || null, id, opdId]
    );
    
    // Auto-sync: Update items and distributions that reference this location
    await connection.query(
      'UPDATE items SET specific_location = ? WHERE specific_location = ?',
      [location_name, oldLocationName]
    );
    
    await connection.query(
      'UPDATE distributions SET specific_location = ? WHERE specific_location = ?',
      [location_name, oldLocationName]
    );
    
    await connection.query(
      'UPDATE distributions SET source_location = ? WHERE source_location = ?',
      [location_name, oldLocationName]
    );
    
    await connection.commit();
    
    const [[updatedLocation]] = await pool.query('SELECT * FROM opd_locations WHERE id = ?', [id]);
    
    res.json(updatedLocation);
  } catch (error) {
    await connection.rollback();
    console.error('Error updating OPD location:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    connection.release();
  }
});

app.delete('/api/v1/opds/:opdId/locations/:id', async (req, res) => {
  try {
    const { opdId, id } = req.params;
    // Soft delete: set is_active to FALSE and append timestamp to location_name to avoid unique constraint
    const timestamp = Date.now();
    const result = await pool.query(
      'UPDATE opd_locations SET is_active = FALSE, location_name = CONCAT(location_name, "_deleted_", ?) WHERE id = ? AND opd_id = ?',
      [timestamp, id, opdId]
    );
    
    if (result[0].affectedRows === 0) {
      return res.status(404).json({ error: 'OPD location not found' });
    }
    
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting OPD location:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Reset all data
app.post('/api/v1/reset', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    // Delete in order to respect foreign key constraints
    await connection.query('DELETE FROM distributions');
    await connection.query('DELETE FROM items');
    await connection.query('DELETE FROM opds');
    await connection.query('DELETE FROM categories');
    
    // Reset auto_increment counters
    await connection.query('ALTER TABLE distributions AUTO_INCREMENT = 1');
    await connection.query('ALTER TABLE items AUTO_INCREMENT = 1');
    await connection.query('ALTER TABLE opds AUTO_INCREMENT = 1');
    await connection.query('ALTER TABLE categories AUTO_INCREMENT = 1');
    
    await connection.commit();
    res.json({ 
      success: true, 
      message: 'All data has been reset successfully' 
    });
  } catch (error) {
    await connection.rollback();
    console.error('Error resetting data:', error);
    res.status(500).json({ error: 'Failed to reset data' });
  } finally {
    connection.release();
  }
});

// Constants API - untuk frontend
app.get('/api/v1/constants', (req, res) => {
  res.json({
    WAREHOUSE_LOCATION,
    DIRECTION
  });
});

// Sync Master Data - Initial sync untuk data yang sudah ada
app.post('/api/v1/sync-master-data', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    let totalSynced = 0;
    const syncReport = {
      brands: 0,
      types: 0,
      locations: 0
    };
    
    console.log('[Sync Master Data] Starting initial sync...');
    
    // 1. Sync all brands - NO ACTION NEEDED
    // Items already store brand names, sync happens on brand update
    
    // 2. Sync all types - NO ACTION NEEDED  
    // Items already store type names, sync happens on type update
    
    // 3. Sync all locations - this needs sync because location structure might change
    const [locations] = await connection.query(`
      SELECT l.id, l.name as location_name, o.id as opd_id 
      FROM locations l 
      JOIN opds o ON l.opd_id = o.id 
      WHERE l.is_active = TRUE
    `);
    
    for (const loc of locations) {
      // Sync items
      const [itemResult] = await connection.query(
        'UPDATE items SET specific_location = ? WHERE specific_location = ? AND opd_id = ?',
        [loc.location_name, loc.location_name, loc.opd_id]
      );
      
      // Sync distributions
      const [distResult] = await connection.query(
        'UPDATE distributions SET specific_location = ? WHERE specific_location = ? AND opd_id = ?',
        [loc.location_name, loc.location_name, loc.opd_id]
      );
      
      syncReport.locations += itemResult.affectedRows + distResult.affectedRows;
    }
    
    await connection.commit();
    console.log('[Sync Master Data] Sync completed:', syncReport);
    
    res.json({ 
      success: true, 
      message: 'Master data synchronized successfully',
      synced: syncReport
    });
  } catch (error) {
    await connection.rollback();
    console.error('[Sync Master Data] Error:', error);
    res.status(500).json({ error: 'Failed to sync master data' });
  } finally {
    connection.release();
  }
});

// Start server
async function startServer() {
  await testConnection();
  
  app.listen(PORT, () => {
    console.log(`✓ Warehouse Management System API server running on port ${PORT}`);
    console.log(`✓ Health check: http://localhost:${PORT}/health`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
