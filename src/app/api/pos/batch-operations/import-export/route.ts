import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { auth } from '@clerk/nextjs/server'
import { AuditLogger } from '@/lib/security/audit-logger'
import { BatchOperationManager } from '@/lib/batch-operations-manager'

const prisma = new PrismaClient()

// POST /api/pos/batch-operations/import-export - Handle file upload and processing for import/export
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const operationType = formData.get('operationType') as string
    const entityType = formData.get('entityType') as string
    const storeId = formData.get('storeId') as string
    const batchOperationId = formData.get('batchOperationId') as string
    const userName = formData.get('userName') as string
    const userEmail = formData.get('userEmail') as string
    const parameters = JSON.parse(formData.get('parameters') as string || '{}')

    // Validate required fields
    if (!file || !operationType || !entityType || !storeId) {
      return NextResponse.json(
        { error: 'File, operationType, entityType, and storeId are required' },
        { status: 400 }
      )
    }

    // Validate file type
    const allowedTypes = ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/json']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Unsupported file type. Only CSV, Excel, and JSON files are allowed' },
        { status: 400 }
      )
    }

    // Check file size (max 50MB)
    const maxSize = 50 * 1024 * 1024 // 50MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File size too large. Maximum size is 50MB' },
        { status: 400 }
      )
    }

    let batchOperation = null
    let fileRecord = null

    // If batchOperationId is provided, get the existing operation
    if (batchOperationId) {
      batchOperation = await prisma.batchOperation.findUnique({
        where: { operationId: batchOperationId }
      })

      if (!batchOperation) {
        return NextResponse.json({ error: 'Batch operation not found' }, { status: 404 })
      }
    } else {
      // Create a new batch operation for this file
      const operationId = `BO-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`
      
      batchOperation = await prisma.batchOperation.create({
        data: {
          operationId,
          name: `${operationType} ${entityType}`,
          description: `${operationType} operation for ${entityType}`,
          type: operationType,
          entityType,
          status: 'queued',
          storeId,
          userId,
          parameters: JSON.stringify(parameters),
          metadata: JSON.stringify({
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
            createdBy: userName || userEmail
          })
        }
      })
    }

    // Create file record
    const fileType = file.type.includes('csv') ? 'csv' : 
                   file.type.includes('excel') || file.type.includes('spreadsheet') ? 'xlsx' : 'json'

    fileRecord = await prisma.batchOperationFile.create({
      data: {
        batchOperationId: batchOperation.id,
        fileName: file.name,
        originalFileName: file.name,
        fileType,
        fileSize: file.size,
        mimeType: file.type,
        fileStatus: 'uploaded'
      }
    })

    // Process the file based on type
    let processedData = null
    let validationResults = null
    let previewData = null

    try {
      // Read file content (in a real implementation, you'd use proper file parsing libraries)
      const fileBuffer = await file.arrayBuffer()
      const fileContent = Buffer.from(fileBuffer)

      // Parse based on file type
      switch (fileType) {
        case 'csv':
          processedData = await parseCSV(fileContent.toString())
          break
        case 'xlsx':
          processedData = await parseExcel(fileContent)
          break
        case 'json':
          processedData = await parseJSON(fileContent.toString())
          break
        default:
          throw new Error('Unsupported file type')
      }

      // Generate preview data (first 10 rows)
      previewData = processedData.slice(0, 10)
      
      // Validate data based on entity type
      validationResults = await validateData(processedData, entityType, operationType)

      // Update file record with processing results
      await prisma.batchOperationFile.update({
        where: { id: fileRecord.id },
        data: {
          fileStatus: 'processed',
          totalRows: processedData.length,
          validRows: validationResults.validCount,
          invalidRows: validationResults.invalidCount,
          previewData: JSON.stringify(previewData),
          processedAt: new Date()
        }
      })

      // Update batch operation with record counts
      await prisma.batchOperation.update({
        where: { id: batchOperation.id },
        data: {
          totalRecords: processedData.length,
          validationResults: JSON.stringify(validationResults)
        }
      })

      // If this is an immediate operation (not queued), start processing
      if (operationType === 'import' && batchOperation.status === 'queued') {
        await processImportOperation(batchOperation.operationId, processedData, parameters, storeId, userId, userName, userEmail)
      }

    } catch (parseError) {
      // Update file record with error
      await prisma.batchOperationFile.update({
        where: { id: fileRecord.id },
        data: {
          fileStatus: 'failed',
          errorRows: processedData ? processedData.length : 0
        }
      })

      return NextResponse.json(
        { 
          error: 'Failed to process file',
          details: parseError instanceof Error ? parseError.message : 'Unknown error'
        },
        { status: 400 }
      )
    }

    // Log the file upload and processing
    await AuditLogger.log({
      timestamp: new Date(),
      userId,
      userEmail: userEmail || undefined,
      action: 'batch_file_processed',
      resource: 'batch_operation_file',
      resourceId: fileRecord.id,
      method: 'POST',
      path: request.url,
      status: 'success',
      severity: 'medium',
      details: {
        operationId: batchOperation.operationId,
        fileName: file.name,
        fileType,
        fileSize: file.size,
        operationType,
        entityType,
        totalRows: processedData.length,
        validRows: validationResults.validCount,
        invalidRows: validationResults.invalidCount
      }
    })

    return NextResponse.json({
      success: true,
      batchOperation: {
        operationId: batchOperation.operationId,
        id: batchOperation.id,
        status: batchOperation.status,
        totalRecords: processedData.length
      },
      file: {
        id: fileRecord.id,
        fileName: fileRecord.fileName,
        fileType: fileRecord.fileType,
        fileStatus: fileRecord.fileStatus,
        totalRows: fileRecord.totalRows,
        validRows: fileRecord.validRows,
        invalidRows: fileRecord.invalidRows
      },
      preview: previewData,
      validation: validationResults,
      message: 'File processed successfully'
    })

  } catch (error) {
    console.error('Error processing file:', error)
    return NextResponse.json(
      { error: 'Failed to process file' },
      { status: 500 }
    )
  }
}

