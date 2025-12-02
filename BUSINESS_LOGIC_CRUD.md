# Business Logic CRUD - Warehouse Management System

## 📋 Overview
Dokumentasi ini menjelaskan business logic yang diterapkan untuk setiap operasi CRUD (Create, Read, Update, Delete) pada **Items** dan **Distributions** sesuai dengan praktik dunia nyata.

---

## 🏷️ ITEMS (Barang)

### ✅ CREATE Item
**Endpoint:** `POST /api/v1/items`

**Business Rules:**
1. ✅ Serial number harus **unique** (tidak boleh duplikat)
2. ✅ Item baru selalu masuk ke **Gudang** (`current_location = 'Gudang'`)
3. ✅ Entry date default = tanggal sekarang
4. ✅ Kondisi awal dicatat di `items.condition` (Layak Pakai/Rusak Ringan/Rusak Hilang)
5. ✅ Category harus exist dan active

**Validation:**
- Serial number tidak boleh kosong
- Category ID harus valid
- Brand dan Type wajib diisi
- Condition harus salah satu dari: 'Layak Pakai', 'Rusak Ringan', 'Rusak/Hilang'

---

### 📖 READ Items
**Endpoint:** `GET /api/v1/items`

**Business Rules:**
1. ✅ Hanya menampilkan item yang **active** (`is_active = TRUE`)
2. ✅ Kondisi item terkini diambil dari **latest distribution**, bukan dari `items.condition`
3. ✅ Lokasi item terkini dihitung dari **latest distribution**:
   - Jika latest direction = `OPD → Gudang` → Item di Gudang
   - Jika latest direction = `Gudang → OPD` atau `OPD → OPD` → Item di OPD

**Data Enrichment:**
- Join dengan `categories` untuk nama kategori
- Join dengan `distributions` untuk kondisi terkini
- Aggregate untuk menghitung jumlah distribusi per item

---

### ✏️ UPDATE Item
**Endpoint:** `PUT /api/v1/items/:id`

**Business Rules:**
1. ✅ Serial number bisa diubah (tapi tetap harus unique)
2. ✅ **TIDAK mengubah `items.condition`** - ini adalah kondisi awal item masuk gudang
3. ✅ Kondisi terkini dikelola melalui **distributions**, bukan di items
4. ✅ Tidak bisa mengubah `current_location` atau `current_opd_id` secara langsung
   - Lokasi hanya berubah melalui **distribusi**

**Validation:**
- Serial number tidak boleh duplikat dengan item lain
- Category ID harus valid jika diubah

**Why:**
- `items.condition` = kondisi **awal** saat item masuk gudang (historical record)
- Kondisi **terkini** ada di `distributions.item_condition` (latest distribution)
- Ini memungkinkan tracking perubahan kondisi item sepanjang waktu

---

### ❌ DELETE Item
**Endpoint:** `DELETE /api/v1/items/:id`

**Business Rules:**
1. ✅ **Soft Delete** - Item tidak benar-benar dihapus, hanya di-flag `is_active = FALSE`
2. ✅ Serial number ditambahi timestamp untuk menghindari konflik unique constraint
   - Format: `{original_serial}_deleted_{timestamp}`
3. ✅ **Semua distributions terkait item ini DIHAPUS** (hard delete)

**Why:**
- Soft delete item = preserves audit trail (item pernah ada)
- Hard delete distributions = menghindari orphaned data
- Jika item sudah tidak exist, riwayat pergerakannya menjadi irrelevant
- Database sudah punya `ON DELETE CASCADE` di foreign key, tapi karena pakai soft delete, kita perlu hapus manual

**Response:**
```json
{
  "message": "Item deleted successfully",
  "deleted_distributions": 5,
  "item_id": "xxx-xxx-xxx"
}
```

---

## 📦 DISTRIBUTIONS (Distribusi/Pergerakan Barang)

### ✅ CREATE Distribution
**Endpoint:** `POST /api/v1/distributions`

**Business Rules:**

#### 1. **Direction Validation** (Arah Distribusi)
Arah distribusi harus sesuai dengan **lokasi item saat ini**:

| Lokasi Item Saat Ini | Arah Yang Dibolehkan |
|----------------------|---------------------|
| Gudang | ✅ `Gudang → OPD` |
| OPD | ✅ `OPD → Gudang`<br>✅ `OPD → OPD` |

**❌ Tidak Boleh:**
- Item di Gudang tapi direction = `OPD → Gudang` atau `OPD → OPD`
- Item di OPD tapi direction = `Gudang → OPD`

