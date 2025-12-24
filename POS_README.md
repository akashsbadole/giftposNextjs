# Retail Store POS System

A comprehensive Point of Sale (POS) application for retail stores including liquor stores, gift shops, garment stores, and general retail businesses.

## Features

### Core POS Functionality
- **Product Catalog**: Browse and search products by name, SKU, or barcode
- **Category Filtering**: Filter products by categories
- **Shopping Cart**: Add items with quantity management
- **Multiple Payment Methods**: Cash, Card, and Digital payments
- **Customer Selection**: Associate sales with customers
- **Tax Calculation**: Automatic tax calculation based on configurable rate
- **Receipt Generation**: View detailed sale receipts

### Product Management
- Full CRUD operations for products
- SKU and barcode support
- Inventory tracking with low stock alerts
- Cost and price management
- Product categorization with color coding
- Bulk operations support

### Customer Management
- Customer database with contact information
- Loyalty points system (earned on purchases)
- Purchase history tracking
- Customer search functionality

### Sales & Reports
- Real-time sales tracking
- Sales statistics and analytics
- Top-selling products report
- Payment method breakdown
- Transaction history with detailed receipts
- Revenue and transaction metrics

### Inventory Management
- Stock level tracking
- Automatic stock updates on sales
- Low stock alerts with configurable thresholds
- Stock movement logging (sales, restocks, returns, adjustments)
- Inventory reports

### Store Configuration
- Store information management
- Tax rate configuration
- Currency settings
- Database reset functionality

## Technology Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript 5
- **Database**: SQLite with Prisma ORM
- **UI Components**: shadcn/ui
- **Styling**: Tailwind CSS 4
- **Icons**: Lucide React

## Getting Started

### 1. Database Setup

The database schema is already set up. Initialize it with sample data:

1. Navigate to the POS tab in the application
2. Click the "Initialize Database" button if prompted
3. This will add sample products, categories, and customers

### 2. Using the POS System

#### Making a Sale
1. Navigate to the **POS** tab
2. Search for products by name, SKU, or barcode
3. Click on products to add them to the cart
4. Adjust quantities using +/- buttons
5. Select a customer (optional)
6. Click **Checkout** and select payment method
7. For cash payments, enter the tender amount
8. Complete the payment to finalize the sale

#### Managing Products
1. Navigate to the **Products** tab
2. Click **Add Product** to create new products
3. Fill in product details (name, SKU, price, stock, category)
4. Click **Create** to save
5. Edit or delete products using the action buttons

#### Managing Customers
1. Navigate to the **Customers** tab
2. Click **Add Customer** to create new customers
3. Fill in customer information
4. Save to add to database

#### Viewing Reports
1. Navigate to the **Reports** tab
2. View sales history, top products, and payment breakdowns
3. Click on sales to view detailed receipts

#### Configuring Store Settings
1. Navigate to the **Settings** tab
2. Update store information (name, address, contact)
3. Configure tax rate and currency
4. Save changes to apply

## API Endpoints

### Products
- `GET /api/pos/products` - List all products
- `POST /api/pos/products` - Create new product
- `PUT /api/pos/products/[id]` - Update product
- `DELETE /api/pos/products/[id]` - Delete product

### Categories
- `GET /api/pos/categories` - List all categories
- `POST /api/pos/categories` - Create new category

### Customers
- `GET /api/pos/customers` - List all customers
- `POST /api/pos/customers` - Create new customer
- `PUT /api/pos/customers/[id]` - Update customer
- `DELETE /api/pos/customers/[id]` - Delete customer

### Sales
- `GET /api/pos/sales` - List all sales
- `POST /api/pos/sales` - Create new sale
- `GET /api/pos/sales/stats` - Get sales statistics

### Store
- `GET /api/pos/store/settings` - Get store settings
- `POST /api/pos/store/settings` - Update store settings
- `POST /api/pos/store/reset` - Reset all data

### Initialization
- `POST /api/pos/initialize` - Initialize database with sample data

## Database Schema

### Models
- **Store**: Store configuration and settings
- **Category**: Product categories with color coding
- **Product**: Inventory items with pricing and stock
- **Customer**: Customer information with loyalty points
- **Employee**: Store staff and cashiers
- **Sale**: Sales transactions with totals and payment info
- **SaleItem**: Individual items within a sale
- **Payment**: Payment transaction details
- **StockLog**: Inventory movement tracking

## Business Logic

### Sales Processing
1. Cart items are validated against available stock
2. Subtotal is calculated from item prices × quantities
3. Tax is calculated based on configured tax rate
4. Total = Subtotal + Tax - Discount
5. Stock is automatically updated on successful sale
6. Loyalty points are awarded to customers
7. Payment record is created
8. Stock log entry is created for each item

### Inventory Management
- Stock levels are automatically decremented on sales
- Low stock alerts trigger when stock ≤ minimum threshold
- All stock movements are logged for auditing
- Stock can be manually adjusted via database

### Loyalty Program
- Customers earn 1 point per dollar spent
- Points are accumulated over multiple purchases
- Customer points are displayed in POS and customer management

## Sample Data

The initialization script creates:
- **Store**: Default store configuration
- **5 Categories**: Beverages, Snacks, Dairy & Eggs, Baked Goods, Personal Care
- **12 Products**: Various items across all categories with realistic pricing
- **2 Customers**: Sample customers with existing loyalty points

## Customization

### Adding New Categories
1. Create category via Products management or API
2. Assign a color for visual distinction
3. Products can be assigned to the new category

### Changing Tax Rate
1. Go to Settings tab
2. Update Tax Rate field
3. Save changes
4. Future sales will use new rate

### Currency Configuration
1. Go to Settings tab
2. Update Currency field (e.g., USD, EUR, GBP)
3. Save changes
4. All prices display with new currency symbol

## Best Practices

1. **Regular Backups**: Export database regularly
2. **Stock Management**: Update stock levels promptly after restocking
3. **Customer Data**: Keep customer information up to date
4. **Security**: Reset data carefully as it cannot be undone
5. **Performance**: Use search and filters for large product catalogs

## Support

For issues or questions, refer to the API documentation or check the Next.js development logs.

## License

This project is part of the Z.ai Code development environment.
