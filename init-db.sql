-- Database initialization script for Warehouse Management System

CREATE DATABASE IF NOT EXISTS warehouse_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE warehouse_db;

-- Categories Table
CREATE TABLE IF NOT EXISTS categories (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_name (name),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Brands Table (Merek)
CREATE TABLE IF NOT EXISTS brands (
    id VARCHAR(36) PRIMARY KEY,
    category_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
    INDEX idx_category_id (category_id),
    INDEX idx_name (name),
    INDEX idx_is_active (is_active),
    UNIQUE KEY unique_brand_per_category (category_id, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Types Table (Tipe)
CREATE TABLE IF NOT EXISTS types (
    id VARCHAR(36) PRIMARY KEY,
    brand_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE CASCADE,
    INDEX idx_brand_id (brand_id),
    INDEX idx_name (name),
    INDEX idx_is_active (is_active),
    UNIQUE KEY unique_type_per_brand (brand_id, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- OPDs (Organisasi Perangkat Daerah) Table
CREATE TABLE IF NOT EXISTS opds (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    pic VARCHAR(255),
    address TEXT,
    phone VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_name (name),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- OPD Locations Table (Lokasi-lokasi di setiap OPD)
CREATE TABLE IF NOT EXISTS opd_locations (
    id VARCHAR(36) PRIMARY KEY,
    opd_id VARCHAR(36) NOT NULL,
    location_name VARCHAR(255) NOT NULL,
    description TEXT,
    pic VARCHAR(255),
    contact VARCHAR(255),
    bandwidth VARCHAR(255),
    address TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (opd_id) REFERENCES opds(id) ON DELETE CASCADE,
    INDEX idx_opd_id (opd_id),
    INDEX idx_is_active (is_active),
    UNIQUE KEY unique_location_per_opd (opd_id, location_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Items Table
CREATE TABLE IF NOT EXISTS items (
    id VARCHAR(36) PRIMARY KEY,
    serial_number VARCHAR(255) NOT NULL UNIQUE,
    category_id VARCHAR(36) NOT NULL,
    brand VARCHAR(255) NOT NULL,
    type VARCHAR(255) NOT NULL,
    `condition` ENUM('Layak Pakai', 'Rusak Ringan', 'Rusak/Hilang') NOT NULL DEFAULT 'Layak Pakai',
    description TEXT,
    entry_date TIMESTAMP NOT NULL,
    current_location ENUM('Gudang', 'OPD') NOT NULL DEFAULT 'Gudang',
    current_opd_id VARCHAR(36) NULL,
    specific_location VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT,
    FOREIGN KEY (current_opd_id) REFERENCES opds(id) ON DELETE SET NULL,
    INDEX idx_serial_number (serial_number),
    INDEX idx_category_id (category_id),
    INDEX idx_current_location (current_location),
    INDEX idx_current_opd_id (current_opd_id),
    INDEX idx_condition (`condition`),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Distributions Table
CREATE TABLE IF NOT EXISTS distributions (
    distribution_code VARCHAR(10) PRIMARY KEY,
    item_id VARCHAR(36) NOT NULL,
    direction ENUM('Gudang → OPD', 'OPD → Gudang', 'OPD → OPD') NOT NULL,
    source_opd_id VARCHAR(36) NULL,
    source_location VARCHAR(255) NOT NULL,
    target_opd_id VARCHAR(36) NULL,
    specific_location VARCHAR(255) NOT NULL,
    item_condition ENUM('Layak Pakai', 'Rusak Ringan', 'Rusak/Hilang') NOT NULL DEFAULT 'Layak Pakai',
    notes TEXT,
    distribution_date TIMESTAMP NOT NULL,
    processed_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
    FOREIGN KEY (source_opd_id) REFERENCES opds(id) ON DELETE SET NULL,
    FOREIGN KEY (target_opd_id) REFERENCES opds(id) ON DELETE SET NULL,
    INDEX idx_item_id (item_id),
    INDEX idx_distribution_date (distribution_date),
    INDEX idx_direction (direction),
    INDEX idx_source_opd_id (source_opd_id),
    INDEX idx_target_opd_id (target_opd_id),
    CHECK (specific_location IS NOT NULL AND specific_location != ''),
    CHECK (source_location IS NOT NULL AND source_location != '')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Database tables created successfully
-- No initial data inserted - database will be empty on first run
-- You can add data manually through the application interface
