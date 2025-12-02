# Cara Kerja Sistem Manajemen Gudang

## 🔄 Overview Alur Kerja

Sistem Manajemen Gudang bekerja dengan konsep **timeline-based tracking**, di mana setiap item memiliki riwayat lengkap pergerakan dari saat pertama kali masuk gudang hingga distribusi terakhir.

## 📦 Lifecycle Item

```
┌─────────────────────────────────────────────────────────────┐
│                     LIFECYCLE ITEM                          │
│                                                             │
│  1. Item Masuk        2. Distribusi       3. Tracking       │
│     Gudang               ke OPD              Real-time      │
│        │                   │                    │           │
│        ▼                   ▼                    ▼           │
│   ┌─────────┐        ┌───────────┐        ┌──────────┐      │
│   │ Create  │───────►│ Distribute│───────►│  Monitor │      │
│   │  Item   │        │   Item    │        │ Location │      │
│   └─────────┘        └───────────┘        └──────────┘      │
│        │                   │                    │           │
│        │                   ▼                    │           │
│        │            ┌──────────┐                │           │
│        │            │  Return  │                │           │
│        │            │ to Gudang│                │           │
│        │            └──────────┘                │           │
│        │                   │                    │           │
│        └───────────────────┴────────────────────┘           │
│                           │                                 │
│                           ▼                                 │
│                    ┌────────────┐                           │
│                    │  Complete  │                           │
│                    │  History   │                           │
│                    └────────────┘                           │
└─────────────────────────────────────────────────────────────┘
```

## 1️⃣ Manajemen Data Master

### A. Kategori Hierarkis

**Proses Setup:**

1. **Buat Kategori**
   - Masuk ke tab "Master Data" → "Kategori"
   - Klik "Tambah Kategori"
   - Isi nama kategori (contoh: "Router")
   - Save

2. **Tambah Merek (Brand)**
   - Expand kategori yang sudah dibuat
   - Klik "Tambah Merek"
   - Isi nama merek (contoh: "MikroTik")
   - Merek otomatis terhubung ke kategori induk

3. **Tambah Tipe**
   - Expand merek yang sudah dibuat
   - Klik "Tambah Tipe"
   - Isi nama tipe (contoh: "RB951Ui-2HnD")
   - Tipe otomatis terhubung ke merek induk

**Business Rules:**
- Kategori tidak bisa dihapus jika masih punya merek
- Merek tidak bisa dihapus jika masih punya tipe
- Hapus kategori = hapus semua merek dan tipe di dalamnya (dengan konfirmasi)

### B. Organisasi Perangkat Daerah (OPD)

**Proses Setup:**

1. **Buat OPD**
   - Tab "Master Data" → "OPD dan Lokasi"
   - Klik "Tambah OPD"
   - Isi data:
     * Nama OPD
     * Deskripsi
     * PIC (Person In Charge)
     * Alamat
     * Telepon
   - Save

2. **Tambah Lokasi OPD**
   - Expand OPD yang sudah dibuat
   - Klik "Tambah Lokasi"
   - Isi data lokasi:
     * Nama lokasi (contoh: "Kantor Kelurahan Cengkareng")
     * Deskripsi
     * PIC lokasi
     * Kontak
     * Bandwidth
     * Alamat lengkap
   - Lokasi otomatis terhubung ke OPD induk

**Use Case:**
- 1 OPD bisa punya banyak lokasi
- Contoh: Diskominfo punya lokasi di Gedung A, Gedung B, Data Center

## 2️⃣ Manajemen Item

### Proses Pencatatan Item Baru

