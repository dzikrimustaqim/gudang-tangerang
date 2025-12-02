# Arsitektur Teknis Sistem Manajemen Gudang

## 🏛️ Arsitektur Umum

Sistem Manajemen Gudang menggunakan **arsitektur 3-tier** dengan containerization Docker:

```
┌─────────────────────────────────────────────────────┐
│                  PRESENTATION LAYER                 │
│              (React SPA - Port 80)                  │
│                                                     │
│  • React 18 + TypeScript                            │
│  • Tailwind CSS + Shadcn/UI                         │
│  • Vite (Build Tool)                                │
│  • Nginx (Static Files + Reverse Proxy)             │
└──────────────────┬──────────────────────────────────┘
                   │ HTTP/JSON
                   ▼
┌─────────────────────────────────────────────────────┐
│                 APPLICATION LAYER                   │
│            (Node.js API - Port 8080)                │
│                                                     │
│  • Express.js REST API                              │
│  • Business Logic Layer                             │
│  • Validation & Error Handling                      │
│  • Connection Pool Management                       │
└──────────────────┬──────────────────────────────────┘
                   │ MySQL Protocol
                   ▼
┌─────────────────────────────────────────────────────┐
│                   DATA LAYER                        │
│           (MariaDB 11.2 - Port 3306)                │
│                                                     │
│  • Relational Database                              │
│  • Foreign Key Constraints                          │
│  • Transactions & ACID Compliance                   │
│  • Indexed Queries                                  │
└─────────────────────────────────────────────────────┘
```

## 📦 Docker Container Architecture

### Container Orchestration

```
┌────────────────────────────────────────────────┐
│            Docker Compose Stack                │
├────────────────────────────────────────────────┤
│                                                │
│  ┌──────────────────────────────────────────┐  │
│  │    gudang_web (Nginx)                    │  │
│  │    Image: nginx:alpine                   │  │
│  │    Port: 80 → 80                         │  │
│  │    Depends: gudang_app                   │  │
│  └──────────────────────────────────────────┘  │
│                     │                          │
│                     ▼                          │
│  ┌──────────────────────────────────────────┐  │
│  │    gudang_app (Node.js)                  │  │
│  │    Image: node:20-alpine                 │  │
│  │    Port: 8080 → 8080 (internal)          │  │
│  │    Depends: gudang_db                    │  │
│  └──────────────────────────────────────────┘  │
│                     │                          │
│                     ▼                          │
│  ┌──────────────────────────────────────────┐  │
│  │    gudang_db (MariaDB)                   │  │
│  │    Image: mariadb:11.2                   │  │
│  │    Port: 3306 → 3306 (dev only)          │  │
│  │    Volume: gudang_db_data                │  │
│  └──────────────────────────────────────────┘  │
│                                                │
│  Network: gudang_network (bridge)              │
│                                                │
└────────────────────────────────────────────────┘
```

### Startup Sequence

```
1. docker-compose up -d
   │
   ├─► Pull/Build Images
   │   ├─► mariadb:11.2
   │   ├─► node:20-alpine
   │   └─► nginx:alpine
   │
   ├─► Create Network (gudang_network)
   │
   ├─► Create Volume (gudang_db_data)
   │
   └─► Start Containers (ordered by depends_on)
       │
       ├─► 1. gudang_db
       │   ├─► Run init-db.sql (first time)
       │   ├─► Create tables
       │   ├─► Health check: mysqladmin ping
       │   └─► Ready ✓
       │
       ├─► 2. gudang_app (waits for db)
       │   ├─► Run docker-entrypoint.sh
       │   ├─► Wait for database connection
       │   ├─► Start Express server
       │   ├─► Health check: GET /health
       │   └─► Ready ✓
       │
       └─► 3. gudang_web (waits for app)
           ├─► Copy static files
           ├─► Load nginx.conf
           ├─► Start nginx
           ├─► Health check: wget localhost
           └─► Ready ✓

Application accessible at http://localhost
```

## 🗄️ Database Schema

### Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────┐
│                  DATABASE SCHEMA                    │
│                 (warehouse_db)                      │
└─────────────────────────────────────────────────────┘

┌──────────────┐
│  categories  │
│──────────────│       ┌──────────────┐
│ id (PK)      │◄──────┤    brands    │
│ name         │       │──────────────│       ┌──────────────┐
│ is_active    │       │ id (PK)      │◄──────┤    types     │
│ created_at   │       │ category_id  │       │──────────────│
│ updated_at   │       │ name         │       │ id (PK)      │
└──────────────┘       │ is_active    │       │ brand_id     │
                       │ created_at   │       │ name         │
                       │ updated_at   │       │ is_active    │
                       └──────────────┘       │ created_at   │
                                             │ updated_at   │
                                             └──────────────┘

