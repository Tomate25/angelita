# Base44 Database Schema Summary

## Table: AccountReceivable
| Field Name | Type | Required | Default | Enum/Description |
|------------|------|----------|---------|------------------|
| customer_id | string | **Yes** | - |  |
| customer_name | string | No | - |  |
| order_id | string | No | - |  |
| order_number | string | No | - |  |
| branch_id | string | No | - |  |
| original_amount | number | **Yes** | - |  |
| balance | number | No | - |  |
| due_date | string | No | - |  |
| status | string | No | "pending" | Enum: [pending, partial, paid, overdue, cancelled] |
| sent_to_collection | boolean | No | false |  |
| notes | string | No | - |  |

## Table: ARPayment
| Field Name | Type | Required | Default | Enum/Description |
|------------|------|----------|---------|------------------|
| account_receivable_id | string | **Yes** | - |  |
| customer_id | string | No | - |  |
| customer_name | string | No | - |  |
| amount | number | **Yes** | - |  |
| payment_method | string | No | "efectivo" | Enum: [efectivo, transferencia, tarjeta] |
| reference | string | No | - |  |
| branch_id | string | No | - |  |
| notes | string | No | - |  |

## Table: Branch
| Field Name | Type | Required | Default | Enum/Description |
|------------|------|----------|---------|------------------|
| name | string | **Yes** | - | Branch name |
| code | string | **Yes** | - | Short code for the branch |
| address | string | No | - |  |
| phone | string | No | - |  |
| is_warehouse | boolean | No | false | Is this the central warehouse |
| is_active | boolean | No | true |  |

## Table: CashRegister
| Field Name | Type | Required | Default | Enum/Description |
|------------|------|----------|---------|------------------|
| branch_id | string | **Yes** | - |  |
| branch_name | string | No | - |  |
| status | string | No | "open" | Enum: [open, closed] |
| opened_at | string | No | - |  |
| closed_at | string | No | - |  |
| opening_amount | number | No | 0 |  |
| cash_sales | number | No | 0 |  |
| card_sales | number | No | 0 |  |
| transfer_sales | number | No | 0 |  |
| credit_sales | number | No | 0 |  |
| total_sales | number | No | 0 |  |
| total_orders | number | No | 0 |  |
| cash_in | number | No | 0 | Extra cash income |
| cash_out | number | No | 0 | Cash withdrawals |
| expected_cash | number | No | 0 |  |
| actual_cash | number | No | 0 |  |
| difference | number | No | 0 |  |
| cashier_email | string | No | - |  |
| notes | string | No | - |  |

## Table: Category
| Field Name | Type | Required | Default | Enum/Description |
|------------|------|----------|---------|------------------|
| name | string | **Yes** | - |  |
| color | string | No | - | Hex color for UI display |
| icon | string | No | - | Icon name |
| sort_order | number | No | 0 |  |

## Table: Customer
| Field Name | Type | Required | Default | Enum/Description |
|------------|------|----------|---------|------------------|
| name | string | **Yes** | - |  |
| cedula | string | No | - | Número de cédula o RUC |
| phone | string | No | - |  |
| email | string | No | - |  |
| address | string | No | - |  |
| credit_limit | number | No | 0 |  |
| credit_days | number | No | 30 |  |
| balance | number | No | 0 | Current outstanding balance |
| is_active | boolean | No | true |  |
| status | string | No | "active" | Estado del cliente: activo o archivado Enum: [active, archived] |
| notes | string | No | - |  |
| price_list | string | No | "normal" | Enum: [normal, mayorista, especial] |
| branch_id | string | No | - | Punto de venta al que pertenece el cliente |
| branch_name | string | No | - | Nombre del punto de venta |

## Table: Inventory
| Field Name | Type | Required | Default | Enum/Description |
|------------|------|----------|---------|------------------|
| product_id | string | **Yes** | - |  |
| product_name | string | No | - |  |
| branch_id | string | **Yes** | - |  |
| branch_name | string | No | - |  |
| quantity | number | No | 0 |  |
| avg_cost | number | No | 0 |  |
| total_value | number | No | 0 |  |

