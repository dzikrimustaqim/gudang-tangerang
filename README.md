# Sistem Manajemen Gudang Tangerang

## 📋 Deskripsi Aplikasi

**Gudang Tangerang** adalah sistem informasi manajemen inventaris dan distribusi barang berbasis web yang dirancang untuk mengelola aset teknologi informasi secara efektif dan efisien. Aplikasi ini memungkinkan organisasi untuk melacak pergerakan barang dari gudang ke berbagai Organisasi Perangkat Daerah (OPD) dan sebaliknya.

## 🎯 Tujuan Aplikasi

Aplikasi ini dikembangkan untuk:

1. **Mengelola Inventaris Barang** - Mencatat dan melacak semua item yang dimiliki organisasi
2. **Melacak Distribusi** - Memantau pergerakan barang antara gudang dan OPD
3. **Manajemen Lokasi** - Mengetahui lokasi terkini setiap item secara real-time
4. **Analisis dan Pelaporan** - Menyediakan dashboard dan laporan untuk pengambilan keputusan
5. **Riwayat Lengkap** - Menyimpan timeline lengkap perjalanan setiap item

## ✨ Fitur Utama

### 1. Manajemen Data Master

#### Kategori Hierarkis
- **3 Level Hierarki**: Kategori → Merek → Tipe
- Contoh: `Router → MikroTik → RB951Ui-2HnD`
- Cascade delete dengan peringatan
- Pencarian dan filter cepat

#### Organisasi Perangkat Daerah (OPD)
- Database OPD lengkap dengan detail kontak
- Multi-location per OPD
- Informasi PIC, alamat, dan bandwidth
- Status aktif/non-aktif

### 2. Manajemen Inventaris

#### Pencatatan Item
- Nomor serial unik untuk setiap item
- Kategori, merek, dan tipe terstruktur
- Kondisi item (Layak Pakai, Rusak Ringan, Rusak/Hilang)
- Tanggal masuk gudang
- Lokasi terkini (Gudang atau OPD)
- Deskripsi dan catatan

#### Tracking Real-time
- Lokasi item saat ini
- OPD tempat item berada
- Lokasi spesifik dalam OPD
- Status kondisi terkini

### 3. Manajemen Distribusi

#### Jenis Distribusi
1. **Gudang → OPD**: Pengiriman item dari gudang ke OPD
2. **OPD → Gudang**: Pengembalian item dari OPD ke gudang
3. **OPD → OPD**: Transfer item antar OPD

#### Fitur Distribusi
- Kode distribusi unik (6 karakter alphanumeric)
- Pencatatan kondisi item saat distribusi
- Catatan petugas yang memproses
- Validasi timeline (hanya distribusi terakhir yang bisa dihapus)
- Riwayat lengkap per item

### 4. Dashboard dan Analitik

#### Overview Statistik
- Total item di sistem
- Distribusi item per lokasi (Gudang vs OPD)
- Jumlah OPD aktif
- Total transaksi distribusi

#### Visualisasi Data
- Grafik distribusi per kategori
- Analisis kondisi barang
- Distribusi per OPD
- Tren distribusi

#### Riwayat Item
- Timeline lengkap pergerakan item
- Detail setiap distribusi
- Tracking kondisi item dari waktu ke waktu
- Informasi petugas dan tanggal

### 5. Integritas Data

#### Validasi Otomatis
- Pengecekan distribusi pertama (harus Gudang → OPD)
- Konsistensi lokasi antar distribusi
- Timeline validation

#### Business Rules
- Item baru harus masuk gudang terlebih dahulu
- Tidak bisa menghapus distribusi di tengah timeline
- Cascade delete dengan konfirmasi
- Validasi lokasi source/target

### 6. Manajemen Data

#### Reset Data
- Reset item dengan konfirmasi
- Reset distribusi dengan konfirmasi
- Reset data master (kategori, OPD)
- Reset selektif atau total