┌──────────────┐
│     opds     │
│──────────────│       ┌───────────────────┐
│ id (PK)      │◄──────┤  opd_locations    │
│ name         │       │───────────────────│
│ description  │       │ id (PK)           │
│ pic          │       │ opd_id (FK)       │
│ address      │       │ location_name     │
│ phone        │       │ description       │
│ is_active    │       │ pic               │
│ created_at   │       │ contact           │
│ updated_at   │       │ bandwidth         │
└──────────────┘       │ address           │
                       │ is_active         │
                       │ created_at        │
                       │ updated_at        │
                       └───────────────────┘

┌──────────────────────┐
│        items         │
│──────────────────────│       ┌─────────────────────┐
│ id (PK)              │◄──────┤   distributions     │
│ serial_number        │       │─────────────────────│
│ category_id (FK)     │       │ distribution_code   │
│ brand                │       │ item_id (FK)        │
│ type                 │       │ direction           │
│ condition            │       │ source_opd_id (FK)  │
│ description          │       │ source_location     │
│ entry_date           │       │ target_opd_id (FK)  │
│ current_location     │       │ specific_location   │
│ current_opd_id (FK)  │       │ item_condition      │
│ specific_location    │       │ notes               │
│ is_active            │       │ distribution_date   │
│ created_at           │       │ processed_by        │
│ updated_at           │       │ created_at          │
└──────────────────────┘       │ updated_at          │
                               └─────────────────────┘

Relationships:
• categories 1:N brands (cascade delete)
• brands 1:N types (cascade delete)
• opds 1:N opd_locations (cascade delete)
• categories 1:N items (restrict delete)
• items 1:N distributions (cascade delete)
• opds 1:N items (set null on delete)
• opds 1:N distributions (set null on delete)
```

### Key Tables Detail

#### 1. Categories Hierarchy

```sql
categories
├─► brands (category_id FK)
    ├─► types (brand_id FK)
    
Indexes:
- PRIMARY KEY (id)
- UNIQUE (name)
- INDEX (is_active)

Constraints:
- Cascade delete: Delete category → Delete all brands → Delete all types
```

#### 2. Items Table

```sql
CREATE TABLE items (
    id VARCHAR(36) PRIMARY KEY,
    serial_number VARCHAR(255) UNIQUE NOT NULL,
    category_id VARCHAR(36) FK → categories(id),
    brand VARCHAR(255) NOT NULL,
    type VARCHAR(255) NOT NULL,
    condition ENUM('Layak Pakai', 'Rusak Ringan', 'Rusak/Hilang'),
    description TEXT,
    entry_date TIMESTAMP NOT NULL,
    current_location ENUM('Gudang', 'OPD') DEFAULT 'Gudang',
    current_opd_id VARCHAR(36) FK → opds(id),
    specific_location VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE
);

