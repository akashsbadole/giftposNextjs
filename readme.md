# Retail Store POS System

A comprehensive Point of Sale (POS) application for retail stores including liquor stores, gift shops, garment stores, and general retail businesses.

## Screenshot
![Retail-POS-System-customer](screenshots\Retail-POS-System-customer.png "Retail-POS-System-customer")
![Retail-POS-System-employee](screenshots\Retail-POS-System-employee.png "Retail-POS-System-employee")
![Retail-POS-System-homepage](screenshots\Retail-POS-System-homepage.png "Retail-POS-System-homepage")
![Retail-POS-System-products](screenshots\Retail-POS-System-products.png "Retail-POS-System-products")
![Retail-POS-System-reports](screenshots\Retail-POS-System-reports.png "Retail-POS-System-reports")
![Retail-POS-System-settings](screenshots\Retail-POS-System-settings.png "Retail-POS-System-settings")

## ⚠️ Development Status

**Current Version:** 0.1.0 (Development)

This POS system is currently in active development. While core functionality is working, several advanced features are incomplete or have known issues:

- **Held Orders System**: API endpoints exist but have dependency issues and are not fully functional
- **Multi-user Collaboration**: Framework exists but implementation is incomplete
- **Advanced Order Management**: State machine logic is not yet implemented
- **Performance Optimization**: Background job system is planned but not yet active

For production use, please test all features thoroughly before deployment.

## 🗺️ Development Roadmap

### Current Status (v0.1.0)
- **Core POS**: Fully functional ✅
- **Product/Customer Management**: Fully functional ✅
- **Authentication**: Fully functional ✅
- **Basic Reporting**: Functional ✅

### Planned Improvements (v0.2.0 - v0.3.0)
- **Cash Management System**: Shift tracking, cash drawer reconciliation
- **Transaction Holding**: Park and retrieve sales for queue management
- **Multi-tax Support**: VAT, regional tax rates beyond GST
- **Enhanced Reporting**: End-of-day reports, shift analytics

### Future Features (v1.0.0)
- **Product Variants**: Size, color, material variants
- **Offline Mode**: Local transaction queuing and sync
- **Advanced Analytics**: Sales forecasting, inventory optimization
- **API Integration**: Third-party accounting software integration
- **Multi-location Support**: Multiple store management

### Feature Priority
1. **High Priority**: Cash management, transaction holding
2. **Medium Priority**: Multi-tax support, enhanced reporting
3. **Low Priority**: Product variants, offline mode


## Features

### Core POS Functionality ✅ Working
- **Product Catalog**: Browse and search products by name, SKU, or barcode
- **Category Filtering**: Filter products by categories
- **Shopping Cart**: Add items with quantity management
- **Multiple Payment Methods**: Cash, Card, and Digital payments
- **Customer Selection**: Associate sales with customers
- **Tax Calculation**: Automatic GST calculation based on configurable rate
- **Receipt Generation**: View detailed sale receipts
- **Receipt Sharing**: Share via WhatsApp, Email, CSV export, or print
- **Mobile Optimized**: Touch-friendly interface for tablets and phones

### Advanced POS Features ⚠️ In Development
- **Held Orders**: Cannot pause/retrieve transactions (dependency issues)
- **Multi-user Collaboration**: Framework exists but implementation incomplete
- **Order State Management**: Advanced state machine logic not implemented
- **Background Job Processing**: Planned but not currently active

### Product Management
- Full CRUD operations for products
- SKU and barcode support
- Inventory tracking with low stock alerts
- Cost and price management
- Product categorization with color coding
- **NEW**: CSV Export - Export all products to spreadsheet format
- **NEW**: CSV Import - Bulk product creation from spreadsheet
- **NEW**: Automatic category validation during import

### Customer Management
- Customer database with contact information
- Loyalty points system (earned on purchases)
- Purchase history tracking with detailed transaction history
- Customer search functionality
- **NEW**: Integrated with employee authentication system

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
- **GST Management**: Configurable GST rates (5%, 10%, 15%, etc.)
- Currency settings
- Database reset functionality
- **NEW**: Employee management with role-based access
- **NEW**: Clerk authentication integration
- **NEW**: Maximum 3 employee restriction

## Technology Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript 5.x
- **Database**: SQLite with Prisma ORM
- **UI Components**: shadcn/ui
- **Styling**: Tailwind CSS 3.x/4.x (check package.json for exact version)
- **Icons**: Lucide React
- **Authentication**: Clerk
- **Build Tool**: Next.js built-in (Webpack/Turbopack)