```
┌──────────────────────────────────────────────────────┐
│           FLOW PENCATATAN ITEM BARU                  │
│                                                      │
│  User Input                                          │
│      │                                               │
│      ├─► Nomor Serial (unik, wajib)                  │
│      ├─► Pilih Kategori                              │
│      ├─► Pilih Merek (filter by kategori)            │
│      ├─► Pilih Tipe (filter by merek)                │
│      ├─► Set Kondisi Awal                            │
│      └─► Deskripsi (opsional)                        │
│           │                                          │
│           ▼                                          │
│      Validasi Input                                  │
│           │                                          │
│           ├─► Serial number unik?                    │
│           ├─► Kategori/Merek/Tipe valid?             │
│           └─► Kondisi valid?                         │
│                │                                     │
│                ▼                                     │
│           Save to Database                           │
│                │                                     │
│                ├─► current_location = "Gudang"       │
│                ├─► current_opd_id = NULL             │
│                ├─► entry_date = NOW()                │
│                └─► is_active = TRUE                  │
│                     │                                │
│                     ▼                                │
│                Item Masuk Gudang ✓                   │
│                (Siap untuk didistribusikan)          │
│                                                      │
└──────────────────────────────────────────────────────┘
```

**Contoh:**
```
Serial Number: SNR-2024-001
Kategori: Router
Merek: MikroTik
Tipe: RB951Ui-2HnD
Kondisi: Layak Pakai
Deskripsi: Router baru dari vendor
Entry Date: 30 Nov 2025
Status: Di Gudang
```

## 3️⃣ Distribusi Item

### A. Gudang → OPD (Pengiriman)

**Flow Process:**

```
┌──────────────────────────────────────────────────────┐
│        DISTRIBUSI: GUDANG → OPD                      │
│                                                      │
│  1. Pilih Item                                       │
│     └─► Hanya item yang di gudang                    │
│          │                                           │
│          ▼                                           │
│  2. Pilih Tujuan                                     │
│     ├─► Pilih OPD tujuan                             │
│     └─► Pilih lokasi spesifik di OPD                 │
│          │                                           │
│          ▼                                           │
│  3. Detail Distribusi                                │
│     ├─► Kondisi item saat ini                        │
│     ├─► Catatan (opsional)                           │
│     ├─► Nama petugas                                 │
│     └─► Tanggal distribusi                           │
│          │                                           │
│          ▼                                           │
│  4. Sistem Process                                   │
│     ├─► Generate kode distribusi (6 char)            │
│     ├─► Create distribution record                   │
│     │    - source_location = "Gudang"                │
│     │    - target_opd_id = OPD yang dipilih          │
│     │    - specific_location = Lokasi yang dipilih   │
│     │                                                │
│     └─► Update item status                           │
│          ├─► current_location = "OPD"                │
│          ├─► current_opd_id = OPD tujuan             │
│          └─► specific_location = Lokasi tujuan       │
│               │                                      │
│               ▼                                      │
│          Item Pindah ke OPD ✓                        │
│          Timeline Updated ✓                          │
│                                                      │
└──────────────────────────────────────────────────────┘
```

**Contoh:**
```
Distribution Code: A3B9K2
Item: SNR-2024-001 (Router MikroTik)
Direction: Gudang → OPD
Source: Gudang
Target OPD: Diskominfo
Lokasi: Data Center Lt. 3
Kondisi: Layak Pakai
Petugas: Ahmad Fauzi
Tanggal: 30 Nov 2025
Catatan: Router untuk backup link
```

### B. OPD → Gudang (Pengembalian)

**Flow Process:**