#### Ekspor Data
- Export data dalam format yang dibutuhkan
- Backup data berkala
- Laporan komprehensif

## 👥 Pengguna Target

Aplikasi ini dirancang untuk digunakan oleh:

1. **Admin Gudang** - Mengelola inventaris dan distribusi
2. **Staf IT** - Memantau dan melacak aset teknologi
3. **Kepala Bagian** - Melihat laporan dan statistik
4. **Petugas OPD** - Mengecek item yang berada di OPD mereka

## 🔒 Keamanan Data

- Database terenkripsi dan terlindungi
- Validasi input untuk mencegah SQL injection
- CORS configuration untuk akses terkelola
- Foreign key constraints untuk integritas referensial
- Transaction management untuk konsistensi data

## 🌐 Teknologi

### Frontend
- **React 18** - Library UI modern dan reaktif
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first CSS framework
- **Shadcn/UI** - Component library yang elegant
- **Vite** - Build tool yang cepat

### Backend
- **Node.js** - Runtime JavaScript
- **Express** - Web framework minimalis
- **MySQL2** - Database driver dengan promise support

### Database
- **MariaDB 11.2** - Relational database yang robust
- **Foreign Key Constraints** - Integritas referensial
- **Indexed Queries** - Performa optimal

### Infrastructure
- **Docker** - Containerization untuk deployment mudah
- **Nginx** - Reverse proxy dan static file server
- **Docker Compose** - Multi-container orchestration

## 📊 Use Cases

### Skenario 1: Item Baru Masuk Gudang
1. Admin mencatat item baru dengan nomor serial
2. Pilih kategori, merek, dan tipe
3. Set kondisi awal dan deskripsi
4. Item otomatis masuk ke gudang

### Skenario 2: Distribusi ke OPD
1. Pilih item yang akan didistribusikan
2. Pilih OPD tujuan dan lokasi spesifik
3. Catat kondisi saat distribusi
4. Sistem update lokasi item secara otomatis
5. Riwayat distribusi tercatat

### Skenario 3: Pengembalian Item
1. Pilih item yang akan dikembalikan
2. Catat kondisi saat pengembalian
3. Item kembali ke gudang
4. Timeline pengembalian tercatat

### Skenario 4: Tracking Item
1. Cari item berdasarkan serial number
2. Lihat lokasi terkini
3. Akses riwayat lengkap distribusi
4. Cek kondisi item dari waktu ke waktu

### Skenario 5: Analisis dan Laporan
1. Buka dashboard overview
2. Lihat statistik real-time
3. Analisis distribusi per kategori/OPD
4. Export data untuk laporan

## 🎨 User Interface

### Desain Modern
- Dark mode / Light mode support
- Responsive design (desktop, tablet, mobile)
- Intuitive navigation
- Professional color scheme

### Komponen UI
- AlertDialog untuk konfirmasi
- Toast notifications untuk feedback
- Loading states yang jelas
- Error handling yang user-friendly

### Aksesibilitas
- Keyboard navigation
- Clear visual hierarchy
- Consistent design patterns
- Indonesian language interface

## 📈 Skalabilitas

Aplikasi dirancang untuk:
- **Ribuan item** - Database teroptimasi dengan indexes
- **Ratusan OPD** - Structure hierarkis yang efisien
- **Puluhan ribu distribusi** - Timeline validation yang cepat
- **Multiple users** - Connection pooling untuk concurrency

## 🔄 Update dan Maintenance

- Auto-restart container jika terjadi error
- Health checks untuk monitoring
- Backup data otomatis
- Easy deployment dengan Docker
- Version control dengan Git

## 📞 Support

Untuk pertanyaan, masukan, atau pelaporan bug, silakan hubungi tim IT atau buka issue di repository project.

---

**Versi Aplikasi**: 2.0  
**Terakhir Diupdate**: 30 November 2025  
**Status**: Production Ready ✅
