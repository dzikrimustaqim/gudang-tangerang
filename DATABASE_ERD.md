# Entity Relationship Diagram - Sistem Manajemen Gudang

## 📊 Database: warehouse_db

### Overview Structure

```
warehouse_db
├── Master Data Tables
│   ├── categories (Kategori)
│   ├── brands (Merek)
│   ├── types (Tipe)
│   ├── opds (Organisasi Perangkat Daerah)
│   └── opd_locations (Lokasi OPD)
│
├── Operational Tables
│   ├── items (Item/Inventaris)
│   └── distributions (Distribusi)
│
└── Relationships
    ├── Hierarchical (1:N with cascade)
    ├── Reference (1:N with restrict)
    └── Tracking (1:N with set null)
```

## 🗂️ Complete ERD Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        ENTITY RELATIONSHIP DIAGRAM                              │
│                           warehouse_db Schema                                   │
└─────────────────────────────────────────────────────────────────────────────────┘


┌──────────────────────────────┐
│       categories             │
│──────────────────────────────│
│ PK  id           VARCHAR(36) │───┐
│     name         VARCHAR(255)│   │
│     is_active    BOOLEAN     │   │
│     created_at   TIMESTAMP   │   │
│     updated_at   TIMESTAMP   │   │
└──────────────────────────────┘   │
                                   │ 1
                                   │
                                   │ category_id (FK)
                                   │
                                   │ N
┌──────────────────────────────┐   │
│         brands               │   │
│──────────────────────────────│   │
│ PK  id           VARCHAR(36) │◄──┘
│ FK  category_id  VARCHAR(36) │───┐
│     name         VARCHAR(255)│   │
│     is_active    BOOLEAN     │   │
│     created_at   TIMESTAMP   │   │
│     updated_at   TIMESTAMP   │   │
└──────────────────────────────┘   │
    │                              │ 1
    │ CASCADE DELETE               │
    │ ON DELETE CASCADE            │ brand_id (FK)
    │                              │
    │                              │ N
    │                        ┌──────────────────────────────┐
    │                        │         types                │
    │                        │──────────────────────────────│
    │                        │ PK  id           VARCHAR(36) │
    │                        │ FK  brand_id     VARCHAR(36) │◄──┘
    │                        │     name         VARCHAR(255)│
    │                        │     is_active    BOOLEAN     │
    │                        │     created_at   TIMESTAMP   │
    │                        │     updated_at   TIMESTAMP   │
    │                        └──────────────────────────────┘
    │                            │
    │ CASCADE DELETE             │ CASCADE DELETE
    │ ON DELETE CASCADE          │ ON DELETE CASCADE
    │                            │
    └────────────────────────────┘


┌──────────────────────────────┐
│           opds               │
│──────────────────────────────│
│ PK  id           VARCHAR(36) │───┐
│     name         VARCHAR(255)│   │
│     description  TEXT        │   │
│     pic          VARCHAR(255)│   │
│     address      TEXT        │   │
│     phone        VARCHAR(50) │   │
│     is_active    BOOLEAN     │   │
│     created_at   TIMESTAMP   │   │
│     updated_at   TIMESTAMP   │   │
└──────────────────────────────┘   │
    │                              │ 1
    │                              │
    │                              │ opd_id (FK)
    │                              │
    │                              │ N
    │                        ┌──────────────────────────────┐
    │                        │     opd_locations            │
    │                        │──────────────────────────────│
    │                        │ PK  id           VARCHAR(36) │
    │                        │ FK  opd_id       VARCHAR(36) │◄──┘
    │                        │     location_name VARCHAR(255)│
    │                        │     description  TEXT        │
    │                        │     pic          VARCHAR(255)│
    │                        │     contact      VARCHAR(255)│
    │                        │     bandwidth    VARCHAR(255)│
    │                        │     address      TEXT        │
    │                        │     is_active    BOOLEAN     │
    │                        │     created_at   TIMESTAMP   │
    │                        │     updated_at   TIMESTAMP   │
    │                        └──────────────────────────────┘
    │
    │ CASCADE DELETE
    │ ON DELETE CASCADE
    │
    └────────────────────────────────────────────────────────────┐
                                                                 │
                                                                 │
