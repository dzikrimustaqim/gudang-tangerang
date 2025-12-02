const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json());

// Simple file-based storage
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR);
}

const getDataFile = (entity) => path.join(DATA_DIR, `${entity}.json`);

const readData = (entity) => {
  try {
    const data = fs.readFileSync(getDataFile(entity), 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
};

const writeData = (entity, data) => {
  fs.writeFileSync(getDataFile(entity), JSON.stringify(data, null, 2));
};

// Initialize sample data
const initializeData = () => {
  // Categories
  const categories = [
    {
      id: '1',
      name: 'Laptop',
      description: 'Komputer portable untuk kebutuhan kerja mobile',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: '2', 
      name: 'Printer',
      description: 'Perangkat cetak untuk kebutuhan administrasi',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: '3',
      name: 'Router',
      description: 'Perangkat jaringan untuk koneksi internet',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: '4',
      name: 'CCTV',
      description: 'Sistem keamanan dan pengawasan',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ];

  // OPDs
  const opds = [
    {
      id: '1',
      name: 'Dinas Komunikasi dan Informatika',
      description: 'Pengelola sistem informasi dan komunikasi',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: '2',
      name: 'Dinas Kesehatan',
      description: 'Pelayanan kesehatan masyarakat',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: '3',
      name: 'Dinas Pendidikan dan Kebudayaan',
      description: 'Pengelola pendidikan dan kebudayaan daerah',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ];

  // Items
  const items = [
    {
      id: '1',
      serial_number: 'LT-001-2024',
      category_id: '1',
      brand: 'Dell',
      model: 'Latitude 5520',
      condition: 'Layak Pakai',
      description: 'Laptop untuk keperluan administrasi',
      entry_date: '2024-01-15T00:00:00Z',
      current_location: 'OPD',
      current_opd_id: '1',
      specific_location: 'Ruang IT',
      is_active: true
    },
    {
      id: '2', 
      serial_number: 'PR-045-2024',
      category_id: '2',
      brand: 'HP',
      model: 'LaserJet Pro M404n',
      condition: 'Layak Pakai',
      description: 'Printer laser monokrom',
      entry_date: '2024-02-10T00:00:00Z',
      current_location: 'Gudang',
      specific_location: 'Rak A-2',
      is_active: true
    },
    {
      id: '3',
      serial_number: 'RT-023-2024', 
      category_id: '3',
      brand: 'Cisco',
      model: 'ISR 4331',
      condition: 'Rusak Ringan',
      description: 'Router untuk jaringan utama',
      entry_date: '2024-03-05T00:00:00Z',
      current_location: 'OPD',
      current_opd_id: '2',
      specific_location: 'Server Room',
      is_active: true
    }
  ];

  // Transactions
  const transactions = [
    {
      id: '1',
      item_id: '1',
      direction: 'Gudang → OPD',
      target_opd_id: '1',
      specific_location: 'Ruang IT',
      notes: 'Pengiriman untuk keperluan upgrade sistem',
      transaction_date: new Date().toISOString(),
      processed_by: 'Admin Gudang'
    },
    {
      id: '2',
      item_id: '2', 
      direction: 'OPD → Gudang',
      source_opd_id: '2',
      specific_location: 'Rak A-2',
      notes: 'Pengembalian setelah selesai proyek',
      transaction_date: new Date().toISOString(),
      processed_by: 'Staff IT'
    }
  ];

  // Write initial data if files don't exist
  if (readData('categories').length === 0) writeData('categories', categories);
  if (readData('opds').length === 0) writeData('opds', opds);
  if (readData('items').length === 0) writeData('items', items);
  if (readData('transactions').length === 0) writeData('transactions', transactions);
};

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Dashboard API
app.get('/api/v1/dashboard/summary', (req, res) => {
  const items = readData('items');
  const transactions = readData('transactions');
  
  const summary = {
    total_items: items.length,
    items_in_warehouse: items.filter(item => item.current_location === 'Gudang').length,
    items_in_opd: items.filter(item => item.current_location === 'OPD').length,
    total_transactions: transactions.length,
    items_by_condition: {
      'Layak Pakai': items.filter(item => item.condition === 'Layak Pakai').length,
      'Rusak Ringan': items.filter(item => item.condition === 'Rusak Ringan').length,
      'Rusak/Hilang': items.filter(item => item.condition === 'Rusak/Hilang').length
    },
    items_by_category: [],
    items_by_opd: []
  };
  
  res.json(summary);
});

app.get('/api/v1/dashboard/recent-transactions', (req, res) => {
  const transactions = readData('transactions');
  const items = readData('items');
  const categories = readData('categories');
  const opds = readData('opds');
  
  const enrichedTransactions = transactions.slice(0, 10).map(transaction => {
    const item = items.find(i => i.id === transaction.item_id);
    const category = item ? categories.find(c => c.id === item.category_id) : null;
    const sourceOpd = transaction.source_opd_id ? opds.find(o => o.id === transaction.source_opd_id) : null;
    const targetOpd = transaction.target_opd_id ? opds.find(o => o.id === transaction.target_opd_id) : null;
    
    return {
      ...transaction,
      item: item ? { ...item, category } : null,
      source_opd: sourceOpd,
      target_opd: targetOpd
    };
  });
  
  res.json(enrichedTransactions);
});

// Items API
app.get('/api/v1/items', (req, res) => {
  const items = readData('items');
  const categories = readData('categories');
  const opds = readData('opds');
  
  const enrichedItems = items.map(item => {
    const category = categories.find(c => c.id === item.category_id);
    const currentOpd = item.current_opd_id ? opds.find(o => o.id === item.current_opd_id) : null;
    
    return {
      ...item,
      category,
      current_opd: currentOpd
    };
  });
  
  res.json({
    data: enrichedItems,
    total_count: enrichedItems.length
  });
});

app.post('/api/v1/items', (req, res) => {
  const items = readData('items');
  const newItem = {
    id: uuidv4(),
    ...req.body,
    entry_date: new Date().toISOString(),
    current_location: 'Gudang',
    is_active: true
  };
  
  items.push(newItem);
  writeData('items', items);
  
  res.status(201).json(newItem);
});

app.get('/api/v1/items/:id', (req, res) => {
  const items = readData('items');
  const item = items.find(i => i.id === req.params.id);
  
  if (!item) {
    return res.status(404).json({ error: 'Item not found' });
  }
  
  res.json(item);
});

app.put('/api/v1/items/:id', (req, res) => {
  const items = readData('items');
  const index = items.findIndex(i => i.id === req.params.id);
  
  if (index === -1) {
    return res.status(404).json({ error: 'Item not found' });
  }
  
  items[index] = { ...items[index], ...req.body };
  writeData('items', items);
  
  res.json(items[index]);
});

app.delete('/api/v1/items/:id', (req, res) => {
  const items = readData('items');
  const filteredItems = items.filter(i => i.id !== req.params.id);
  
  if (items.length === filteredItems.length) {
    return res.status(404).json({ error: 'Item not found' });
  }
  
  writeData('items', filteredItems);
  res.status(204).send();
});

app.get('/api/v1/items/search', (req, res) => {
  const items = readData('items');
  const query = req.query.q?.toLowerCase() || '';
  
  const filteredItems = items.filter(item => 
    item.serial_number.toLowerCase().includes(query) ||
    item.brand.toLowerCase().includes(query) ||
    item.model.toLowerCase().includes(query)
  );
  
  res.json(filteredItems);
});

// Distributions API
app.get('/api/v1/distributions', (req, res) => {
  const transactions = readData('transactions');
  const items = readData('items');
  const categories = readData('categories');
  const opds = readData('opds');
  
  const enrichedTransactions = transactions.map(transaction => {
    const item = items.find(i => i.id === transaction.item_id);
    const category = item ? categories.find(c => c.id === item.category_id) : null;
    const sourceOpd = transaction.source_opd_id ? opds.find(o => o.id === transaction.source_opd_id) : null;
    const targetOpd = transaction.target_opd_id ? opds.find(o => o.id === transaction.target_opd_id) : null;
    
    return {
      ...transaction,
      item: item ? { ...item, category } : null,
      source_opd: sourceOpd,
      target_opd: targetOpd
    };
  });
  
  res.json({
    data: enrichedTransactions,
    total_count: enrichedTransactions.length
  });
});

app.post('/api/v1/distributions', (req, res) => {
  const transactions = readData('transactions');
  const items = readData('items');
  
  const newTransaction = {
    id: uuidv4(),
    ...req.body,
    transaction_date: new Date().toISOString()
  };
  
  // Update item location based on transaction
  const itemIndex = items.findIndex(i => i.id === req.body.item_id);
  if (itemIndex !== -1) {
    if (req.body.direction === 'Gudang → OPD') {
      items[itemIndex].current_location = 'OPD';
      items[itemIndex].current_opd_id = req.body.target_opd_id;
    } else if (req.body.direction === 'OPD → Gudang') {
      items[itemIndex].current_location = 'Gudang';
      items[itemIndex].current_opd_id = null;
    } else if (req.body.direction === 'OPD → OPD') {
      items[itemIndex].current_opd_id = req.body.target_opd_id;
    }
    items[itemIndex].specific_location = req.body.specific_location;
    
    writeData('items', items);
  }
  
  transactions.push(newTransaction);
  writeData('transactions', transactions);
  
  res.status(201).json(newTransaction);
});

app.put('/api/v1/distributions/:id', (req, res) => {
  const transactions = readData('transactions');
  const index = transactions.findIndex(t => t.id === req.params.id);
  
  if (index === -1) {
    return res.status(404).json({ error: 'Transaction not found' });
  }
  
  transactions[index] = { ...transactions[index], ...req.body };
  writeData('transactions', transactions);
  
  res.json(transactions[index]);
});

app.delete('/api/v1/distributions/:id', (req, res) => {
  const transactions = readData('transactions');
  const filteredTransactions = transactions.filter(t => t.id !== req.params.id);
  
  if (transactions.length === filteredTransactions.length) {
    return res.status(404).json({ error: 'Transaction not found' });
  }
  
  writeData('transactions', filteredTransactions);
  res.status(204).send();
});

// OPDs API
app.get('/api/v1/opds', (req, res) => {
  const opds = readData('opds');
  res.json(opds);
});

app.post('/api/v1/opds', (req, res) => {
  const opds = readData('opds');
  const newOpd = {
    id: uuidv4(),
    ...req.body,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  
  opds.push(newOpd);
  writeData('opds', opds);
  
  res.status(201).json(newOpd);
});

app.put('/api/v1/opds/:id', (req, res) => {
  const opds = readData('opds');
  const index = opds.findIndex(o => o.id === req.params.id);
  
  if (index === -1) {
    return res.status(404).json({ error: 'OPD not found' });
  }
  
  opds[index] = { 
    ...opds[index], 
    ...req.body,
    updated_at: new Date().toISOString()
  };
  writeData('opds', opds);
  
  res.json(opds[index]);
});

app.delete('/api/v1/opds/:id', (req, res) => {
  const opds = readData('opds');
  const filteredOpds = opds.filter(o => o.id !== req.params.id);
  
  if (opds.length === filteredOpds.length) {
    return res.status(404).json({ error: 'OPD not found' });
  }
  
  writeData('opds', filteredOpds);
  res.status(204).send();
});

// Categories API
app.get('/api/v1/categories', (req, res) => {
  const categories = readData('categories');
  res.json(categories);
});

app.post('/api/v1/categories', (req, res) => {
  const categories = readData('categories');
  const newCategory = {
    id: uuidv4(),
    ...req.body,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  
  categories.push(newCategory);
  writeData('categories', categories);
  
  res.status(201).json(newCategory);
});

app.put('/api/v1/categories/:id', (req, res) => {
  const categories = readData('categories');
  const index = categories.findIndex(c => c.id === req.params.id);
  
  if (index === -1) {
    return res.status(404).json({ error: 'Category not found' });
  }
  
  categories[index] = { 
    ...categories[index], 
    ...req.body,
    updated_at: new Date().toISOString()
  };
  writeData('categories', categories);
  
  res.json(categories[index]);
});

app.delete('/api/v1/categories/:id', (req, res) => {
  const categories = readData('categories');
  const filteredCategories = categories.filter(c => c.id !== req.params.id);
  
  if (categories.length === filteredCategories.length) {
    return res.status(404).json({ error: 'Category not found' });
  }
  
  writeData('categories', filteredCategories);
  res.status(204).send();
});

// Initialize sample data on startup
initializeData();

// Start server
app.listen(PORT, () => {
  console.log(`Warehouse Management System API server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});