Indexes:
- PRIMARY KEY (id)
- UNIQUE (serial_number)
- INDEX (category_id, current_location, condition)
```

#### 3. Distributions Table

```sql
CREATE TABLE distributions (
    distribution_code VARCHAR(10) PRIMARY KEY,
    item_id VARCHAR(36) FK → items(id),
    direction ENUM('Gudang → OPD', 'OPD → Gudang', 'OPD → OPD'),
    source_opd_id VARCHAR(36) FK → opds(id),
    source_location VARCHAR(255) NOT NULL,
    target_opd_id VARCHAR(36) FK → opds(id),
    specific_location VARCHAR(255) NOT NULL,
    item_condition ENUM('Layak Pakai', 'Rusak Ringan', 'Rusak/Hilang'),
    notes TEXT,
    distribution_date TIMESTAMP NOT NULL,
    processed_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

Indexes:
- PRIMARY KEY (distribution_code)
- INDEX (item_id, created_at)
- INDEX (distribution_date, direction)

Constraints:
- CHECK (specific_location != '')
- CHECK (source_location != '')
- Cascade delete when item deleted
```

## 🔌 API Architecture

### RESTful API Endpoints

```
┌────────────────────────────────────────────────┐
│              API STRUCTURE                     │
│         /api/v1/                               │
├────────────────────────────────────────────────┤
│                                                │
│  MASTER DATA                                   │
│  ├─► /categories                               │
│  │   ├─► GET    / (list all)                   │
│  │   ├─► POST   / (create)                     │
│  │   ├─► PUT    /:id (update)                  │
│  │   └─► DELETE /:id (delete + cascade)        │
│  │                                             │
│  ├─► /brands                                   │
│  │   ├─► GET    / (list all)                   │
│  │   ├─► GET    /category/:categoryId          │
│  │   ├─► POST   / (create)                     │
│  │   ├─► PUT    /:id (update)                  │
│  │   └─► DELETE /:id (delete + cascade)        │
│  │                                             │
│  ├─► /types                                    │
│  │   ├─► GET    / (list all)                   │
│  │   ├─► GET    /brand/:brandId                │
│  │   ├─► POST   / (create)                     │
│  │   ├─► PUT    /:id (update)                  │
│  │   └─► DELETE /:id (delete)                  │
│  │                                             │
│  ├─► /opds                                     │
│  │   ├─► GET    / (list all)                   │
│  │   ├─► POST   / (create)                     │
│  │   ├─► PUT    /:id (update)                  │
│  │   └─► DELETE /:id (delete + cascade)        │
│  │                                             │
│  └─► /opd-locations                            │
│      ├─► GET    / (list all)                   │
│      ├─► GET    /opd/:opdId                    │
│      ├─► POST   / (create)                     │
│      ├─► PUT    /:id (update)                  │
│      └─► DELETE /:opdId/:id (delete)           │
│                                                │
│  INVENTORY                                     │
│  └─► /items                                    │
│      ├─► GET    / (list + pagination)          │
│      ├─► GET    /:id (detail)                  │
│      ├─► POST   / (create)                     │
│      ├─► PUT    /:id (update)                  │
│      └─► DELETE /:id (delete + cascade dist)   │
│                                                │
│  DISTRIBUTIONS                                 │
│  └─► /distributions                            │
│      ├─► GET    / (list + filters)             │
│      ├─► GET    /:code (detail)                │
│      ├─► POST   / (create + validate)          │
│      ├─► PUT    /:code (update + validate)     │
│      └─► DELETE /:code (delete if last)        │
│                                                │
│  ANALYTICS                                     │
│  ├─► /dashboard/overview                       │
│  ├─► /dashboard/category-distribution          │
│  ├─► /dashboard/opd-distribution               │
│  └─► /dashboard/condition-analysis             │
│                                                │
│  UTILITIES                                     │
│  ├─► /data/integrity (validation)              │
│  ├─► /reset/items                              │
│  ├─► /reset/distributions                      │
│  └─► /reset/all                                │
│                                                │
│  HEALTH                                        │
│  └─► /health (database ping)                   │
│                                                │
└────────────────────────────────────────────────┘
```

### Request Flow Detail

```
┌─────────────────────────────────────────────────┐
│         HTTP REQUEST LIFECYCLE                  │
└─────────────────────────────────────────────────┘

1. Browser → Nginx (Port 80)
   │
   ├─► Static files (/, /assets/*)
   │   └─► Serve from /usr/share/nginx/html
   │
   └─► API calls (/api/*, /health)
       │
       └─► Proxy to gudang_app:8080
           │
2. Express Middleware Chain
   │
   ├─► CORS (allow origins)
   ├─► JSON body parser
   ├─► Route matching
   │
3. Route Handler
   │
   ├─► Validate request (params, body, query)
   ├─► Extract data
   │
4. Business Logic Layer
   │
   ├─► Apply business rules
   ├─► Validate timeline (for distributions)
   ├─► Check constraints
   │
5. Database Layer
   │
   ├─► Get connection from pool
   ├─► Begin transaction (if needed)
   ├─► Execute query
   ├─► Commit/rollback
   ├─► Release connection
   │
6. Response Formatting
   │
   ├─► Format data to JSON
   ├─► Set HTTP status code
   ├─► Add headers
   │
7. Send Response
   │
   └─► Nginx → Browser
```

### Business Logic Examples

#### Example 1: Create Distribution (Gudang → OPD)

```javascript
POST /api/v1/distributions

Business Logic Flow:
┌─────────────────────────────────────────┐
│  1. Validate Input                      │
│     ├─► item_id exists?                 │
│     ├─► target_opd_id exists?           │
│     └─► direction valid?                │
│                                         │
│  2. Get Item Current Status             │
│     ├─► Query items table               │
│     ├─► Check current_location          │
│     └─► Verify item in gudang           │
│                                         │
│  3. Validate Business Rules             │
│     ├─► Item must be in gudang          │
│     ├─► Target OPD must be active       │
│     └─► Location must exist             │
│                                         │
│  4. Generate Distribution Code          │
│     └─► 6-char alphanumeric (A3B9K2)    │
│                                         │
│  5. Begin Transaction                   │
│     ├─► Insert distribution record      │
│     │   - source_location = "Gudang"    │
│     │   - target_opd_id = selected      │
│     │   - item_condition = from form    │
│     │                                   │
│     └─► Update items table              │
│         ├─► current_location = "OPD"    │
│         ├─► current_opd_id = target     │
│         └─► specific_location = target  │
│                                         │
│  6. Commit Transaction                  │
│                                         │
│  7. Return Success Response             │
│     └─► distribution_code, details      │
└─────────────────────────────────────────┘
```

#### Example 2: Delete Distribution (Timeline Check)

```javascript
DELETE /api/v1/distributions/:code

Business Logic Flow:
┌─────────────────────────────────────────┐
│  1. Get Distribution Info               │
│     ├─► Query by distribution_code      │
│     └─► Extract item_id, created_at     │
│                                         │
│  2. Timeline Validation                 │
│     ├─► Query: Find distributions       │
│     │   WHERE item_id = X               │
│     │   AND created_at > current        │
│     │                                   │
│     └─► If found:                       │
│         ├─► Rollback                    │
│         └─► Error: "Bukan distribusi    │
│             terakhir"                   │
│                                         │
│  3. Get Previous Distribution           │
│     ├─► Query last distribution         │
│     │   WHERE item_id = X               │
│     │   ORDER BY created_at DESC        │
│     │   LIMIT 1                         │
│     │                                   │
│     └─► Extract target location         │
│                                         │
│  4. Begin Transaction                   │
│     ├─► Delete distribution record      │
│     │                                   │
│     └─► Restore item location           │
│         ├─► To previous target          │
│         └─► Update items table          │
│                                         │
│  5. Commit Transaction                  │
│                                         │
│  6. Return Success Response             │
└─────────────────────────────────────────┘
```

## 🎨 Frontend Architecture

### Component Structure

```
src/
├── components/
│   ├── ui/               # Shadcn/UI primitives
│   │   ├── alert-dialog.tsx
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── dialog.tsx
│   │   ├── input.tsx
│   │   ├── select.tsx
│   │   ├── table.tsx
│   │   └── ...
│   │
│   ├── dashboard/        # Feature components
│   │   ├── DashboardOverviewFresh.tsx
│   │   ├── StockTab.tsx
│   │   ├── DistributionTab.tsx
│   │   ├── CategoryManagement.tsx
│   │   ├── MasterDataTab.tsx
│   │   ├── ResetTab.tsx
│   │   └── ItemHistoryDialog.tsx
│   │
│   └── forms/            # Form components
│       ├── EnhancedStockForm.tsx
│       ├── EnhancedDistributionForm.tsx
│       └── DistributionFormFields.tsx
│
├── pages/
│   ├── Dashboard.tsx     # Main container
│   ├── Index.tsx         # Landing page
│   └── NotFound.tsx
│
├── lib/
│   ├── api.ts            # API client
│   └── utils.ts          # Utilities
│
├── types/
│   ├── api.ts            # TypeScript types
│   └── index.ts
│
└── constants/
    └── index.ts          # App constants
```

### State Management

```
┌────────────────────────────────────────┐
│      STATE MANAGEMENT PATTERN          │
├────────────────────────────────────────┤
│                                        │
│  Component Level State (useState)      │
│  ├─► Form data                         │
│  ├─► Dialog open/close                 │
│  ├─► Loading states                    │
│  └─► Error states                      │
│                                        │
│  Server State (React Query pattern)    │
│  ├─► Fetch data on mount               │
│  ├─► Cache in component                │
│  ├─► Refetch on mutation               │
│  └─► Loading/error handling            │
│                                        │
│  Event-based Sync                      │
│  └─► window.dispatchEvent()            │
│      └─► 'masterDataChanged'           │
│          └─► Trigger refetch           │
│                                        │
└────────────────────────────────────────┘
```

### API Client Pattern

```typescript
// src/lib/api.ts
class ApiClient {
  private baseURL = '/api/v1';
  
  async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.reason || error.error);
    }
    
    return response.json();
  }
  
  // CRUD methods
  async getItems(params?: QueryParams): Promise<ItemsResponse>
  async createItem(data: CreateItemRequest): Promise<Item>
  async updateItem(id: string, data: UpdateItemRequest): Promise<Item>
  async deleteItem(id: string): Promise<void>
  
  // Hierarchical data
  async getCategories(): Promise<Category[]>
  async getBrands(categoryId?: string): Promise<Brand[]>
  async getTypes(brandId?: string): Promise<Type[]>
  
  // Distributions
  async getDistributions(filters?: DistributionFilters): Promise<DistributionsResponse>
  async createDistribution(data: CreateDistributionRequest): Promise<Distribution>
  async deleteDistribution(code: string): Promise<void>
}

export const api = new ApiClient();
```

## 🔒 Security Architecture

### Security Layers

```
┌─────────────────────────────────────────┐
│        SECURITY ARCHITECTURE            │
├─────────────────────────────────────────┤
│                                         │
│  1. Network Layer                       │
│     ├─► Docker network isolation        │
│     ├─► Only exposed ports: 80          │
│     └─► Internal: 3306, 8080            │
│                                         │
│  2. Nginx Layer                         │
│     ├─► Security headers                │
│     │   ├─► X-Frame-Options: DENY       │
│     │   ├─► X-Content-Type: nosniff     │
│     │   └─► X-XSS-Protection: 1         │
│     │                                   │
│     ├─► Rate limiting                   │
│     └─► Request size limits             │
│                                         │
│  3. Application Layer                   │
│     ├─► Input validation                │
│     ├─► Prepared statements             │
│     ├─► Error sanitization              │
│     └─► CORS configuration              │
│                                         │
│  4. Database Layer                      │
│     ├─► User authentication             │
│     ├─► Connection pooling              │
│     ├─► Transaction isolation           │
│     └─► Foreign key constraints         │
│                                         │
└─────────────────────────────────────────┘
```

### SQL Injection Prevention

```javascript
// ❌ VULNERABLE (String concatenation)
const query = `SELECT * FROM items WHERE id = '${req.params.id}'`;

// ✅ SAFE (Prepared statements)
const [rows] = await pool.query(
  'SELECT * FROM items WHERE id = ?',
  [req.params.id]
);
```

## 📊 Performance Optimization

### Database Optimization

```sql
-- Indexes for fast queries
CREATE INDEX idx_items_category ON items(category_id, current_location);
CREATE INDEX idx_items_opd ON items(current_opd_id);
CREATE INDEX idx_dist_item_date ON distributions(item_id, created_at);
CREATE INDEX idx_dist_date ON distributions(distribution_date);

-- Query optimization
SELECT i.*, c.name as category_name
FROM items i
INNER JOIN categories c ON i.category_id = c.id
WHERE i.current_location = 'Gudang'
  AND i.is_active = TRUE
LIMIT 20 OFFSET 0;
-- Uses idx_items_category for fast filtering
```

### Connection Pooling

```javascript
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectionLimit: 10,      // Max connections
  queueLimit: 0,            // Unlimited queue
  waitForConnections: true  // Wait if pool full
});
```

### Frontend Optimization

```typescript
// Pagination for large datasets
const [items, setItems] = useState<Item[]>([]);
const [pagination, setPagination] = useState({
  page: 1,
  limit: 20,
  total: 0
});

// Debounced search
const debouncedSearch = useMemo(
  () => debounce((query: string) => {
    fetchItems({ search: query });
  }, 300),
  []
);
```

## 🏥 Health Checks & Monitoring

### Health Check Endpoints

```javascript
// Application health
GET /health
Response: {
  status: 'ok',
  database: 'connected',
  uptime: 3600,
  timestamp: '2025-11-30T10:00:00Z'
}

// Docker health checks
healthcheck:
  test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost/health"]
  interval: 30s
  timeout: 10s
  retries: 3
```

### Logging

```javascript
// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// Error logging
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  console.error('Stack:', err.stack);
  res.status(500).json({ error: 'Internal server error' });
});
```

## 🔄 Deployment

### Production Deployment

```bash
# Build and start containers
docker-compose up -d --build

# Check status
docker-compose ps

# View logs
docker-compose logs -f gudang_app

# Stop
docker-compose down

# Stop and remove volumes
docker-compose down -v
```

### Environment Variables

```env
# Database
DB_HOST=gudang_db
DB_USER=warehouse_user
DB_PASSWORD=secure_password
DB_NAME=warehouse_db

# Application
PORT=8080
NODE_ENV=production

# MariaDB
MYSQL_ROOT_PASSWORD=root_password
MYSQL_DATABASE=warehouse_db
MYSQL_USER=warehouse_user
MYSQL_PASSWORD=secure_password
```

---

**Arsitektur Version**: 2.0  
**Technology Stack**: Docker + Nginx + Node.js + MariaDB  
**Status**: Production Ready ✅