┌──────────────────────────────────────────────────────────┐     │
│                    items                                 │     │
│──────────────────────────────────────────────────────────│     │
│ PK  id                VARCHAR(36)                        │     │
│     serial_number     VARCHAR(255) UNIQUE NOT NULL       │     │
│ FK  category_id       VARCHAR(36)  ───────────┐          │     │
│     brand             VARCHAR(255)            │          │     │
│     type              VARCHAR(255)            │          │     │
│     condition         ENUM('Layak Pakai',     │          │     │
│                            'Rusak Ringan',    │          │     │
│                            'Rusak/Hilang')    │          │     │
│     description       TEXT                    │          │     │
│     entry_date        TIMESTAMP NOT NULL      │          │     │
│     current_location  ENUM('Gudang', 'OPD')   │          │     │
│ FK  current_opd_id    VARCHAR(36)  ───────────┼──────────┼─────┘
│     specific_location VARCHAR(255)            │          │
│     is_active         BOOLEAN DEFAULT TRUE    │          │
│     created_at        TIMESTAMP               │          │
│     updated_at        TIMESTAMP               │          │
└───────────────────────────────────────────────┘          │
    │                                                      │
    │ RESTRICT DELETE                                      │
    │ ON DELETE RESTRICT                                   │
    │ (Cannot delete category if items exist)              │
    │                                                      │
    └──────────────────────────────────────────────────────┘
    │
    │ 1
    │
    │ item_id (FK)
    │
    │ N
    │
┌───▼───────────────────────────────────────────────────────┐
│                  distributions                            │
│───────────────────────────────────────────────────────────│
│ PK  distribution_code VARCHAR(10)                         │
│ FK  item_id           VARCHAR(36) ────────────────────┐   │
│     direction         ENUM('Gudang → OPD',            │   │
│                            'OPD → Gudang',            │   │
│                            'OPD → OPD')               │   │
│ FK  source_opd_id     VARCHAR(36) ─────────┐          │   │
│     source_location   VARCHAR(255) NOT NULL│          │   │
│ FK  target_opd_id     VARCHAR(36) ─────────┼──────────┼───┼──┐
│     specific_location VARCHAR(255) NOT NULL│          │   │  │
│     item_condition    ENUM('Layak Pakai',  │          │   │  │
│                            'Rusak Ringan', │          │   │  │
│                            'Rusak/Hilang') │          │   │  │
│     notes             TEXT                 │          │   │  │
│     distribution_date TIMESTAMP NOT NULL   │          │   │  │
│     processed_by      VARCHAR(255) NOT NULL│          │   │  │
│     created_at        TIMESTAMP            │          │   │  │
│     updated_at        TIMESTAMP            │          │   │  │
└────────────────────────────────────────────┘          │   │  │
                                                        │   │  │
    CASCADE DELETE                                      │   │  │
    ON DELETE CASCADE                                   │   │  │
    (Delete item → Delete all distributions)            │   │  │
                                                        │   │  │
    SET NULL                                            │   │  │
    ON DELETE SET NULL                                  │   │  │
    (Delete OPD → Set source_opd_id to NULL)            │   │  │
                                                        │   │  │
    ┌───────────────────────────────────────────────────┘   │  │
    │                                                       │  │
    │ REFERENCES items(id)                                  │  │
    │                                                       │  │
    │   ┌───────────────────────────────────────────────────┘  │
    │   │                                                      │
    │   │ REFERENCES opds(id)                                  │
    │   │                                                      │
    │   │   ┌──────────────────────────────────────────────────┘
    │   │   │
    │   │   │ REFERENCES opds(id)
    │   │   │
    ▼   ▼   ▼
  items opds opds
  (FK)  (FK) (FK)