```
┌──────────────────────────────────────────────────────┐
│        DISTRIBUSI: OPD → GUDANG                      │
│                                                      │
│  1. Pilih Item                                       │
│     └─► Hanya item yang di OPD                       │
│          │                                           │
│          ▼                                           │
│  2. Auto-fill Source                                 │
│     ├─► Source OPD = OPD terakhir item               │
│     └─► Source Location = Lokasi terakhir            │
│          │                                           │
│          ▼                                           │
│  3. Detail Distribusi                                │
│     ├─► Kondisi item saat dikembalikan               │
│     ├─► Alasan pengembalian (catatan)                │
│     ├─► Nama petugas                                 │
│     └─► Tanggal pengembalian                         │
│          │                                           │
│          ▼                                           │
│  4. Sistem Process                                   │
│     ├─► Create return distribution                   │
│     │    - source_opd_id = OPD sebelumnya            │
│     │    - target_location = "Gudang"                │
│     │    - specific_location = "Gudang"              │
│     │                                                │
│     └─► Update item status                           │
│          ├─► current_location = "Gudang"             │
│          ├─► current_opd_id = NULL                   │
│          ├─► condition = Kondisi pengembalian        │
│          └─► specific_location = "Gudang"            │
│               │                                      │
│               ▼                                      │
│          Item Kembali ke Gudang ✓                    │
│          Timeline Updated ✓                          │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### C. OPD → OPD (Transfer)

**Flow Process:**
- Item dipindah dari OPD A ke OPD B
- Source auto-fill dari lokasi terakhir
- Pilih OPD tujuan dan lokasi
- Sistem update lokasi item

## 4️⃣ Validasi dan Business Rules

### Timeline Validation

**Rule: Hanya distribusi TERAKHIR yang bisa dihapus**

```
Item Timeline:
┌─────────────────────────────────────────────┐
│ 1. [30 Nov] Item Masuk Gudang               │
│ 2. [01 Des] Gudang → Diskominfo             │
│ 3. [05 Des] Diskominfo → Kelurahan          │ ← Bisa dihapus
└─────────────────────────────────────────────┘