// GET /api/pos/batch-operations/import-export - Download export file
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const operationId = searchParams.get('operationId')
    const format = searchParams.get('format') || 'csv'
    const storeId = searchParams.get('storeId')

    if (!operationId || !storeId) {
      return NextResponse.json(
        { error: 'Operation ID and Store ID are required' },
        { status: 400 }
      )
    }

    // Get the batch operation
    const batchOperation = await prisma.batchOperation.findFirst({
      where: {
        operationId,
        storeId
      },
      include: {
        files: {
          where: { fileType: format },
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    })

    if (!batchOperation) {
      return NextResponse.json({ error: 'Batch operation not found' }, { status: 404 })
    }

    if (batchOperation.type !== 'export') {
      return NextResponse.json({ error: 'Not an export operation' }, { status: 400 })
    }

    // Get the export data
    const resultData = batchOperation.resultData ? JSON.parse(batchOperation.resultData) : null
    if (!resultData || !resultData.results || !resultData.results[0] || !resultData.results[0].data) {
      return NextResponse.json({ error: 'Export data not found' }, { status: 404 })
    }

    const exportData = resultData.results[0].data

    // Generate file content based on format
    let fileContent = ''
    let mimeType = ''
    let fileExtension = ''

    switch (format) {
      case 'csv':
        fileContent = generateCSV(exportData)
        mimeType = 'text/csv'
        fileExtension = 'csv'
        break
      case 'xlsx':
        // In a real implementation, you'd use a library like ExcelJS
        fileContent = JSON.stringify(exportData, null, 2)
        mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        fileExtension = 'xlsx'
        break
      case 'json':
        fileContent = JSON.stringify(exportData, null, 2)
        mimeType = 'application/json'
        fileExtension = 'json'
        break
      default:
        return NextResponse.json({ error: 'Unsupported format' }, { status: 400 })
    }

    // Generate filename
    const filename = `${batchOperation.entityType}_export_${new Date().toISOString().split('T')[0]}.${fileExtension}`

    return new NextResponse(fileContent, {
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': fileContent.length.toString()
      }
    })

  } catch (error) {
    console.error('Error generating export file:', error)
    return NextResponse.json(
      { error: 'Failed to generate export file' },
      { status: 500 }
    )
  }
}

// Helper function to parse CSV
async function parseCSV(content: string): Promise<any[]> {
  const lines = content.split('\n').filter(line => line.trim())
  if (lines.length === 0) return []

  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
  const rows = []

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''))
    const row: any = {}
    
    headers.forEach((header, index) => {
      row[header] = values[index] || ''
    })
    
    rows.push(row)
  }

  return rows
}