```

## 📋 Table Details

### 1. categories (Kategori Item)

```
┌──────────────────────────────────────────────────────┐
│ Table: categories                                    │
├──────────────────────────────────────────────────────┤
│ Column          │ Type          │ Constraints        │
├─────────────────┼───────────────┼────────────────────┤
│ id              │ VARCHAR(36)   │ PRIMARY KEY        │
│ name            │ VARCHAR(255)  │ UNIQUE, NOT NULL   │
│ is_active       │ BOOLEAN       │ DEFAULT TRUE       │
│ created_at      │ TIMESTAMP     │ DEFAULT CURRENT    │
│ updated_at      │ TIMESTAMP     │ AUTO UPDATE        │
└──────────────────────────────────────────────────────┘

Indexes:
  - PRIMARY KEY (id)
  - UNIQUE KEY (name)
  - INDEX idx_name (name)
  - INDEX idx_is_active (is_active)

Relationships:
  - 1:N → brands (category_id)
  - Restrict Delete if brands exist

Business Rules:
  - Name must be unique
  - Cannot delete if has brands
  - Soft delete via is_active
```

### 2. brands (Merek per Kategori)

```
┌──────────────────────────────────────────────────────┐
│ Table: brands                                        │
├──────────────────────────────────────────────────────┤
│ Column          │ Type          │ Constraints        │
├─────────────────┼───────────────┼────────────────────┤
│ id              │ VARCHAR(36)   │ PRIMARY KEY        │
│ category_id     │ VARCHAR(36)   │ FOREIGN KEY, NOT NULL │
│ name            │ VARCHAR(255)  │ NOT NULL           │
│ is_active       │ BOOLEAN       │ DEFAULT TRUE       │
│ created_at      │ TIMESTAMP     │ DEFAULT CURRENT    │
│ updated_at      │ TIMESTAMP     │ AUTO UPDATE        │
└──────────────────────────────────────────────────────┘

Indexes:
  - PRIMARY KEY (id)
  - INDEX idx_category_id (category_id)
  - INDEX idx_name (name)
  - INDEX idx_is_active (is_active)
  - UNIQUE KEY unique_brand_per_category (category_id, name)

Relationships:
  - N:1 → categories (category_id)
  - 1:N → types (brand_id)
  - CASCADE DELETE when category deleted

Business Rules:
  - Brand name must be unique per category
  - Same brand name can exist in different categories
  - Deleting category deletes all its brands
```

### 3. types (Tipe per Merek)

```
┌──────────────────────────────────────────────────────┐
│ Table: types                                         │
├──────────────────────────────────────────────────────┤
│ Column          │ Type          │ Constraints        │
├─────────────────┼───────────────┼────────────────────┤
│ id              │ VARCHAR(36)   │ PRIMARY KEY        │
│ brand_id        │ VARCHAR(36)   │ FOREIGN KEY, NOT NULL │
│ name            │ VARCHAR(255)  │ NOT NULL           │
│ is_active       │ BOOLEAN       │ DEFAULT TRUE       │
│ created_at      │ TIMESTAMP     │ DEFAULT CURRENT    │
│ updated_at      │ TIMESTAMP     │ AUTO UPDATE        │
└──────────────────────────────────────────────────────┘

Indexes:
  - PRIMARY KEY (id)
  - INDEX idx_brand_id (brand_id)
  - INDEX idx_name (name)
  - INDEX idx_is_active (is_active)
  - UNIQUE KEY unique_type_per_brand (brand_id, name)

Relationships:
  - N:1 → brands (brand_id)
  - CASCADE DELETE when brand deleted

Business Rules:
  - Type name must be unique per brand
  - Same type name can exist in different brands
  - Deleting brand deletes all its types
  - Deleting category cascades to types
```

### 4. opds (Organisasi Perangkat Daerah)

```
┌──────────────────────────────────────────────────────┐
│ Table: opds                                          │
├──────────────────────────────────────────────────────┤
│ Column          │ Type          │ Constraints        │
├─────────────────┼───────────────┼────────────────────┤
│ id              │ VARCHAR(36)   │ PRIMARY KEY        │
│ name            │ VARCHAR(255)  │ UNIQUE, NOT NULL   │
│ description     │ TEXT          │                    │
│ pic             │ VARCHAR(255)  │                    │
│ address         │ TEXT          │                    │
│ phone           │ VARCHAR(50)   │                    │
│ is_active       │ BOOLEAN       │ DEFAULT TRUE       │
│ created_at      │ TIMESTAMP     │ DEFAULT CURRENT    │
│ updated_at      │ TIMESTAMP     │ AUTO UPDATE        │
└──────────────────────────────────────────────────────┘

