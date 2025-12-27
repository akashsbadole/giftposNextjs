-- Enhanced Multi-Tax Support Migration
-- This migration adds comprehensive multi-tax support for production retail use

-- Tax Master Configuration
CREATE TABLE TaxTypes (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL, -- GST, CGST, SGST, IGST, CESS, etc.
    name TEXT NOT NULL,
    description TEXT,
    isActive BOOLEAN DEFAULT true,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Regional Tax Configuration
CREATE TABLE TaxRegions (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL, -- State codes (MH, DL, KA, etc.) or country codes (IN, US, etc.)
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- state, union_territory, country, international
    gstStateCode TEXT, -- For Indian states
    isActive BOOLEAN DEFAULT true,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tax Rates Master
CREATE TABLE TaxRates (
    id TEXT PRIMARY KEY,
    taxTypeId TEXT NOT NULL,
    regionId TEXT NOT NULL,
    rate DECIMAL(10,4) NOT NULL, -- Tax rate percentage
    effectiveFrom DATETIME NOT NULL,
    effectiveTo DATETIME,
    isActive BOOLEAN DEFAULT true,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (taxTypeId) REFERENCES TaxTypes(id),
    FOREIGN KEY (regionId) REFERENCES TaxRegions(id),
    UNIQUE(taxTypeId, regionId, effectiveFrom)
);

-- HSN Code Master
CREATE TABLE HSNCodeMaster (
    id TEXT PRIMARY KEY,
    hsnCode TEXT UNIQUE NOT NULL,
    description TEXT,
    taxCategory TEXT, -- Essential, Luxury, etc.
    defaultTaxRateId TEXT,
    isActive BOOLEAN DEFAULT true,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (defaultTaxRateId) REFERENCES TaxRates(id)
);

-- Product Tax Mapping
CREATE TABLE ProductTaxMapping (
    id TEXT PRIMARY KEY,
    productId TEXT NOT NULL,
    hsnCodeId TEXT,
    taxRateId TEXT NOT NULL,
    isTaxInclusive BOOLEAN DEFAULT false, -- Whether product price includes tax
    taxExempt BOOLEAN DEFAULT false,
    effectiveFrom DATETIME DEFAULT CURRENT_TIMESTAMP,
    effectiveTo DATETIME,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (productId) REFERENCES Product(id),
    FOREIGN KEY (hsnCodeId) REFERENCES HSNCodeMaster(id),
    FOREIGN KEY (taxRateId) REFERENCES TaxRates(id)
);

-- Category Tax Mapping
CREATE TABLE CategoryTaxMapping (
    id TEXT PRIMARY KEY,
    categoryId TEXT NOT NULL,
    hsnCodeId TEXT,
    taxRateId TEXT NOT NULL,
    isTaxInclusive BOOLEAN DEFAULT false,
    taxExempt BOOLEAN DEFAULT false,
    effectiveFrom DATETIME DEFAULT CURRENT_TIMESTAMP,
    effectiveTo DATETIME,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (categoryId) REFERENCES Category(id),
    FOREIGN KEY (hsnCodeId) REFERENCES HSNCodeMaster(id),
    FOREIGN KEY (taxRateId) REFERENCES TaxRates(id)
);

-- Tax Rules for Complex Scenarios
CREATE TABLE TaxRules (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    ruleType TEXT NOT NULL, -- exemption, holiday, special_scheme, customer_based
    conditions TEXT NOT NULL, -- JSON conditions
    taxRateId TEXT,
    discountPercentage DECIMAL(5,2), -- For tax exemptions/breaks
    effectiveFrom DATETIME NOT NULL,
    effectiveTo DATETIME,
    isActive BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 0, -- For rule precedence
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (taxRateId) REFERENCES TaxRates(id)
);

-- Customer Tax Exemptions
CREATE TABLE CustomerTaxExemptions (
    id TEXT PRIMARY KEY,
    customerId TEXT NOT NULL,
    taxRuleId TEXT NOT NULL,
    effectiveFrom DATETIME NOT NULL,
    effectiveTo DATETIME,
    isActive BOOLEAN DEFAULT true,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customerId) REFERENCES Customer(id),
    FOREIGN KEY (taxRuleId) REFERENCES TaxRules(id)
);

-- Enhanced Sale with Multi-Tax Support
CREATE TABLE SaleTaxBreakdown (
    id TEXT PRIMARY KEY,
    saleId TEXT NOT NULL,
    taxTypeId TEXT NOT NULL,
    taxRateId TEXT NOT NULL,
    baseAmount DECIMAL(10,2) NOT NULL, -- Amount before tax
    taxPercentage DECIMAL(10,4) NOT NULL, -- Tax rate percentage
    taxAmount DECIMAL(10,2) NOT NULL, -- Calculated tax amount
    isCompound BOOLEAN DEFAULT false, -- For compound taxes
    parentTaxId TEXT, -- For compound tax relationships
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (saleId) REFERENCES Sale(id),
    FOREIGN KEY (taxTypeId) REFERENCES TaxTypes(id),
    FOREIGN KEY (taxRateId) REFERENCES TaxRates(id),
    FOREIGN KEY (parentTaxId) REFERENCES SaleTaxBreakdown(id)
);

-- Enhanced Sale Item with Tax Breakdown
CREATE TABLE SaleItemTaxBreakdown (
    id TEXT PRIMARY KEY,
    saleItemId TEXT NOT NULL,
    taxTypeId TEXT NOT NULL,
    taxRateId TEXT NOT NULL,
    baseAmount DECIMAL(10,2) NOT NULL, -- Amount before tax
    taxPercentage DECIMAL(10,4) NOT NULL,
    taxAmount DECIMAL(10,2) NOT NULL,
    hsnCode TEXT, -- HSN code for this line item
    isCompound BOOLEAN DEFAULT false,
    parentTaxId TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (saleItemId) REFERENCES SaleItem(id),
    FOREIGN KEY (taxTypeId) REFERENCES TaxTypes(id),
    FOREIGN KEY (taxRateId) REFERENCES TaxRates(id),
    FOREIGN KEY (parentTaxId) REFERENCES SaleItemTaxBreakdown(id)
);

-- Tax Invoice Configuration
CREATE TABLE TaxInvoiceSettings (
    id TEXT PRIMARY KEY,
    storeId TEXT NOT NULL,
    formatType TEXT DEFAULT 'standard', -- standard, simplified, export
    includeHSNCodes BOOLEAN DEFAULT true,
    includeTaxBreakdown BOOLEAN DEFAULT true,
    includeSellerDetails BOOLEAN DEFAULT true,
    includeBuyerDetails BOOLEAN DEFAULT true,
    digitalSignatureRequired BOOLEAN DEFAULT false,
    templateConfig TEXT, -- JSON template configuration
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (storeId) REFERENCES Store(id)
);

-- Tax Compliance Reports
CREATE TABLE TaxComplianceReports (
    id TEXT PRIMARY KEY,
    storeId TEXT NOT NULL,
    reportType TEXT NOT NULL, -- GSTR1, GSTR3B, monthly_summary, annual_summary
    reportPeriod TEXT NOT NULL, -- 2024-12, 2024-Q4, etc.
    data TEXT NOT NULL, -- JSON report data
    status TEXT DEFAULT 'draft', -- draft, generated, submitted, accepted, rejected
    generatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    submittedAt DATETIME,
    acceptanceStatus TEXT, -- accepted, rejected, pending
    remarks TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (storeId) REFERENCES Store(id)
);

-- Tax Audit Trail
CREATE TABLE TaxAuditTrail (
    id TEXT PRIMARY KEY,
    saleId TEXT,
    saleItemId TEXT,
    action TEXT NOT NULL, -- calculated, adjusted, exempted, manual_override
    previousTaxData TEXT, -- JSON previous tax data
    newTaxData TEXT NOT NULL, -- JSON new tax data
    reason TEXT, -- Reason for change
    userId TEXT, -- Clerk user ID
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (saleId) REFERENCES Sale(id),
    FOREIGN KEY (saleItemId) REFERENCES SaleItem(id)
);

-- Input Tax Credit Tracking
CREATE TABLE InputTaxCredit (
    id TEXT PRIMARY KEY,
    storeId TEXT NOT NULL,
    taxTypeId TEXT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    creditDate DATETIME NOT NULL,
    referenceType TEXT, -- purchase, adjustment, carry_forward
    referenceId TEXT, -- Reference to purchase or adjustment
    isUtilized BOOLEAN DEFAULT false,
    utilizedAmount DECIMAL(10,2) DEFAULT 0,
    utilizationDate DATETIME,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (storeId) REFERENCES Store(id),
    FOREIGN KEY (taxTypeId) REFERENCES TaxTypes(id)
);

-- Tax Holiday Configuration
CREATE TABLE TaxHolidayConfig (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    startDate DATETIME NOT NULL,
    endDate DATETIME NOT NULL,
    applicableRegions TEXT, -- JSON array of region IDs
    taxExemptions TEXT, -- JSON array of tax type IDs
    productCategories TEXT, -- JSON array of category IDs
    isActive BOOLEAN DEFAULT true,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_tax_rates_active ON TaxRates(isActive, effectiveFrom, effectiveTo);
CREATE INDEX idx_tax_regions_active ON TaxRegions(isActive);
CREATE INDEX idx_product_tax_mapping_active ON ProductTaxMapping(isTaxExempt, effectiveFrom, effectiveTo);
CREATE INDEX idx_category_tax_mapping_active ON CategoryTaxMapping(isTaxExempt, effectiveFrom, effectiveTo);
CREATE INDEX idx_tax_rules_active ON TaxRules(isActive, effectiveFrom, effectiveTo);
CREATE INDEX idx_sale_tax_breakdown_sale ON SaleTaxBreakdown(saleId);
CREATE INDEX idx_sale_item_tax_breakdown_item ON SaleItemTaxBreakdown(saleItemId);
CREATE INDEX idx_tax_audit_trail_sale ON TaxAuditTrail(saleId);
CREATE INDEX idx_input_tax_credit_store ON InputTaxCredit(storeId, isUtilized);

-- Insert default tax types for Indian GST system
INSERT INTO TaxTypes (id, code, name, description) VALUES
('tt_gst', 'GST', 'Goods and Services Tax', 'General GST rate'),
('tt_cgst', 'CGST', 'Central Goods and Services Tax', 'Central portion of GST'),
('tt_sgst', 'SGST', 'State Goods and Services Tax', 'State portion of GST'),
('tt_igst', 'IGST', 'Integrated Goods and Services Tax', 'Inter-state GST'),
('tt_cess', 'CESS', 'Compensation Cess', 'Compensation cess on certain goods'),
('tt_excise', 'EXCISE', 'Excise Duty', 'Excise duty on manufacturing'),
('tt_vat', 'VAT', 'Value Added Tax', 'State VAT (pre-GST)'),
('tt_customs', 'CUSTOMS', 'Customs Duty', 'Import/Export customs duty');

-- Insert default Indian regions
INSERT INTO TaxRegions (id, code, name, type, gstStateCode) VALUES
('tr_mh', 'MH', 'Maharashtra', 'state', '27'),
('tr_dl', 'DL', 'Delhi', 'state', '07'),
('tr_ka', 'KA', 'Karnataka', 'state', '29'),
('tr_tn', 'TN', 'Tamil Nadu', 'state', '33'),
('tr_gj', 'GJ', 'Gujarat', 'state', '24'),
('tr_rj', 'RJ', 'Rajasthan', 'state', '08'),
('tr_up', 'UP', 'Uttar Pradesh', 'state', '09'),
('tr_wb', 'WB', 'West Bengal', 'state', '19'),
('tr_ap', 'AP', 'Andhra Pradesh', 'state', '37'),
('tr_ts', 'TS', 'Telangana', 'state', '36'),
('tr_kl', 'KL', 'Kerala', 'state', '32'),
('tr_mp', 'MP', 'Madhya Pradesh', 'state', '23'),
('tr_ch', 'CH', 'Chandigarh', 'union_territory', '04'),
('tr_dn', 'DN', 'Dadra and Nagar Haveli', 'union_territory', '26'),
('tr_dd', 'DD', 'Daman and Diu', 'union_territory', '25'),
('tr_lakshadweep', 'LD', 'Lakshadweep', 'union_territory', '31'),
('tr_andaman', 'AN', 'Andaman and Nicobar Islands', 'union_territory', '35'),
('tr_puducherry', 'PY', 'Puducherry', 'union_territory', '34'),
('tr_in', 'IN', 'India', 'country', NULL);

-- Insert default HSN codes with basic categories
INSERT INTO HSNCodeMaster (id, hsnCode, description, taxCategory) VALUES
('hn_1006', '1006', 'Rice', 'Essential'),
('hn_1901', '1901', 'Bread and bakery items', 'Essential'),
('hn_2201', '2201', 'Water', 'Essential'),
('hn_2402', '2402', 'Cigarettes and tobacco', 'Sin'),
('hn_3004', '3004', 'Medicines', 'Essential'),
('hn_8703', '8703', 'Motor cars and motor vehicles', 'Luxury'),
('hn_8517', '8517', 'Telecommunications equipment', 'Standard'),
('hn_6403', '6403', 'Footwear', 'Standard'),
('hn_6203', '6203', 'Men\'s clothing', 'Standard'),
('hn_6204', '6204', 'Women\'s clothing', 'Standard');