## Table: InventoryMovement
| Field Name | Type | Required | Default | Enum/Description |
|------------|------|----------|---------|------------------|
| product_id | string | **Yes** | - |  |
| product_name | string | No | - |  |
| branch_id | string | **Yes** | - |  |
| branch_name | string | No | - |  |
| movement_type | string | **Yes** | "sale" | Enum: [sale, purchase, transfer_in, transfer_out, adjustment, transformation_in, transformation_out, return] |
| quantity | number | **Yes** | - |  |
| unit_cost | number | No | 0 |  |
| reference_id | string | No | - | Order, Purchase or Transfer ID |
| reference_type | string | No | - |  |
| notes | string | No | - |  |
| previous_stock | number | No | - |  |
| new_stock | number | No | - |  |
| movement_date | string | No | - | Fecha del movimiento |

## Table: Order
| Field Name | Type | Required | Default | Enum/Description |
|------------|------|----------|---------|------------------|
| order_number | string | No | - |  |
| branch_id | string | **Yes** | - |  |
| customer_id | string | No | - |  |
| customer_name | string | No | - |  |
| status | string | No | "open" | Enum: [open, confirmed, paid, cancelled, voided] |
| items | array | No | - |  |
| subtotal | number | No | 0 |  |
| discount_total | number | No | 0 |  |
| tax_total | number | No | 0 |  |
| total | number | No | 0 |  |
| payment_method | string | No | "efectivo" | Enum: [efectivo, transferencia, tarjeta, credito, mixto] |
| amount_paid | number | No | 0 |  |
| change_amount | number | No | 0 |  |
| signature_url | string | No | - |  |
| notes | string | No | - |  |
| opened_at | string | No | - |  |
| closed_at | string | No | - |  |
| voided_reason | string | No | - |  |
| cashier_email | string | No | - |  |

## Table: OrderSequence
| Field Name | Type | Required | Default | Enum/Description |
|------------|------|----------|---------|------------------|
| branch_id | string | **Yes** | - | ID de la sucursal |
| branch_code | string | **Yes** | - | Serie: CF, GR, etc. |
| last_number | number | No | 0 | Último número de orden generado |
| last_order_number | string | No | - | Último número de orden completo, ej: CF-00001 |

## Table: Product
| Field Name | Type | Required | Default | Enum/Description |
|------------|------|----------|---------|------------------|
| name | string | **Yes** | - |  |
| sku | string | No | - |  |
| category_id | string | No | - | Category reference |
| image_url | string | No | - |  |
| unit | string | No | "unidad" | Enum: [unidad, paquete, caja, botella, libra, kilogramo, litro, vaso, porcion] |
| cost | number | No | 0 |  |
| price | number | **Yes** | 0 |  |
| wholesale_price | number | No | 0 |  |
| special_price | number | No | 0 |  |
| min_stock | number | No | 0 |  |
| is_active | boolean | No | true |  |
| is_favorite | boolean | No | false | Quick access shortcut |
| tax_rate | number | No | 0 |  |
| can_transform | boolean | No | false |  |
| transform_to_product_id | string | No | - | Product ID it transforms into |
| transform_quantity | number | No | - | How many units result from 1 transformation |

## Table: ProductPriceSchedule
| Field Name | Type | Required | Default | Enum/Description |
|------------|------|----------|---------|------------------|
| product_id | string | **Yes** | - | ID del producto |
| product_name | string | No | - | Nombre del producto (para referencia) |
| product_sku | string | No | - | SKU del producto (para referencia) |
| new_price | number | No | - | Nuevo precio de venta |
| new_wholesale_price | number | No | - | Nuevo precio mayorista |
| new_special_price | number | No | - | Nuevo precio especial |
| new_cost | number | No | - | Nuevo costo |
| effective_date | string | **Yes** | - | Fecha en que los nuevos precios entran en vigencia |
| applied | boolean | No | false | Si ya fue aplicado al producto |
| applied_at | string | No | - |  |
| notes | string | No | - |  |