Indexes:
  - PRIMARY KEY (id)
  - UNIQUE KEY (name)
  - INDEX idx_name (name)
  - INDEX idx_is_active (is_active)

Relationships:
  - 1:N → opd_locations (opd_id)
  - 1:N → items (current_opd_id) - SET NULL on delete
  - 1:N → distributions (source_opd_id) - SET NULL on delete
  - 1:N → distributions (target_opd_id) - SET NULL on delete

Business Rules:
  - OPD name must be unique
  - Can have multiple locations
  - Deleting OPD cascades to locations
  - Items and distributions keep data but lose OPD reference
```

### 5. opd_locations (Lokasi di OPD)

```
┌──────────────────────────────────────────────────────┐
│ Table: opd_locations                                 │
├──────────────────────────────────────────────────────┤
│ Column          │ Type          │ Constraints        │
├─────────────────┼───────────────┼────────────────────┤
│ id              │ VARCHAR(36)   │ PRIMARY KEY        │
│ opd_id          │ VARCHAR(36)   │ FOREIGN KEY, NOT NULL │
│ location_name   │ VARCHAR(255)  │ NOT NULL           │
│ description     │ TEXT          │                    │
│ pic             │ VARCHAR(255)  │                    │
│ contact         │ VARCHAR(255)  │                    │
│ bandwidth       │ VARCHAR(255)  │                    │
│ address         │ TEXT          │                    │
│ is_active       │ BOOLEAN       │ DEFAULT TRUE       │
│ created_at      │ TIMESTAMP     │ DEFAULT CURRENT    │
│ updated_at      │ TIMESTAMP     │ AUTO UPDATE        │
└──────────────────────────────────────────────────────┘

Indexes:
  - PRIMARY KEY (id)
  - INDEX idx_opd_id (opd_id)
  - INDEX idx_is_active (is_active)
  - UNIQUE KEY unique_location_per_opd (opd_id, location_name)

Relationships:
  - N:1 → opds (opd_id)
  - CASCADE DELETE when OPD deleted

Business Rules:
  - Location name must be unique per OPD
  - Same location name can exist in different OPDs
  - Stores detailed contact and infrastructure info
```

### 6. items (Item/Inventaris)

```
┌──────────────────────────────────────────────────────┐
│ Table: items                                         │
├──────────────────────────────────────────────────────┤
│ Column            │ Type          │ Constraints      │
├───────────────────┼───────────────┼──────────────────┤
│ id                │ VARCHAR(36)   │ PRIMARY KEY      │
│ serial_number     │ VARCHAR(255)  │ UNIQUE, NOT NULL │
│ category_id       │ VARCHAR(36)   │ FOREIGN KEY, NOT NULL │
│ brand             │ VARCHAR(255)  │ NOT NULL         │
│ type              │ VARCHAR(255)  │ NOT NULL         │
│ condition         │ ENUM          │ NOT NULL, DEFAULT │
│ description       │ TEXT          │                  │
│ entry_date        │ TIMESTAMP     │ NOT NULL         │
│ current_location  │ ENUM          │ NOT NULL, DEFAULT │
│ current_opd_id    │ VARCHAR(36)   │ FOREIGN KEY, NULL │
│ specific_location │ VARCHAR(255)  │                  │
│ is_active         │ BOOLEAN       │ DEFAULT TRUE     │
│ created_at        │ TIMESTAMP     │ DEFAULT CURRENT  │
│ updated_at        │ TIMESTAMP     │ AUTO UPDATE      │
└──────────────────────────────────────────────────────┘

Enums:
  - condition: 'Layak Pakai', 'Rusak Ringan', 'Rusak/Hilang'
  - current_location: 'Gudang', 'OPD'