#### 2. **Date Validation** (Tanggal Distribusi)
- ✅ Tidak boleh di **masa depan**
- ✅ Tidak boleh lebih awal dari **entry_date** item
- ✅ Harus lebih lambat dari atau sama dengan **distribusi sebelumnya**
- ✅ Harus lebih awal dari atau sama dengan **distribusi berikutnya**
- ✅ Maksimal 10 tahun yang lalu (reasonable constraint)
- ✅ Timezone: **WIB (UTC+7)** untuk Indonesia

#### 3. **Location Consistency** (Konsistensi Lokasi)
- Source location otomatis diambil dari **latest distribution target**
- Jika item di OPD, source_opd_id harus sesuai dengan OPD terakhir
- Jika item di Gudang, source_opd_id harus NULL

#### 4. **Item State Update**
Setelah create distribution, **item.current_location** diupdate:
- Direction `Gudang → OPD` → `current_location = 'OPD'`, `current_opd_id = target_opd_id`
- Direction `OPD → Gudang` → `current_location = 'Gudang'`, `current_opd_id = NULL`
- Direction `OPD → OPD` → `current_location = 'OPD'`, `current_opd_id = target_opd_id`

**Note:** `items.condition` **TIDAK** diupdate! Kondisi terkini ada di `distributions.item_condition`.

---

### 📖 READ Distributions
**Endpoint:** `GET /api/v1/distributions`

**Business Rules:**
1. ✅ Menampilkan semua distribusi (tidak ada soft delete)
2. ✅ Join dengan `items`, `opds`, `opd_locations` untuk data lengkap
3. ✅ Filter by item_id untuk melihat riwayat satu item
4. ✅ Order by `distribution_date DESC` untuk melihat yang terbaru

---

### ✏️ UPDATE Distribution
**Endpoint:** `PUT /api/v1/distributions/:distribution_code`

**Business Rules:**

#### 1. **Conditional Validation**
Validasi hanya berjalan **jika field diubah**:
- Date validation hanya jalan jika `distribution_date` berubah
- Direction validation hanya jalan jika `direction` berubah

#### 2. **Direction Change Rules**
Tidak boleh mengubah direction yang akan **merusak timeline**:

**Contoh:**
- Item awalnya di Gudang
- Distribusi 1: `Gudang → OPD` (item sekarang di OPD)
- Distribusi 2: `OPD → Gudang` (item kembali ke Gudang)

Jika edit Distribusi 1 menjadi `OPD → Gudang`, **ditolak** karena:
- Sebelum distribusi ini, item **di Gudang** (bukan di OPD)
- Tidak bisa return ke gudang dari OPD jika belum pernah ke OPD

#### 3. **Previous/Next Distribution Check**
Menggunakan **`created_at`** bukan `distribution_date` untuk menentukan urutan:
- Why: Bisa ada beberapa distribusi di hari yang sama
- `created_at` = timestamp sebenarnya saat record dibuat
- Lebih akurat untuk menentukan "previous" dan "next"

#### 4. **Date Change Validation**
Sama seperti CREATE, tapi ditambah:
- Tanggal baru harus `>=` previous distribution date
- Tanggal baru harus `<=` next distribution date
- Boleh sama (multiple distributions di hari yang sama)

**Note:** `items.condition` tetap **TIDAK** diupdate!

---

### ❌ DELETE Distribution
**Endpoint:** `DELETE /api/v1/distributions/:distribution_code`

**Business Rules:**

#### 1. **Timeline Protection**
✅ **Hanya bisa menghapus distribusi TERAKHIR (terbaru)**

❌ **Tidak bisa menghapus distribusi di tengah timeline**

**Why:**
- Menghapus distribusi di tengah akan merusak riwayat pergerakan
- Contoh: 
  - Dist 1: Gudang → OPD A (2025-01-01)
  - Dist 2: OPD A → OPD B (2025-02-01)  ← Ini tidak bisa dihapus
  - Dist 3: OPD B → Gudang (2025-03-01)
  - Jika Dist 2 dihapus, Dist 3 akan jadi "OPD A → Gudang" padahal tidak pernah pindah langsung

**Error Response:**
```json
{
  "error": "❌ TIDAK BISA MENGHAPUS DISTRIBUSI",
  "reason": "Ada distribusi lain yang terjadi setelah distribusi ini",
  "rule": "Distribusi hanya bisa dihapus jika merupakan distribusi terakhir (terbaru)",
  "timeline": {
    "this": "2025-02-01 - OPD → OPD",
    "next": "2025-03-01 - OPD → Gudang (ABC123)"
  },
  "solution": "Hapus distribusi yang lebih baru terlebih dahulu, atau edit distribusi ini jika perlu perubahan"
}
```