> **Note**: This project uses a mix of dependencies. Check `package.json` for exact versions. Some features may require specific dependency versions.

## Getting Started

### 1. Authentication Setup (Required)

**IMPORTANT**: The system requires Clerk authentication for all users.

1. **Create Clerk Account**: Sign up at [clerk.com](https://clerk.com) and get your API keys
2. **Configure Environment**: Add Clerk keys to your `.env` file:
   ```env
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxxxx
   CLERK_SECRET_KEY=sk_test_xxxxx
   # Session duration (optional - defaults to reasonable POS session length)
   NEXT_PUBLIC_CLERK_SESSION_DURATION=1296000
   ```
3. **First Login**: 
   - Visit the application URL
   - Create your account through Clerk sign-up
   - First user automatically becomes Administrator
4. **Additional Users**:
   - Subsequent users become Staff members
   - Maximum 3 employees enforced by the system
   - Admin can change roles through the Employees section

> **💡 Authentication Notes**: 
> - Clerk handles all authentication security
> - Sessions persist across browser restarts (configurable duration)
> - See `CLERK_SESSION_CONFIG.md` for detailed session management options
> - All API endpoints require valid Clerk authentication

### 2. Database Setup

The database schema is already set up. Initialize it with sample data:

1. Navigate to the POS tab in the application
2. Click the "Initialize Database" button if prompted
3. This will add sample products, categories, and customers

### 3. Store Configuration

1. Go to **Settings** tab
2. Update store information (name, address, contact)
3. Set **GST Rate** (e.g., 10 for 10%)
4. Configure other settings as needed

### 4. Core Features Guide

#### ✅ Making a Sale (Fully Working)
1. **Sign In**: Authenticate with Clerk credentials
2. Navigate to the **POS** tab
3. Search for products by name, SKU, or barcode
4. Click on products to add them to the cart
5. Adjust quantities using +/- buttons
6. Select a customer (optional)
7. Click **Checkout** and select payment method
8. For cash payments, enter the tender amount
9. Complete the payment to finalize the sale
10. Share receipt via WhatsApp, Email, CSV, or print

#### ✅ Managing Products (Fully Working)
1. Navigate to the **Products** tab
2. Click **Add Product** to create new products
3. Fill in product details (name, SKU, price, stock, category)
4. Click **Create** to save
5. Edit or delete products using the action buttons
6. **CSV Import/Export**: Use import/export buttons for bulk operations

#### ✅ Managing Customers (Fully Working)
1. Navigate to the **Customers** tab
2. Click **Add Customer** to create new customers
3. Fill in customer information
4. Save to add to database
5. View customer purchase history and loyalty points

#### ✅ Viewing Reports (Fully Working)
1. Navigate to the **Reports** tab
2. View sales history, top products, and payment breakdowns
3. Click on sales to view detailed receipts
4. View sales statistics and analytics

#### ✅ Configuring Store Settings (Fully Working)
1. Navigate to the **Settings** tab
2. Update store information (name, address, contact)
3. Configure **GST Rate** (e.g., 10 for 10%)
4. Set currency and other preferences
5. Save changes to apply

#### ✅ Managing Employees (Fully Working)
1. Navigate to the **Settings** tab
2. Click **Employees** section
3. Add new employees with appropriate roles:
   - **Admin**: Full system access
   - **Manager**: Store settings and reports
   - **Staff**: POS operations only
4. Maximum 3 employees enforced automatically

### ⚠️ Advanced Features (Use with Caution)

#### Held Orders (Not Currently Functional)
- **Status**: API endpoints exist but have dependency issues
- **Impact**: Cannot pause or retrieve transactions during busy periods
- **Workaround**: Complete transactions immediately or use external notes

#### Multi-user Collaboration (Incomplete)
- **Status**: Framework exists but not fully implemented
- **Impact**: Limited real-time collaboration between staff members
- **Workaround**: Use separate devices or coordinate manually

#### Using New Receipt Sharing Features
**WhatsApp Sharing:**
1. Complete a sale in POS
2. Receipt dialog opens automatically
3. Enter customer's WhatsApp number (e.g., +91XXXXXXXXXX)
4. Click **"WhatsApp"** button
5. WhatsApp opens with formatted receipt

**Email Sharing:**
1. Complete a sale in POS
2. Receipt dialog opens automatically
3. Enter customer's email address
4. Click **"Email"** button
5. Email client opens with receipt details

#### Bulk Product Management
**CSV Export:**
1. Go to **Products** tab
2. Click **"Export"** button (top right)
3. CSV file downloads automatically
4. Filename: `products_export_[timestamp].csv`

**CSV Import:**
1. Go to **Products** tab
2. Click **"Import"** button (top right)
3. Select CSV file with required columns:
   - Required: Name, SKU, Price, Stock, Category
   - Optional: Barcode, Cost, Min Stock
4. Review import results and fix any errors

## 🔐 Authentication & Security

### Clerk Authentication
- **Required**: All users must authenticate via Clerk
- **Employee Limit**: Maximum 3 employees per store
- **Roles**: Admin, Manager, Staff with appropriate permissions
- **Session**: Automatic session management and renewal

### Security Features
- All API routes protected with authentication middleware
- Role-based access control for sensitive operations
- Employee limit enforcement at API level
- Secure JWT token validation

## API Endpoints

### Products ✅ Working
- `GET /api/pos/products` - List all products
- `POST /api/pos/products` - Create new product
- `PUT /api/pos/products/[id]` - Update product
- `DELETE /api/pos/products/[id]` - Delete product

### Categories ✅ Working
- `GET /api/pos/categories` - List all categories
- `POST /api/pos/categories` - Create new category

### Customers ✅ Working
- `GET /api/pos/customers` - List all customers
- `POST /api/pos/customers` - Create new customer
- `PUT /api/pos/customers/[id]` - Update customer
- `DELETE /api/pos/customers/[id]` - Delete customer
- `GET /api/pos/customers/[id]/purchases` - Get customer purchase history

### Sales ✅ Working
- `GET /api/pos/sales` - List all sales
- `POST /api/pos/sales` - Create new sale
- `GET /api/pos/sales/stats` - Get sales statistics

### Store ✅ Working
- `GET /api/pos/store/settings` - Get store settings
- `POST /api/pos/store/settings` - Update store settings
- `POST /api/pos/store/reset` - Reset all data

### Authentication ✅ Working
- `POST /api/auth/sync-user` - Sync Clerk user with employee database
- Automatic employee creation on first login

### Initialization ✅ Working
- `POST /api/pos/initialize` - Initialize database with sample data

### Employees ✅ Working
- `GET /api/pos/employees` - List all employees (with auth)
- `POST /api/pos/employees` - Create new employee (admin only)
- `GET /api/pos/employees/[id]` - Get employee details
- `PUT /api/pos/employees/[id]` - Update employee
- `DELETE /api/pos/employees/[id]` - Delete employee (admin only)

### Receipt Generation ✅ Working
- `GET /api/pos/receipt/[id]` - Generate receipt for sale

### Stock Management ✅ Working
- `GET /api/pos/stock` - Get stock levels
- `GET /api/pos/stock/low-stock` - Get low stock alerts

### Barcode Scanning ✅ Working
- `POST /api/pos/barcode` - Scan barcode and return product

### ⚠️ Advanced Features (In Development)

#### Held Orders ⚠️ Partial Implementation
- `POST /api/pos/orders/hold` - Hold order (has dependency issues)
- `GET /api/pos/orders/hold/[id]` - Retrieve held order (has dependency issues)
- Additional held order endpoints exist but are not functional

#### Order Management ❌ Not Implemented
- `/api/pos/orders/*` - Advanced order processing (framework exists, logic incomplete)
- `/api/pos/orders/collaboration/*` - Multi-user collaboration (incomplete)
- `/api/pos/orders/workflow/*` - Order state machine (not implemented)
- `/api/pos/orders/jobs/*` - Background job processing (not active)
- `/api/pos/orders/bulk/*` - Bulk order operations (incomplete)

#### Payment Processing ❌ Partial Framework
- `/api/pos/payments/*` - Payment provider integration (framework exists, limited functionality)
- `/api/pos/printers/*` - Printer integration (framework exists, limited testing)

#### Support System ❌ Framework Only
- `/api/support/*` - Support ticket system (framework exists, not functional)

> **Note**: Many advanced API endpoints exist as framework but lack full implementation. Core POS operations (products, customers, sales, authentication) are fully functional and production-ready.

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
1. **Authentication**: User must be logged in with valid Clerk session
2. Cart items are validated against available stock
3. Subtotal is calculated from item prices × quantities
4. **GST** is calculated based on configured GST rate
5. Total = Subtotal + GST
6. Stock is automatically updated on successful sale
7. Loyalty points are awarded to customers
8. Payment record is created with employee tracking
9. Stock log entry is created for each item
10. **Receipt Generation**: Complete receipt with sharing options

### Employee Management
1. **First User**: Automatically becomes Administrator
2. **Subsequent Users**: Become Staff members
3. **Maximum Limit**: System enforces 3-employee maximum
4. **Role Assignment**: Admin can promote/demote employees
5. **Session Sync**: Clerk users automatically sync with employee records

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
- **Store**: Default store configuration with GST support
- **5 Categories**: Beverages, Snacks, Dairy & Eggs, Baked Goods, Personal Care
- **12 Products**: Various items across all categories with realistic pricing
- **2 Customers**: Sample customers with existing loyalty points
- **Employee Structure**: Ready for Clerk authentication sync

## 🆕 What's New - Feature Summary

### ✅ Authentication System
- Clerk authentication integration
- Maximum 3 employee restriction
- Role-based access control (Admin/Manager/Staff)
- Automatic admin assignment for first user

### ✅ Receipt Sharing
- **WhatsApp Integration**: Share receipts directly to WhatsApp
- **Email Integration**: Send receipts via email
- **CSV Export**: Export receipt data
- **Print Ready**: Thermal printer friendly format

### ✅ Bulk Data Management
- **CSV Export**: Download all products as spreadsheet
- **CSV Import**: Bulk create products from spreadsheet
- **Format Validation**: Automatic validation during import
- **Category Matching**: Automatic category creation/validation

### ✅ GST Management
- **Configurable Rates**: Support for 5%, 10%, 15%, etc.
- **Automatic Calculation**: Real-time GST computation
- **Receipt Display**: GST breakdown on all receipts
- **Settings Integration**: Centralized GST configuration

### ✅ Mobile Responsiveness
- **Touch Optimized**: 44px minimum touch targets
- **Responsive Tabs**: Horizontal scroll on mobile
- **Adaptive Layouts**: Flexible grid systems
- **Mobile-First**: Optimized for tablets and phones

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

### Daily Operations
1. **Regular Backups**: Export products as CSV weekly
2. **Stock Management**: Update stock levels promptly after restocking
3. **Customer Data**: Keep customer information up to date
4. **Receipt Sharing**: Use WhatsApp/Email for better customer service
5. **Performance**: Use search and filters for large product catalogs

### Security & Access
1. **Employee Management**: Regularly review employee access and roles
2. **Authentication**: Ensure all team members use secure passwords
3. **Session Management**: Log out when not in use
4. **Data Protection**: Never share Clerk credentials

### Data Management
1. **CSV Exports**: Regular exports for backup purposes
2. **CSV Imports**: Use templates for consistent data entry
3. **Category Management**: Maintain clean category structure
4. **GST Configuration**: Update rates as regulations change

### Mobile Usage
1. **Device Optimization**: Use tablets for best POS experience
2. **Touch Interface**: Ensure buttons are easily tappable
3. **Network**: Stable internet required for authentication
4. **Backup**: Export data regularly on mobile devices

## 🚀 Current Status

**Status**: Development Version 0.1.0 ⚠️

### Core Functionality ✅ Ready
- Basic POS operations (product browsing, cart, checkout)
- Product and customer management
- Clerk authentication system
- Sales tracking and reporting
- Receipt generation and sharing
- CSV import/export for products
- Store configuration and settings

### Advanced Features ⚠️ In Development
- Held orders system (API exists but has dependency issues)
- Multi-user collaboration (framework incomplete)
- Advanced order state management (not implemented)
- Background job processing (planned but not active)
- Comprehensive printer integration (limited testing)
- Payment provider integration (framework exists)

### Requirements
- Clerk account with API keys
- Modern web browser
- Stable internet connection
- Touch device recommended for POS operations
- Development environment for testing advanced features

### Recommended Use
- **Small Retail Stores**: Core POS features are production-ready
- **Testing & Development**: Advanced features can be tested but may have issues
- **Production Deployment**: Test thoroughly before full deployment
- **Training**: Staff can be trained on core functionality immediately

### Next Steps for Production
1. Test all core features thoroughly in your environment
2. Configure production Clerk keys
3. Set up domain and SSL certificate
4. Consider PostgreSQL database for high-volume stores
5. Plan implementation of advanced features based on business needs