Indexes:
  - PRIMARY KEY (id)
  - UNIQUE KEY (serial_number)
  - INDEX idx_serial_number (serial_number)
  - INDEX idx_category_id (category_id)
  - INDEX idx_current_location (current_location)
  - INDEX idx_current_opd_id (current_opd_id)
  - INDEX idx_condition (condition)
  - INDEX idx_is_active (is_active)

Relationships:
  - N:1 → categories (category_id) - RESTRICT delete
  - N:1 → opds (current_opd_id) - SET NULL on delete
  - 1:N → distributions (item_id) - CASCADE delete

Business Rules:
  - Serial number must be globally unique
  - Must have valid category
  - Cannot delete category if items exist
  - Current location tracks real-time position
  - Entry date = first time in gudang
  - Condition tracks current state
```

### 7. distributions (Distribusi/Pergerakan Item)

```
┌──────────────────────────────────────────────────────┐
│ Table: distributions                                 │
├──────────────────────────────────────────────────────┤
│ Column            │ Type          │ Constraints      │
├───────────────────┼───────────────┼──────────────────┤
│ distribution_code │ VARCHAR(10)   │ PRIMARY KEY      │
│ item_id           │ VARCHAR(36)   │ FOREIGN KEY, NOT NULL │
│ direction         │ ENUM          │ NOT NULL         │
│ source_opd_id     │ VARCHAR(36)   │ FOREIGN KEY, NULL │
│ source_location   │ VARCHAR(255)  │ NOT NULL         │
│ target_opd_id     │ VARCHAR(36)   │ FOREIGN KEY, NULL │
│ specific_location │ VARCHAR(255)  │ NOT NULL         │
│ item_condition    │ ENUM          │ NOT NULL         │
│ notes             │ TEXT          │                  │
│ distribution_date │ TIMESTAMP     │ NOT NULL         │
│ processed_by      │ VARCHAR(255)  │ NOT NULL         │
│ created_at        │ TIMESTAMP     │ DEFAULT CURRENT  │
│ updated_at        │ TIMESTAMP     │ AUTO UPDATE      │
└──────────────────────────────────────────────────────┘

Enums:
  - direction: 'Gudang → OPD', 'OPD → Gudang', 'OPD → OPD'
  - item_condition: 'Layak Pakai', 'Rusak Ringan', 'Rusak/Hilang'

Indexes:
  - PRIMARY KEY (distribution_code)
  - INDEX idx_item_id (item_id)
  - INDEX idx_distribution_date (distribution_date)
  - INDEX idx_direction (direction)
  - INDEX idx_source_opd_id (source_opd_id)
  - INDEX idx_target_opd_id (target_opd_id)

Constraints:
  - CHECK (specific_location IS NOT NULL AND specific_location != '')
  - CHECK (source_location IS NOT NULL AND source_location != '')

Relationships:
  - N:1 → items (item_id) - CASCADE delete
  - N:1 → opds (source_opd_id) - SET NULL on delete
  - N:1 → opds (target_opd_id) - SET NULL on delete

Business Rules:
  - distribution_code is 6-char alphanumeric (auto-generated)
  - Timeline-based: created_at tracks chronological order
  - Only latest distribution can be deleted (timeline integrity)
  - First distribution must be "Gudang → OPD"
  - Tracks item condition at time of distribution
  - Records who processed the distribution
```

## 🔗 Relationship Summary

### Hierarchical Relationships (1:N with CASCADE)

```
categories
    └─► brands (ON DELETE CASCADE)
        └─► types (ON DELETE CASCADE)

opds
    └─► opd_locations (ON DELETE CASCADE)

items
    └─► distributions (ON DELETE CASCADE)
```

### Reference Relationships (1:N with RESTRICT)

```
categories
    └─► items (ON DELETE RESTRICT)
    
Cannot delete category if items exist
Must delete items first or reassign category
```

### Tracking Relationships (1:N with SET NULL)

```
opds
    ├─► items.current_opd_id (ON DELETE SET NULL)
    ├─► distributions.source_opd_id (ON DELETE SET NULL)
    └─► distributions.target_opd_id (ON DELETE SET NULL)
    