#### 2. **Item State Restoration**
Setelah delete distribusi terakhir, **item location dikembalikan ke distribusi sebelumnya**:

- Jika ada previous distribution → restore ke target location previous
- Jika tidak ada previous → restore ke Gudang (initial state)

**Example:**
```
Before Delete:
- Dist 1: Gudang → OPD A (item di OPD A)
- Dist 2: OPD A → OPD B (item di OPD B) ← DELETED

After Delete:
- Dist 1: Gudang → OPD A (item di OPD A) ← Item kembali ke OPD A
```

---

## 🔄 Data Consistency Rules

### 1. **Item Condition Tracking**
```
items.condition          → Kondisi AWAL saat masuk gudang (historical, tidak berubah)
distributions.item_condition → Kondisi TERKINI setiap distribusi (bisa berubah)
```

**Why:**
- Bisa track degradasi kondisi item dari waktu ke waktu
- Misal: Masuk gudang = "Layak Pakai", setelah 2 tahun jadi "Rusak Ringan"

### 2. **Location Tracking**
```
items.current_location   → Lokasi terkini (Gudang/OPD)
items.current_opd_id     → OPD ID jika di OPD, NULL jika di Gudang
items.specific_location  → Lokasi spesifik (ruang, gedung, dll)
```

**Update Rules:**
- ✅ Hanya diupdate melalui **CREATE/DELETE distribution**
- ❌ Tidak bisa diupdate manual via UPDATE item
- ✅ Otomatis sinkron dengan latest distribution

### 3. **Timeline Integrity**
- Distributions diurutkan berdasarkan `created_at` (bukan `distribution_date`)
- Previous/Next distribution ditentukan dari `created_at`
- Validasi date menggunakan normalized date (YYYY-MM-DD) tanpa time component
- Timezone: WIB (UTC+7) untuk semua date validation

---

## 🚫 Common Validation Errors

### Item Errors
```json
{
  "error": "Serial number already exists"
}
```
```json
{
  "error": "Category not found or inactive"
}
```

### Distribution Errors
```json
{
  "error": "❌ ARAH DISTRIBUSI TIDAK VALID",
  "reason": "Item saat ini berada di Gudang",
  "current_location": "Gudang",
  "attempted_direction": "OPD → Gudang",
  "solution": "Gunakan arah 'Gudang → OPD' untuk mendistribusikan item dari gudang ke OPD"
}
```

```json
{
  "error": "❌ TANGGAL TIDAK VALID",
  "reason": "Tanggal distribusi tidak boleh di masa depan",
  "provided_date": "2025-11-15",
  "max_allowed": "2025-11-10",
  "solution": "Gunakan tanggal hari ini (2025-11-10) atau tanggal yang lebih awal"
}
```

```json
{
  "error": "❌ TANGGAL TIDAK VALID - TIMELINE TERBALIK",
  "reason": "Tanggal distribusi harus sama atau lebih lambat dari distribusi sebelumnya",
  "timeline": {
    "previous": "2025-11-05 - Gudang → OPD",
    "current_new": "2025-11-03 - OPD → Gudang ❌ TIDAK VALID"
  },
  "solution": "Gunakan tanggal 2025-11-05 atau setelahnya"
}
```

---

## 📊 Summary

| Operation | Item | Distribution |
|-----------|------|-------------|
| **CREATE** | ✅ Masuk gudang<br>✅ Kondisi awal dicatat | ✅ Validasi direction<br>✅ Validasi date<br>✅ Update item location |
| **READ** | ✅ Active only<br>✅ Join latest condition | ✅ All records<br>✅ Rich joins |
| **UPDATE** | ✅ Serial number<br>❌ Tidak ubah condition | ✅ Conditional validation<br>✅ Timeline check<br>❌ Tidak ubah item.condition |
| **DELETE** | ✅ Soft delete<br>✅ Cascade delete distributions | ✅ Only last distribution<br>✅ Restore item location |

---

## 🎯 Best Practices

1. **Always use transactions** untuk operasi yang melibatkan multiple tables
2. **Validate before modify** - check semua business rules sebelum update
3. **Preserve history** - gunakan soft delete untuk items, timestamps untuk tracking
4. **Consistent timezone** - selalu gunakan WIB (UTC+7) untuk Indonesia
5. **Rich error messages** - berikan solusi yang actionable untuk user
6. **Timeline integrity** - jaga urutan distribusi tetap konsisten

---

**Last Updated:** November 10, 2025  
**Version:** 1.0.0