## Table: Purchase
| Field Name | Type | Required | Default | Enum/Description |
|------------|------|----------|---------|------------------|
| purchase_number | string | No | - |  |
| supplier_id | string | **Yes** | - |  |
| supplier_name | string | No | - |  |
| branch_id | string | **Yes** | - |  |
| branch_name | string | No | - |  |
| status | string | No | "draft" | Enum: [draft, pending_approval, approved, ordered, received, cancelled] |
| items | array | No | - |  |
| total | number | No | 0 |  |
| notes | string | No | - |  |
| requested_by | string | No | - | Email of requester |
| approved_by | string | No | - | Email of approver |
| approved_at | string | No | - |  |
| received_date | string | No | - |  |
| approver_emails | array | No | - | List of approver emails to notify |

## Table: Supplier
| Field Name | Type | Required | Default | Enum/Description |
|------------|------|----------|---------|------------------|
| name | string | **Yes** | - |  |
| contact_name | string | No | - |  |
| phone | string | No | - |  |
| email | string | No | - |  |
| address | string | No | - |  |
| is_active | boolean | No | true |  |
| notes | string | No | - |  |

## Table: SupplierInvoice
| Field Name | Type | Required | Default | Enum/Description |
|------------|------|----------|---------|------------------|
| invoice_number | string | No | - | Número de factura del proveedor |
| purchase_id | string | No | - |  |
| purchase_number | string | No | - |  |
| supplier_id | string | **Yes** | - |  |
| supplier_name | string | No | - |  |
| branch_id | string | No | - |  |
| branch_name | string | No | - |  |
| items | array | No | - |  |
| subtotal | number | No | 0 |  |
| tax_amount | number | No | 0 | IVA u otro impuesto |
| total | number | **Yes** | 0 |  |
| due_date | string | No | - | Fecha de vencimiento de pago |
| status | string | No | "pending" | Enum: [pending, partial, paid, overdue, cancelled] |
| balance | number | No | 0 | Saldo pendiente |
| notes | string | No | - |  |
| received_by | string | No | - |  |
| received_date | string | No | - |  |

## Table: SupplierPayment
| Field Name | Type | Required | Default | Enum/Description |
|------------|------|----------|---------|------------------|
| supplier_invoice_id | string | **Yes** | - |  |
| supplier_id | string | No | - |  |
| supplier_name | string | No | - |  |
| amount | number | **Yes** | - |  |
| payment_method | string | No | "transferencia" | Enum: [efectivo, transferencia, cheque, tarjeta] |
| reference | string | No | - | Número de transferencia, cheque, etc. |
| branch_id | string | No | - |  |
| notes | string | No | - |  |

## Table: Transfer
| Field Name | Type | Required | Default | Enum/Description |
|------------|------|----------|---------|------------------|
| transfer_number | string | No | - | Consecutivo del traslado, ej: TRF-00001 |
| from_branch_id | string | **Yes** | - |  |
| from_branch_name | string | No | - |  |
| to_branch_id | string | **Yes** | - |  |
| to_branch_name | string | No | - |  |
| items | array | No | - |  |
| total_value | number | No | 0 |  |
| status | string | No | "active" | Enum: [active, voided] |
| notes | string | No | - |  |
| transferred_by | string | No | - | Email del usuario que hizo el traslado |

## Table: User
| Field Name | Type | Required | Default | Enum/Description |
|------------|------|----------|---------|------------------|
| role | string | No | "granada" | Rol del usuario: admin ve todo, los demás solo ven su sucursal Enum: [admin, granada, cofradia, prefaconsa] |
| branch_id | string | No | - | ID de la sucursal asignada (para roles de sucursal) |
| branch_name | string | No | - | Nombre de la sucursal asignada |

