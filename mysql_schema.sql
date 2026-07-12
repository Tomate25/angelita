-- MySQL Database Schema for Angelitas POS
-- Generated automatically from Base44 Entity Definitions

CREATE DATABASE IF NOT EXISTS angelitas_pos;
USE angelitas_pos;

-- Table: AccountReceivable
CREATE TABLE IF NOT EXISTS `account_receivable` (
    `id` VARCHAR(50) PRIMARY KEY,
    `created_date` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_date` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `customer_id` VARCHAR(255) NOT NULL,
    `customer_name` VARCHAR(255),
    `order_id` VARCHAR(255),
    `order_number` VARCHAR(255),
    `branch_id` VARCHAR(255),
    `original_amount` DECIMAL(15,2) NOT NULL,
    `balance` DECIMAL(15,2),
    `due_date` DATETIME,
    `status` VARCHAR(255) DEFAULT 'pending',
    `sent_to_collection` TINYINT(1) DEFAULT 0,
    `notes` VARCHAR(255)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: ARPayment
CREATE TABLE IF NOT EXISTS `a_r_payment` (
    `id` VARCHAR(50) PRIMARY KEY,
    `created_date` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_date` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `account_receivable_id` VARCHAR(255) NOT NULL,
    `customer_id` VARCHAR(255),
    `customer_name` VARCHAR(255),
    `amount` DECIMAL(15,2) NOT NULL,
    `payment_method` VARCHAR(255) DEFAULT 'efectivo',
    `reference` VARCHAR(255),
    `branch_id` VARCHAR(255),
    `notes` VARCHAR(255)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: Branch
CREATE TABLE IF NOT EXISTS `branch` (
    `id` VARCHAR(50) PRIMARY KEY,
    `created_date` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_date` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `name` VARCHAR(255) NOT NULL,
    `code` VARCHAR(255) NOT NULL,
    `address` VARCHAR(255),
    `phone` VARCHAR(255),
    `is_warehouse` TINYINT(1) DEFAULT 0,
    `is_active` TINYINT(1) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: CashRegister
CREATE TABLE IF NOT EXISTS `cash_register` (
    `id` VARCHAR(50) PRIMARY KEY,
    `created_date` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_date` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `branch_id` VARCHAR(255) NOT NULL,
    `branch_name` VARCHAR(255),
    `status` VARCHAR(255) DEFAULT 'open',
    `opened_at` DATETIME,
    `closed_at` DATETIME,
    `opening_amount` DECIMAL(15,2) DEFAULT 0,
    `cash_sales` DECIMAL(15,2) DEFAULT 0,
    `card_sales` DECIMAL(15,2) DEFAULT 0,
    `transfer_sales` DECIMAL(15,2) DEFAULT 0,
    `credit_sales` DECIMAL(15,2) DEFAULT 0,
    `total_sales` DECIMAL(15,2) DEFAULT 0,
    `total_orders` DECIMAL(15,4) DEFAULT 0,
    `cash_in` DECIMAL(15,2) DEFAULT 0,
    `cash_out` DECIMAL(15,2) DEFAULT 0,
    `expected_cash` DECIMAL(15,2) DEFAULT 0,
    `actual_cash` DECIMAL(15,2) DEFAULT 0,
    `difference` DECIMAL(15,2) DEFAULT 0,
    `cashier_email` VARCHAR(255),
    `notes` VARCHAR(255)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: Category
CREATE TABLE IF NOT EXISTS `category` (
    `id` VARCHAR(50) PRIMARY KEY,
    `created_date` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_date` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `name` VARCHAR(255) NOT NULL,
    `color` VARCHAR(255),
    `icon` VARCHAR(255),
    `sort_order` DECIMAL(15,4) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: Customer
CREATE TABLE IF NOT EXISTS `customer` (
    `id` VARCHAR(50) PRIMARY KEY,
    `created_date` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_date` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `name` VARCHAR(255) NOT NULL,
    `cedula` VARCHAR(255),
    `phone` VARCHAR(255),
    `email` VARCHAR(255),
    `address` VARCHAR(255),
    `credit_limit` DECIMAL(15,2) DEFAULT 0,
    `credit_days` DECIMAL(15,4) DEFAULT 30,
    `balance` DECIMAL(15,2) DEFAULT 0,
    `is_active` TINYINT(1) DEFAULT 1,
    `status` VARCHAR(255) DEFAULT 'active',
    `notes` VARCHAR(255),
    `price_list` VARCHAR(255) DEFAULT 'normal',
    `branch_id` VARCHAR(255),
    `branch_name` VARCHAR(255)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: Inventory
CREATE TABLE IF NOT EXISTS `inventory` (
    `id` VARCHAR(50) PRIMARY KEY,
    `created_date` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_date` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `product_id` VARCHAR(255) NOT NULL,
    `product_name` VARCHAR(255),
    `branch_id` VARCHAR(255) NOT NULL,
    `branch_name` VARCHAR(255),
    `quantity` DECIMAL(15,4) DEFAULT 0,
    `avg_cost` DECIMAL(15,2) DEFAULT 0,
    `total_value` DECIMAL(15,2) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: InventoryMovement
CREATE TABLE IF NOT EXISTS `inventory_movement` (
    `id` VARCHAR(50) PRIMARY KEY,
    `created_date` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_date` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `product_id` VARCHAR(255) NOT NULL,
    `product_name` VARCHAR(255),
    `branch_id` VARCHAR(255) NOT NULL,
    `branch_name` VARCHAR(255),
    `movement_type` VARCHAR(255) NOT NULL DEFAULT 'sale',
    `quantity` DECIMAL(15,4) NOT NULL,
    `unit_cost` DECIMAL(15,2) DEFAULT 0,
    `reference_id` VARCHAR(255),
    `reference_type` VARCHAR(255),
    `notes` VARCHAR(255),
    `previous_stock` DECIMAL(15,2),
    `new_stock` DECIMAL(15,2),
    `movement_date` DATETIME
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: Order
CREATE TABLE IF NOT EXISTS `order` (
    `id` VARCHAR(50) PRIMARY KEY,
    `created_date` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_date` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `order_number` VARCHAR(255),
    `branch_id` VARCHAR(255) NOT NULL,
    `customer_id` VARCHAR(255),
    `customer_name` VARCHAR(255),
    `status` VARCHAR(255) DEFAULT 'open',
    `items` JSON,
    `subtotal` DECIMAL(15,2) DEFAULT 0,
    `discount_total` DECIMAL(15,4) DEFAULT 0,
    `tax_total` DECIMAL(15,2) DEFAULT 0,
    `total` DECIMAL(15,2) DEFAULT 0,
    `payment_method` VARCHAR(255) DEFAULT 'efectivo',
    `amount_paid` DECIMAL(15,2) DEFAULT 0,
    `change_amount` DECIMAL(15,2) DEFAULT 0,
    `signature_url` VARCHAR(255),
    `notes` VARCHAR(255),
    `opened_at` DATETIME,
    `closed_at` DATETIME,
    `voided_reason` VARCHAR(255),
    `cashier_email` VARCHAR(255)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: OrderSequence
CREATE TABLE IF NOT EXISTS `order_sequence` (
    `id` VARCHAR(50) PRIMARY KEY,
    `created_date` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_date` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `branch_id` VARCHAR(255) NOT NULL,
    `branch_code` VARCHAR(255) NOT NULL,
    `last_number` DECIMAL(15,4) DEFAULT 0,
    `last_order_number` VARCHAR(255)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: Product
CREATE TABLE IF NOT EXISTS `product` (
    `id` VARCHAR(50) PRIMARY KEY,
    `created_date` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_date` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `name` VARCHAR(255) NOT NULL,
    `sku` VARCHAR(255),
    `category_id` VARCHAR(255),
    `image_url` VARCHAR(255),
    `unit` VARCHAR(255) DEFAULT 'unidad',
    `cost` DECIMAL(15,2) DEFAULT 0,
    `price` DECIMAL(15,2) NOT NULL DEFAULT 0,
    `wholesale_price` DECIMAL(15,2) DEFAULT 0,
    `special_price` DECIMAL(15,2) DEFAULT 0,
    `min_stock` DECIMAL(15,2) DEFAULT 0,
    `is_active` TINYINT(1) DEFAULT 1,
    `is_favorite` TINYINT(1) DEFAULT 0,
    `tax_rate` DECIMAL(15,2) DEFAULT 0,
    `can_transform` TINYINT(1) DEFAULT 0,
    `transform_to_product_id` VARCHAR(255),
    `transform_quantity` DECIMAL(15,4)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: ProductPriceSchedule
CREATE TABLE IF NOT EXISTS `product_price_schedule` (
    `id` VARCHAR(50) PRIMARY KEY,
    `created_date` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_date` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `product_id` VARCHAR(255) NOT NULL,
    `product_name` VARCHAR(255),
    `product_sku` VARCHAR(255),
    `new_price` DECIMAL(15,2),
    `new_wholesale_price` DECIMAL(15,2),
    `new_special_price` DECIMAL(15,2),
    `new_cost` DECIMAL(15,2),
    `effective_date` DATETIME NOT NULL,
    `applied` TINYINT(1) DEFAULT 0,
    `applied_at` DATETIME,
    `notes` VARCHAR(255)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: Purchase
CREATE TABLE IF NOT EXISTS `purchase` (
    `id` VARCHAR(50) PRIMARY KEY,
    `created_date` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_date` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `purchase_number` VARCHAR(255),
    `supplier_id` VARCHAR(255) NOT NULL,
    `supplier_name` VARCHAR(255),
    `branch_id` VARCHAR(255) NOT NULL,
    `branch_name` VARCHAR(255),
    `status` VARCHAR(255) DEFAULT 'draft',
    `items` JSON,
    `total` DECIMAL(15,2) DEFAULT 0,
    `notes` VARCHAR(255),
    `requested_by` VARCHAR(255),
    `approved_by` VARCHAR(255),
    `approved_at` DATETIME,
    `received_date` DATETIME,
    `approver_emails` JSON
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: Supplier
CREATE TABLE IF NOT EXISTS `supplier` (
    `id` VARCHAR(50) PRIMARY KEY,
    `created_date` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_date` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `name` VARCHAR(255) NOT NULL,
    `contact_name` VARCHAR(255),
    `phone` VARCHAR(255),
    `email` VARCHAR(255),
    `address` VARCHAR(255),
    `is_active` TINYINT(1) DEFAULT 1,
    `notes` VARCHAR(255)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: SupplierInvoice
CREATE TABLE IF NOT EXISTS `supplier_invoice` (
    `id` VARCHAR(50) PRIMARY KEY,
    `created_date` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_date` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `invoice_number` VARCHAR(255),
    `purchase_id` VARCHAR(255),
    `purchase_number` VARCHAR(255),
    `supplier_id` VARCHAR(255) NOT NULL,
    `supplier_name` VARCHAR(255),
    `branch_id` VARCHAR(255),
    `branch_name` VARCHAR(255),
    `items` JSON,
    `subtotal` DECIMAL(15,2) DEFAULT 0,
    `tax_amount` DECIMAL(15,2) DEFAULT 0,
    `total` DECIMAL(15,2) NOT NULL DEFAULT 0,
    `due_date` DATETIME,
    `status` VARCHAR(255) DEFAULT 'pending',
    `balance` DECIMAL(15,2) DEFAULT 0,
    `notes` VARCHAR(255),
    `received_by` VARCHAR(255),
    `received_date` DATETIME
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: SupplierPayment
CREATE TABLE IF NOT EXISTS `supplier_payment` (
    `id` VARCHAR(50) PRIMARY KEY,
    `created_date` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_date` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `supplier_invoice_id` VARCHAR(255) NOT NULL,
    `supplier_id` VARCHAR(255),
    `supplier_name` VARCHAR(255),
    `amount` DECIMAL(15,2) NOT NULL,
    `payment_method` VARCHAR(255) DEFAULT 'transferencia',
    `reference` VARCHAR(255),
    `branch_id` VARCHAR(255),
    `notes` VARCHAR(255)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: Transfer
CREATE TABLE IF NOT EXISTS `transfer` (
    `id` VARCHAR(50) PRIMARY KEY,
    `created_date` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_date` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `transfer_number` VARCHAR(255),
    `from_branch_id` VARCHAR(255) NOT NULL,
    `from_branch_name` VARCHAR(255),
    `to_branch_id` VARCHAR(255) NOT NULL,
    `to_branch_name` VARCHAR(255),
    `items` JSON,
    `total_value` DECIMAL(15,2) DEFAULT 0,
    `status` VARCHAR(255) DEFAULT 'active',
    `notes` VARCHAR(255),
    `transferred_by` VARCHAR(255)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: User
CREATE TABLE IF NOT EXISTS `user` (
    `id` VARCHAR(50) PRIMARY KEY,
    `created_date` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_date` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `role` VARCHAR(255) DEFAULT 'granada',
    `branch_id` VARCHAR(255),
    `branch_name` VARCHAR(255)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- Indexes for Performance Optimization
ALTER TABLE `inventory` ADD INDEX `idx_inv_product_branch` (`product_id`, `branch_id`);
ALTER TABLE `inventory_movement` ADD INDEX `idx_mov_product_branch` (`product_id`, `branch_id`);
ALTER TABLE `inventory_movement` ADD INDEX `idx_mov_date` (`movement_date`);
ALTER TABLE `order` ADD INDEX `idx_ord_branch` (`branch_id`);
ALTER TABLE `order` ADD INDEX `idx_ord_customer` (`customer_id`);
ALTER TABLE `order` ADD INDEX `idx_ord_created` (`created_date`);
ALTER TABLE `product` ADD INDEX `idx_prod_sku` (`sku`);
ALTER TABLE `product` ADD INDEX `idx_prod_cat` (`category_id`);
ALTER TABLE `product` ADD INDEX `idx_prod_active` (`is_active`);
ALTER TABLE `customer` ADD INDEX `idx_cust_branch` (`branch_id`);
ALTER TABLE `product_price_schedule` ADD INDEX `idx_sch_prod_applied` (`product_id`, `applied`);
ALTER TABLE `a_r_payment` ADD INDEX `idx_arp_rec` (`account_receivable_id`);

