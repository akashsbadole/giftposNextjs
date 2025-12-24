import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const barcode = searchParams.get('barcode')

    if (!barcode) {
      return NextResponse.json(
        { error: 'Barcode parameter is required' },
        { status: 400 }
      )
    }

    // Find product by barcode
    const product = await db.product.findFirst({
      where: {
        barcode: barcode.trim(),
        isActive: true
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            color: true
          }
        }
      }
    })

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(product)
  } catch (error) {
    console.error('Barcode lookup error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { barcode, format, productData } = body

    if (!barcode) {
      return NextResponse.json(
        { error: 'Barcode is required' },
        { status: 400 }
      )
    }

    // Check if barcode already exists
    const existingProduct = await db.product.findFirst({
      where: {
        barcode: barcode.trim(),
        isActive: true
      }
    })

    if (existingProduct) {
      return NextResponse.json(
        { error: 'Barcode already exists' },
        { status: 409 }
      )
    }

    // Validate barcode format
    const isValidFormat = validateBarcodeFormat(barcode, format)
    if (!isValidFormat) {
      return NextResponse.json(
        { error: 'Invalid barcode format' },
        { status: 400 }
      )
    }

    // If product data is provided, create/update product
    if (productData) {
      const { name, sku, price, stock, categoryId } = productData

      // Validate required fields
      if (!name || !sku || !price || !categoryId) {
        return NextResponse.json(
          { error: 'Missing required product fields' },
          { status: 400 }
        )
      }

      // Check if SKU already exists
      const existingSku = await db.product.findFirst({
        where: { sku: sku.trim() }
      })

      if (existingSku) {
        return NextResponse.json(
          { error: 'SKU already exists' },
          { status: 409 }
        )
      }

      // Create new product with barcode
      const product = await db.product.create({
        data: {
          name: name.trim(),
          sku: sku.trim(),
          barcode: barcode.trim(),
          price: parseFloat(price),
          stock: parseInt(stock) || 0,
          cost: parseFloat(productData.cost) || 0,
          minStock: parseInt(productData.minStock) || 0,
          categoryId,
          description: productData.description?.trim() || null,
          storeId: productData.storeId,
          isActive: true
        },
        include: {
          category: {
            select: {
              id: true,
              name: true,
              color: true
            }
          }
        }
      })

      return NextResponse.json({
        message: 'Product created successfully',
        product
      })
    }

    return NextResponse.json({
      message: 'Barcode validation successful',
      barcode: barcode.trim(),
      format
    })
  } catch (error) {
    console.error('Barcode creation error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { oldBarcode, newBarcode, format } = body

    if (!oldBarcode || !newBarcode) {
      return NextResponse.json(
        { error: 'Both old and new barcode are required' },
        { status: 400 }
      )
    }

    // Find product by old barcode
    const product = await db.product.findFirst({
      where: {
        barcode: oldBarcode.trim(),
        isActive: true
      }
    })

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      )
    }

    // Check if new barcode already exists (and it's not the same product)
    const existingProduct = await db.product.findFirst({
      where: {
        barcode: newBarcode.trim(),
        id: { not: product.id }
      }
    })

    if (existingProduct) {
      return NextResponse.json(
        { error: 'New barcode already exists' },
        { status: 409 }
      )
    }

    // Validate new barcode format
    const isValidFormat = validateBarcodeFormat(newBarcode, format)
    if (!isValidFormat) {
      return NextResponse.json(
        { error: 'Invalid barcode format' },
        { status: 400 }
      )
    }

    // Update product barcode
    const updatedProduct = await db.product.update({
      where: { id: product.id },
      data: { barcode: newBarcode.trim() },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            color: true
          }
        }
      }
    })

    return NextResponse.json({
      message: 'Barcode updated successfully',
      product: updatedProduct
    })
  } catch (error) {
    console.error('Barcode update error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const barcode = searchParams.get('barcode')

    if (!barcode) {
      return NextResponse.json(
        { error: 'Barcode parameter is required' },
        { status: 400 }
      )
    }

    // Find product by barcode
    const product = await db.product.findFirst({
      where: {
        barcode: barcode.trim(),
        isActive: true
      }
    })

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      )
    }

    // Remove barcode from product (set to null)
    const updatedProduct = await db.product.update({
      where: { id: product.id },
      data: { barcode: null },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            color: true
          }
        }
      }
    })

    return NextResponse.json({
      message: 'Barcode removed successfully',
      product: updatedProduct
    })
  } catch (error) {
    console.error('Barcode deletion error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Barcode format validation
function validateBarcodeFormat(barcode: string, format?: string): boolean {
  const trimmedBarcode = barcode.trim()
  
  // Format-specific validation
  if (format) {
    switch (format.toLowerCase()) {
      case 'ean13':
        return /^\d{13}$/.test(trimmedBarcode)
      case 'ean8':
        return /^\d{8}$/.test(trimmedBarcode)
      case 'upc_a':
      case 'upca':
        return /^\d{12}$/.test(trimmedBarcode)
      case 'upc_e':
      case 'upce':
        return /^\d{8}$/.test(trimmedBarcode)
      case 'code128':
        return /^[\x00-\x7F]+$/.test(trimmedBarcode)
      case 'code39':
        return /^[0-9A-Z\-\.\$\/\+\%\*\s]+$/.test(trimmedBarcode)
      case 'itf14':
        return /^\d{14}$/.test(trimmedBarcode)
      case 'codabar':
        return /^[0-9\-\$\:\.\/\+ABCD]+$/.test(trimmedBarcode)
      default:
        break
    }
  }

  // General validation - check if it matches any known format
  const formats = [
    /^\d{13}$/,  // EAN-13
    /^\d{8}$/,   // EAN-8
    /^\d{12}$/,  // UPC-A
    /^\d{8}$/,   // UPC-E or EAN-8
    /^[\x00-\x7F]+$/,  // Code128
    /^[0-9A-Z\-\.\$\/\+\%\*\s]+$/,  // Code39
    /^\d{14}$/,  // ITF-14
    /^[0-9\-\$\:\.\/\+ABCD]+$/,  // Codabar
  ]

  return formats.some(pattern => pattern.test(trimmedBarcode))
}