❌ Tidak bisa hapus distribusi #2 (ada #3 setelahnya)
✅ Bisa hapus distribusi #3 (distribusi terakhir)
```

**Alasan:**
- Menghapus distribusi tengah = merusak timeline
- Data history menjadi tidak konsisten
- Lokasi item menjadi ambigu

**Solusi:**
- Hapus dari distribusi terakhir secara berurutan
- Atau edit distribusi jika ada kesalahan

### First Distribution Rule

**Rule: Distribusi PERTAMA harus Gudang → OPD**

```
✅ Valid:
Item Masuk → Gudang → OPD (Distribusi #1)

❌ Invalid:
Item Masuk → OPD → Gudang (ERROR!)

Alasan:
- Item baru HARUS masuk gudang dulu
- Tidak mungkin item langsung ke OPD tanpa lewat gudang
```

### Cascade Delete Rules

**Hapus Kategori:**
```
Kategori "Router" (3 merek, 8 tipe)
    └─► Konfirmasi: "Semua merek dan tipe akan terhapus"
        └─► User klik "Hapus"
            ├─► Delete 8 tipe
            ├─► Delete 3 merek
            └─► Delete kategori
```

**Hapus Item:**
```
Item "SNR-2024-001" (5 distribusi)
    └─► Konfirmasi: "Semua riwayat distribusi akan terhapus"
        └─► User klik "Hapus"
            ├─► Delete 5 distribusi
            └─► Delete item
```

## 5️⃣ Tracking dan Monitoring

### Real-time Location

**Sistem selalu tahu lokasi item:**

```
Query: "Dimana Router SNR-2024-001?"

Response:
┌─────────────────────────────────┐
│ Item: Router MikroTik           │
│ Serial: SNR-2024-001            │
│ Status: Di OPD                  │
│ OPD: Diskominfo                 │
│ Lokasi: Data Center Lt. 3       │
│ Kondisi: Layak Pakai            │
│ Update Terakhir: 05 Des 2025    │
└─────────────────────────────────┘
```

### History Timeline

**Klik "Riwayat" pada item:**

```
┌──────────────────────────────────────────────┐
│         TIMELINE ITEM SNR-2024-001           │
├──────────────────────────────────────────────┤
│ [05 Des 2025] OPD → OPD                      │
│ Diskominfo → Kelurahan Cengkareng            │
│ Kondisi: Layak Pakai                         │
│ Petugas: Budi Santoso                        │
├──────────────────────────────────────────────┤
│ [01 Des 2025] Gudang → OPD                   │
│ Gudang → Diskominfo (Data Center)            │
│ Kondisi: Layak Pakai                         │
│ Petugas: Ahmad Fauzi                         │
├──────────────────────────────────────────────┤
│ [30 Nov 2025] Item Masuk Gudang              │
│ Router baru dari vendor                      │
│ Kondisi: Layak Pakai                         │
└──────────────────────────────────────────────┘
```

## 6️⃣ Dashboard dan Analitik

### Auto-calculation

**Sistem otomatis menghitung:**

1. **Total Item**
   - Count dari tabel items (is_active = true)

2. **Item di Gudang**
   - Count items WHERE current_location = 'Gudang'

3. **Item di OPD**
   - Count items WHERE current_location = 'OPD'
   - Group by OPD untuk detail per OPD

4. **Total Distribusi**
   - Count dari tabel distributions

5. **Distribusi per Kategori**
   - Join items dengan distributions
   - Group by category
   - Visual: Pie chart

6. **Analisis Kondisi**
   - Count items GROUP BY condition
   - Visual: Bar chart
   - Breakdown: Layak Pakai vs Rusak

## 7️⃣ Error Handling

### User-Friendly Messages

**Contoh Error Messages:**

```
❌ Delete Distribusi Tengah:
"Tidak dapat menghapus distribusi - Distribusi ini bukan 
distribusi terakhir. Hanya distribusi terakhir yang dapat 
dihapus untuk menjaga integritas riwayat pergerakan item."

❌ Serial Number Duplikat:
"Nomor serial sudah digunakan. Gunakan nomor serial yang unik."

❌ Hapus Kategori dengan Merek:
"Apakah Anda yakin ingin menghapus kategori 'Router'? 
Semua merek dan tipe di dalamnya juga akan terhapus. 
Tindakan ini tidak dapat dibatalkan."

✅ Success Message:
"Item berhasil ditambahkan ke gudang"
"Distribusi berhasil dicatat"
"Data berhasil diperbarui"
```

## 8️⃣ Data Integrity

### Auto-validation

**Sistem memvalidasi:**

1. **First Distribution Check**
   - Endpoint: `/api/v1/data/integrity`
   - Cek distribusi pertama setiap item
   - Flag jika bukan "Gudang → OPD"

2. **Location Consistency**
   - Target distribusi sebelumnya = Source distribusi berikutnya
   - Auto-check saat save distribusi

3. **Foreign Key Constraints**
   - Item harus punya kategori yang valid
   - Distribusi harus reference item yang ada
   - OPD location harus reference OPD yang ada

## 🔄 Complete Flow Example

**Skenario Lengkap: Router dari Gudang ke OPD**

```
DAY 1: Item Masuk
├─► Admin input router baru
├─► Serial: RTR-2025-001
├─► Kategori: Router → MikroTik → RB951
├─► Kondisi: Layak Pakai
└─► Status: Di Gudang ✓

DAY 3: Distribusi ke Diskominfo
├─► Pilih item RTR-2025-001
├─► Tujuan: Diskominfo - Data Center
├─► Generate kode: X7Y2P9
├─► Item pindah ke Diskominfo ✓
└─► Timeline updated ✓

DAY 7: Transfer ke Kelurahan
├─► Item masih di Diskominfo
├─► Transfer ke: Kelurahan - Kantor Lurah
├─► Generate kode: M4N8K1
├─► Item pindah ke Kelurahan ✓
└─► Timeline updated ✓

DAY 14: Check Status
├─► Open dashboard
├─► Cari RTR-2025-001
├─► Lokasi terkini: Kelurahan - Kantor Lurah
├─► Kondisi: Layak Pakai
└─► Riwayat: 2 distribusi tercatat ✓

DAY 20: Item Rusak
├─► Edit kondisi item
├─► Update: Rusak Ringan
├─► Catatan: Adaptor rusak
└─► Status updated ✓

DAY 25: Kembalikan ke Gudang
├─► Distribusi: OPD → Gudang
├─► Kondisi: Rusak Ringan
├─► Alasan: Perlu perbaikan
├─► Generate kode: Q5W3E8
├─► Item kembali ke gudang ✓
└─► Timeline: 3 distribusi ✓
```

---

**Sistem bekerja secara otomatis dan terstruktur untuk memastikan setiap pergerakan item tercatat dengan baik dan data tetap konsisten!**
