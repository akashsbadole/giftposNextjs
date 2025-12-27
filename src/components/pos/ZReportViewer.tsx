'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { useSettings } from '@/lib/settings-context'
import { 
  FileText, 
  Download, 
  Printer, 
  Calendar,
  DollarSign,
  TrendingUp,
  CreditCard,
  Smartphone,
  AlertCircle,
  CheckCircle,
  Clock,
  Eye,
  Calculator
} from 'lucide-react'

interface ZReport {
  id: string
  shiftId: string
  reportDate: string
  reportPeriod: string
  totalSales: number
  totalTransactions: number
  cashSales: number
  cardSales: number
  digitalSales: number
  openingCash: number
  closingCash: number
  cashVariance: number
  cashAdjustments: number
  totalTax: number
  taxBreakdown?: {
    GST: number
    CGST: number
    SGST: number
  }
  refundAmount: number
  discountAmount: number
  status: 'generated' | 'printed' | 'submitted'
  printedAt?: string
  submittedAt?: string
  shift: {
    id: string
    employee: {
      name: string
      email: string
      role: string
    }
    startTime: string
    endTime: string
  }
}

interface ZReportViewerProps {
  storeId: string
  shiftId?: string
  onGenerateReport?: (report: ZReport) => void
}

export default function ZReportViewer({ storeId, shiftId, onGenerateReport }: ZReportViewerProps) {
  const { toast } = useToast()
  const { formatCurrency } = useSettings()
  const [reports, setReports] = useState<ZReport[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedReport, setSelectedReport] = useState<ZReport | null>(null)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)

  useEffect(() => {
    loadReports()
  }, [storeId, shiftId])

  const loadReports = async () => {
    try {
      const params = new URLSearchParams({ storeId })
      if (shiftId) params.append('shiftId', shiftId)
      
      const response = await fetch(`/api/pos/z-reports?${params}`)
      if (response.ok) {
        const data = await response.json()
        setReports(data)
      }
    } catch (error) {
      console.error('Error loading reports:', error)
      toast({
        title: 'Error',
        description: 'Failed to load reports',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const generateReport = async () => {
    if (!shiftId) {
      toast({
        title: 'No shift selected',
        description: 'Please select a shift to generate a report',
        variant: 'destructive',
      })
      return
    }

    setIsGenerating(true)
    try {
      const response = await fetch('/api/pos/z-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shiftId,
          reportPeriod: 'daily'
        })
      })

      if (response.ok) {
        const report = await response.json()
        setReports(prev => [report, ...prev])
        onGenerateReport?.(report)
        toast({
          title: 'Report generated',
          description: 'Z-report has been created successfully',
        })
      } else {
        const error = await response.json()
        toast({
          title: 'Failed to generate report',
          description: error.error || 'Please try again',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to generate report',
        variant: 'destructive',
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const updateReportStatus = async (reportId: string, status: 'printed' | 'submitted') => {
    try {
      const response = await fetch(`/api/pos/z-reports/${reportId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      })

      if (response.ok) {
        const updatedReport = await response.json()
        setReports(prev => prev.map(r => r.id === reportId ? updatedReport : r))
        if (selectedReport?.id === reportId) {
          setSelectedReport(updatedReport)
        }
        toast({
          title: 'Report updated',
          description: `Report marked as ${status}`,
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update report status',
        variant: 'destructive',
      })
    }
  }

  const printReport = async (report: ZReport) => {
    try {
      // Generate print content
      const printContent = generatePrintContent(report)
      
      // Create a new window for printing
      const printWindow = window.open('', '_blank')
      if (printWindow) {
        printWindow.document.write(printContent)
        printWindow.document.close()
        printWindow.print()
        
        // Update status to printed
        await updateReportStatus(report.id, 'printed')
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to print report',
        variant: 'destructive',
      })
    }
  }

  const generatePrintContent = (report: ZReport): string => {
    const storeName = 'Your Store Name' // This should come from settings
    const storeAddress = 'Store Address' // This should come from settings
    const storePhone = 'Store Phone' // This should come from settings

    return `
<!DOCTYPE html>
<html>
<head>
  <title>Z-Report - ${new Date(report.reportDate).toLocaleDateString()}</title>
  <style>
    body { font-family: 'Courier New', monospace; font-size: 12px; margin: 0; padding: 20px; }
    .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
    .section { margin-bottom: 15px; }
    .section-title { font-weight: bold; border-bottom: 1px solid #000; padding-bottom: 5px; margin-bottom: 10px; }
    .row { display: flex; justify-content: space-between; margin-bottom: 5px; }
    .total { font-weight: bold; border-top: 1px solid #000; padding-top: 5px; margin-top: 10px; }
    .footer { text-align: center; border-top: 1px solid #000; padding-top: 10px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="header">
    <h2>${storeName}</h2>
    <p>${storeAddress}</p>
    <p>Phone: ${storePhone}</p>
    <h3>Z-REPORT</h3>
    <p>Date: ${new Date(report.reportDate).toLocaleDateString()}</p>
    <p>Shift: ${new Date(report.shift.startTime).toLocaleTimeString()} - ${new Date(report.shift.endTime).toLocaleTimeString()}</p>
    <p>Cashier: ${report.shift.employee.name}</p>
  </div>

  <div class="section">
    <div class="section-title">SALES SUMMARY</div>
    <div class="row"><span>Total Sales:</span><span>${formatCurrency(report.totalSales)}</span></div>
    <div class="row"><span>Total Transactions:</span><span>${report.totalTransactions}</span></div>
    <div class="row"><span>Average Sale:</span><span>${formatCurrency(report.totalSales / report.totalTransactions)}</span></div>
  </div>

  <div class="section">
    <div class="section-title">PAYMENT METHODS</div>
    <div class="row"><span>Cash Sales:</span><span>${formatCurrency(report.cashSales)}</span></div>
    <div class="row"><span>Card Sales:</span><span>${formatCurrency(report.cardSales)}</span></div>
    <div class="row"><span>Digital Sales:</span><span>${formatCurrency(report.digitalSales)}</span></div>
  </div>

  <div class="section">
    <div class="section-title">CASH SUMMARY</div>
    <div class="row"><span>Opening Cash:</span><span>${formatCurrency(report.openingCash)}</span></div>
    <div class="row"><span>Closing Cash:</span><span>${formatCurrency(report.closingCash)}</span></div>
    <div class="row"><span>Cash Adjustments:</span><span>${formatCurrency(report.cashAdjustments)}</span></div>
    <div class="row"><span>Cash Variance:</span><span>${formatCurrency(report.cashVariance)}</span></div>
  </div>

  <div class="section">
    <div class="section-title">TAX SUMMARY</div>
    <div class="row"><span>Total Tax:</span><span>${formatCurrency(report.totalTax)}</span></div>
    ${report.taxBreakdown ? `
    <div class="row"><span>CGST:</span><span>${formatCurrency(report.taxBreakdown.CGST)}</span></div>
    <div class="row"><span>SGST:</span><span>${formatCurrency(report.taxBreakdown.SGST)}</span></div>
    ` : ''}
  </div>

  <div class="section">
    <div class="section-title">ADDITIONAL</div>
    <div class="row"><span>Refunds:</span><span>${formatCurrency(report.refundAmount)}</span></div>
    <div class="row"><span>Discounts:</span><span>${formatCurrency(report.discountAmount)}</span></div>
  </div>

  <div class="footer">
    <p>Report Generated: ${new Date().toLocaleString()}</p>
    <p>Status: ${report.status.toUpperCase()}</p>
  </div>
</body>
</html>
    `
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'generated': return Clock
      case 'printed': return Printer
      case 'submitted': return CheckCircle
      default: return FileText
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'generated': return 'bg-yellow-500'
      case 'printed': return 'bg-blue-500'
      case 'submitted': return 'bg-green-500'
      default: return 'bg-gray-500'
    }
  }

  if (loading) {
    return (
      <Card className="bg-gray-900 border-blue-500">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-700 rounded w-3/4"></div>
            <div className="h-4 bg-gray-700 rounded w-1/2"></div>
            <div className="h-4 bg-gray-700 rounded w-1/4"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card className="bg-gray-900 border-blue-500">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-gray-300">
                <FileText className="w-5 h-5" />
                Z-Reports
              </CardTitle>
              <CardDescription className="text-gray-400">
                End-of-day sales and cash reports
              </CardDescription>
            </div>
            {shiftId && (
              <Button
                onClick={generateReport}
                disabled={isGenerating}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {isGenerating ? 'Generating...' : 'Generate Report'}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {reports.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="w-12 h-12 mx-auto mb-4 text-gray-600" />
              <p className="text-gray-400">No reports found</p>
              {shiftId && (
                <p className="text-gray-500 text-sm mt-2">
                  Generate your first Z-report for this shift
                </p>
              )}
            </div>
          ) : (
            <ScrollArea className="h-96">
              <div className="space-y-3">
                {reports.map((report) => {
                  const StatusIcon = getStatusIcon(report.status)
                  return (
                    <div
                      key={report.id}
                      className="p-4 bg-gray-800 rounded-lg border border-gray-700 hover:border-blue-500 cursor-pointer transition-colors"
                      onClick={() => {
                        setSelectedReport(report)
                        setDetailDialogOpen(true)
                      }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <StatusIcon className="w-4 h-4 text-gray-400" />
                          <span className="font-semibold text-gray-300">
                            {new Date(report.reportDate).toLocaleDateString()}
                          </span>
                          <Badge className={`${getStatusColor(report.status)} text-white text-xs`}>
                            {report.status}
                          </Badge>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            printReport(report)
                          }}
                          className="text-gray-400 hover:text-white"
                        >
                          <Printer className="w-4 h-4" />
                        </Button>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-gray-400">Sales:</span>
                          <span className="ml-2 text-gray-300 font-semibold">
                            {formatCurrency(report.totalSales)}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-400">Transactions:</span>
                          <span className="ml-2 text-gray-300 font-semibold">
                            {report.totalTransactions}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-400">Cash Variance:</span>
                          <span className={`ml-2 font-semibold ${
                            report.cashVariance === 0 ? 'text-green-400' : 
                            Math.abs(report.cashVariance) <= 10 ? 'text-yellow-400' : 'text-red-400'
                          }`}>
                            {formatCurrency(report.cashVariance)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Report Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="bg-gray-900 border-blue-500 max-w-4xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="text-gray-300 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Z-Report Details
              {selectedReport && (
                <Badge className={`${getStatusColor(selectedReport.status)} text-white`}>
                  {selectedReport.status}
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              {selectedReport && (
                <>
                  Generated on {new Date(selectedReport.reportDate).toLocaleDateString()} • 
                  Shift: {new Date(selectedReport.shift.startTime).toLocaleTimeString()} - {new Date(selectedReport.shift.endTime).toLocaleTimeString()}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          
          {selectedReport && (
            <ScrollArea className="max-h-[70vh] pr-4">
              <div className="space-y-6">
                {/* Sales Summary */}
                <div className="bg-gray-800 p-4 rounded-lg">
                  <h3 className="text-lg font-semibold text-gray-300 mb-4 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    Sales Summary
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Total Sales:</span>
                        <span className="text-gray-300 font-semibold">{formatCurrency(selectedReport.totalSales)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Total Transactions:</span>
                        <span className="text-gray-300">{selectedReport.totalTransactions}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Average Sale:</span>
                        <span className="text-gray-300">
                          {formatCurrency(selectedReport.totalSales / selectedReport.totalTransactions)}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Refund Amount:</span>
                        <span className="text-gray-300">{formatCurrency(selectedReport.refundAmount)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Discount Amount:</span>
                        <span className="text-gray-300">{formatCurrency(selectedReport.discountAmount)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Payment Methods */}
                <div className="bg-gray-800 p-4 rounded-lg">
                  <h3 className="text-lg font-semibold text-gray-300 mb-4 flex items-center gap-2">
                    <CreditCard className="w-5 h-5" />
                    Payment Methods
                  </h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-green-400" />
                      <div>
                        <div className="text-gray-400 text-sm">Cash</div>
                        <div className="text-gray-300 font-semibold">{formatCurrency(selectedReport.cashSales)}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-blue-400" />
                      <div>
                        <div className="text-gray-400 text-sm">Card</div>
                        <div className="text-gray-300 font-semibold">{formatCurrency(selectedReport.cardSales)}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Smartphone className="w-4 h-4 text-purple-400" />
                      <div>
                        <div className="text-gray-400 text-sm">Digital</div>
                        <div className="text-gray-300 font-semibold">{formatCurrency(selectedReport.digitalSales)}</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Cash Summary */}
                <div className="bg-gray-800 p-4 rounded-lg">
                  <h3 className="text-lg font-semibold text-gray-300 mb-4 flex items-center gap-2">
                    <DollarSign className="w-5 h-5" />
                    Cash Summary
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Opening Cash:</span>
                        <span className="text-gray-300">{formatCurrency(selectedReport.openingCash)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Closing Cash:</span>
                        <span className="text-gray-300">{formatCurrency(selectedReport.closingCash)}</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Cash Adjustments:</span>
                        <span className="text-gray-300">{formatCurrency(selectedReport.cashAdjustments)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Cash Variance:</span>
                        <span className={`font-semibold ${
                          selectedReport.cashVariance === 0 ? 'text-green-400' : 
                          Math.abs(selectedReport.cashVariance) <= 10 ? 'text-yellow-400' : 'text-red-400'
                        }`}>
                          {formatCurrency(selectedReport.cashVariance)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tax Summary */}
                <div className="bg-gray-800 p-4 rounded-lg">
                  <h3 className="text-lg font-semibold text-gray-300 mb-4 flex items-center gap-2">
                    <Calculator className="w-5 h-5" />
                    Tax Summary
                  </h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Total Tax:</span>
                      <span className="text-gray-300 font-semibold">{formatCurrency(selectedReport.totalTax)}</span>
                    </div>
                    {selectedReport.taxBreakdown && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-gray-400">CGST:</span>
                          <span className="text-gray-300">{formatCurrency(selectedReport.taxBreakdown.CGST)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">SGST:</span>
                          <span className="text-gray-300">{formatCurrency(selectedReport.taxBreakdown.SGST)}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Shift Information */}
                <div className="bg-gray-800 p-4 rounded-lg">
                  <h3 className="text-lg font-semibold text-gray-300 mb-4 flex items-center gap-2">
                    <Calendar className="w-5 h-5" />
                    Shift Information
                  </h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Cashier:</span>
                      <span className="text-gray-300">{selectedReport.shift.employee.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Start Time:</span>
                      <span className="text-gray-300">{new Date(selectedReport.shift.startTime).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">End Time:</span>
                      <span className="text-gray-300">{new Date(selectedReport.shift.endTime).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-4">
                  <Button
                    onClick={() => printReport(selectedReport)}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <Printer className="w-4 h-4 mr-2" />
                    Print Report
                  </Button>
                  
                  {selectedReport.status === 'generated' && (
                    <Button
                      onClick={() => updateReportStatus(selectedReport.id, 'submitted')}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Mark as Submitted
                    </Button>
                  )}
                </div>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}