Deleting OPD keeps historical data but removes reference
```

## 📊 Cardinality Details

```
┌────────────────────────────────────────────────────────┐
│ Relationship              │ Cardinality │ Delete Rule  │
├───────────────────────────┼─────────────┼──────────────┤
│ categories → brands       │    1:N      │ CASCADE      │
│ brands → types            │    1:N      │ CASCADE      │
│ opds → opd_locations      │    1:N      │ CASCADE      │
│ categories → items        │    1:N      │ RESTRICT     │
│ items → distributions     │    1:N      │ CASCADE      │
│ opds → items              │    1:N      │ SET NULL     │
│ opds → distributions (src)│    1:N      │ SET NULL     │
│ opds → distributions (tgt)│    1:N      │ SET NULL     │
└────────────────────────────────────────────────────────┘
```

## 🎯 Key Features

### 1. Hierarchical Master Data
- **3-Level Hierarchy**: Category → Brand → Type
- **Cascade Delete**: Deleting parent removes all children
- **Unique Constraints**: Name unique per parent level

### 2. Location Tracking
- **Real-time**: items.current_location always accurate
- **Historical**: distributions preserves timeline
- **Multi-location**: OPDs can have multiple locations

### 3. Data Integrity
- **Foreign Keys**: Enforce referential integrity
- **Constraints**: Prevent invalid data
- **Indexes**: Optimize query performance
- **ENUM Types**: Restrict to valid values

### 4. Timeline Management
- **created_at**: Chronological order (immutable)
- **distribution_date**: User-specified date (editable)
- **Timeline Validation**: Only latest can be deleted

### 5. Soft Delete Support
- **is_active**: Flag for soft delete
- **Preservation**: Keep data for audit trail
- **Filtering**: Queries filter by is_active

## 📈 Database Statistics

```
┌─────────────────────────────────────────────┐
│ Table            │ Typical Size │ Growth   │
├──────────────────┼──────────────┼──────────┤
│ categories       │ 10-50 rows   │ Low      │
│ brands           │ 50-200 rows  │ Low      │
│ types            │ 200-1000 rows│ Medium   │
│ opds             │ 20-100 rows  │ Low      │
│ opd_locations    │ 100-500 rows │ Medium   │
│ items            │ 1000-50000   │ High     │
│ distributions    │ 5000-500000  │ Very High│
└─────────────────────────────────────────────┘
```

## 🔍 Common Queries

### Query 1: Get Item with Full Hierarchy

```sql
SELECT 
    i.serial_number,
    c.name as category,
    i.brand,
    i.type,
    i.condition,
    i.current_location,
    o.name as opd_name,
    i.specific_location
FROM items i
INNER JOIN categories c ON i.category_id = c.id
LEFT JOIN opds o ON i.current_opd_id = o.id
WHERE i.id = ?;
```

### Query 2: Get Distribution History

```sql
SELECT 
    d.distribution_code,
    d.direction,
    d.distribution_date,
    so.name as source_opd,
    d.source_location,
    to.name as target_opd,
    d.specific_location,
    d.item_condition,
    d.processed_by
FROM distributions d
LEFT JOIN opds so ON d.source_opd_id = so.id
LEFT JOIN opds to ON d.target_opd_id = to.id
WHERE d.item_id = ?
ORDER BY d.created_at DESC;
```

### Query 3: Dashboard Statistics

```sql
-- Total items per location
SELECT 
    current_location,
    COUNT(*) as total
FROM items
WHERE is_active = TRUE
GROUP BY current_location;

-- Items per category
SELECT 
    c.name as category,
    COUNT(i.id) as total_items
FROM categories c
LEFT JOIN items i ON c.id = i.category_id AND i.is_active = TRUE
GROUP BY c.id, c.name
ORDER BY total_items DESC;

-- Distributions per month
SELECT 
    DATE_FORMAT(distribution_date, '%Y-%m') as month,
    COUNT(*) as total_distributions
FROM distributions
GROUP BY month
ORDER BY month DESC;
```

---

**Database Version**: MariaDB 11.2  
**Schema Version**: 2.0  
**Last Updated**: 2 Desember 2025  
**Total Tables**: 7  
**Character Set**: utf8mb4  
**Collation**: utf8mb4_unicode_ci