// Helper function to parse Excel (placeholder - would use ExcelJS in real implementation)
async function parseExcel(buffer: Buffer): Promise<any[]> {
  // This is a placeholder. In a real implementation, you would use ExcelJS or similar
  // to parse Excel files properly
  throw new Error('Excel parsing not implemented - would use ExcelJS library')
}

// Helper function to parse JSON
async function parseJSON(content: string): Promise<any[]> {
  try {
    const data = JSON.parse(content)
    return Array.isArray(data) ? data : [data]
  } catch (error) {
    throw new Error('Invalid JSON format')
  }
}

// Helper function to validate data
async function validateData(data: any[], entityType: string, operationType: string) {
  const validation = {
    isValid: true,
    errors: [] as string[],
    warnings: [] as string[],
    validCount: 0,
    invalidCount: 0
  }

  for (let i = 0; i < data.length; i++) {
    const record = data[i]
    let isRecordValid = true

    switch (entityType) {
      case 'products':
        if (!record.sku) {
          validation.errors.push(`Row ${i + 1}: SKU is required`)
          isRecordValid = false
        }
        if (!record.name) {
          validation.errors.push(`Row ${i + 1}: Product name is required`)
          isRecordValid = false
        }
        if (!record.price || isNaN(parseFloat(record.price))) {
          validation.errors.push(`Row ${i + 1}: Valid price is required`)
          isRecordValid = false
        }
        break

      case 'customers':
        if (!record.name) {
          validation.errors.push(`Row ${i + 1}: Customer name is required`)
          isRecordValid = false
        }
        if (!record.email && !record.phone) {
          validation.errors.push(`Row ${i + 1}: Either email or phone is required`)
          isRecordValid = false
        }
        if (record.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(record.email)) {
          validation.errors.push(`Row ${i + 1}: Invalid email format`)
          isRecordValid = false
        }
        break

      case 'inventory':
        if (!record.sku && !record.barcode) {
          validation.errors.push(`Row ${i + 1}: SKU or barcode is required`)
          isRecordValid = false
        }
        break

      case 'categories':
        if (!record.name) {
          validation.errors.push(`Row ${i + 1}: Category name is required`)
          isRecordValid = false
        }
        break
    }

    if (isRecordValid) {
      validation.validCount++
    } else {
      validation.invalidCount++
      validation.isValid = false
    }
  }

  return validation
}

// Helper function to generate CSV
function generateCSV(data: any[]): string {
  if (!data || data.length === 0) return ''

  const headers = Object.keys(data[0])
  const csvRows = []

  // Add headers
  csvRows.push(headers.join(','))

  // Add data rows
  for (const row of data) {
    const values = headers.map(header => {
      const value = row[header]
      // Escape commas and quotes
      if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
        return `"${value.replace(/"/g, '""')}"`
      }
      return value
    })
    csvRows.push(values.join(','))
  }

  return csvRows.join('\n')
}

// Helper function to process import operation
async function processImportOperation(
  operationId: string,
  data: any[],
  parameters: any,
  storeId: string,
  userId: string,
  userName?: string,
  userEmail?: string
) {
  // Update operation status
  await prisma.batchOperation.update({
    where: { operationId },
    data: {
      status: 'running',
      startedAt: new Date()
    }
  })

  try {
    // Start the batch operation processing
    const result = await BatchOperationManager.startBatchOperation({
      operationId,
      type: 'import',
      entityType: parameters.entityType || 'products',
      parameters,
      storeId,
      userId,
      userName,
      userEmail,
      records: data
    })

    // Log completion
    await AuditLogger.log({
      timestamp: new Date(),
      userId,
      userEmail: userEmail || undefined,
      action: 'batch_import_completed',
      resource: 'batch_operation',
      method: 'POST',
      path: '/api/pos/batch-operations/import-export',
      status: result.success ? 'success' : 'failure',
      severity: 'medium',
      details: {
        operationId,
        totalRecords: result.totalRecords,
        successRecords: result.successRecords,
        failedRecords: result.failedRecords,
        errors: result.errors
      }
    })

  } catch (error) {
    console.error('Error processing import operation:', error)
    
    // Update operation status to failed
    await prisma.batchOperation.update({
      where: { operationId },
      data: {
        status: 'failed',
        completedAt: new Date(),
        errorLog: JSON.stringify({
          message: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    })
  }
}