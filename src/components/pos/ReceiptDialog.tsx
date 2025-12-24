'use client'

import { useEffect, useRef, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Printer, X, MessageCircle, Mail, Download } from 'lucide-react'
import { useSettings } from '@/lib/settings-context'

interface ReceiptProps {
  open: boolean
  onClose: () => void
  sale: any
}

export default function ReceiptDialog({ open, onClose, sale }: ReceiptProps) {
  const { formatCurrency } = useSettings()
  const printRef = useRef<HTMLDivElement>(null)
  const [whatsappNumber, setWhatsAppNumber] = useState('')
  const [emailTo, setEmailTo] = useState('')

  const handlePrint = () => {
    const printContent = printRef.current
    if (!printContent) return

    const printWindow = window.open('', '', 'width=400,height=600')
    if (!printWindow) return

    printWindow.document.write(`
      <html>
        <head>
          <title>Receipt</title>
          <style>
            body {
              font-family: monospace;
              font-size: 12px;
              padding: 20px;
              width: 280px;
              margin: 0 auto;
            }
            .center { text-align: center; }
            .bold { font-weight: bold; }
            .divider { border-top: 1px dashed #000; margin: 10px 0; }
            .line { display: flex; justify-content: space-between; margin: 5px 0; }
            .total { font-size: 16px; font-weight: bold; margin-top: 10px; }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.print()
  }

  const handleWhatsAppShare = () => {
    if (!whatsappNumber) {
      alert('Please enter WhatsApp number')
      return
    }

    const store = sale.store || {}
    const message = `*${store.name} Receipt*\n\n` +
      `Invoice: ${sale.invoiceNumber}\n` +
      `Date: ${new Date(sale.createdAt).toLocaleString()}\n\n` +
      `${sale.items?.map((item: any) => 
        `${item.quantity}x ${item.product?.name} - ${formatCurrency(item.subtotal || 0)}`
      ).join('\n')}\n\n` +
      `Subtotal: ${formatCurrency(sale.subtotal || 0)}\n` +
      `GST (${store.gstRate || 10}%): ${formatCurrency(sale.gst || 0)}\n` +
      `Total: ${formatCurrency(sale.total || 0)}\n` +
      `Paid via ${sale.payment?.method}\n\n` +
      `Thank you for shopping!`

    const formattedNumber = whatsappNumber.replace(/[^0-9+]/g, '')
    const whatsappUrl = `https://wa.me/${formattedNumber}?text=${encodeURIComponent(message)}`

    window.open(whatsappUrl, '_blank')
  }

  const handleEmailShare = () => {
    if (!emailTo) {
      alert('Please enter email address')
      return
    }

    const store = sale.store || {}
    const subject = encodeURIComponent(`Receipt - ${sale.invoiceNumber}`)
    const body = `
RECEIPT FROM ${store.name}

Invoice: ${sale.invoiceNumber}
Date: ${new Date(sale.createdAt).toLocaleString()}

${sale.items?.map((item: any) => 
  `${item.quantity}x ${item.product?.name} - ${formatCurrency(item.subtotal || 0)}`
).join('\n')}

Subtotal: ${formatCurrency(sale.subtotal || 0)}
GST (${store.gstRate || 10}%): ${formatCurrency(sale.gst || 0)}
Total: ${formatCurrency(sale.total || 0)}

Paid via ${sale.payment?.method}

${sale.customer?.name ? `Customer: ${sale.customer.name}\n` : ''}

Thank you for shopping!
`.trim()

    window.open(`mailto:${emailTo}?subject=${subject}&body=${encodeURIComponent(body)}`, '_blank')
  }

  const handleExportCSV = () => {
    const store = sale.store || {}
    const customer = sale.customer || {}
    
    const csvContent = [
      ['Invoice Number', sale.invoiceNumber],
      ['Date', new Date(sale.createdAt).toLocaleString()],
      ['Customer', customer.name || 'Walk-in'],
      ['Cashier', sale.employee?.name || ''],
      [''],
      ['Item', 'Quantity', 'Price', 'Subtotal'],
      ...sale.items?.map((item: any) => [
        item.product?.name,
        item.quantity.toString(),
        formatCurrency(item.price || 0),
        formatCurrency(item.subtotal || 0)
      ]) || [],
      [''],
      ['Payment Method', sale.payment?.method || 'Cash']
    ].map(row => row.join(',')).join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `receipt_${sale.invoiceNumber}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onClose])

  if (!sale) return null

  const store = sale.store || {}
  const customer = sale.customer || {}
  const employee = sale.employee || {}
  const payment = sale.payment || {}

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto bg-gray-900 border-blue-500/20">
        <DialogHeader>
          <DialogTitle className="text-gray-500">Receipt Options</DialogTitle>
        </DialogHeader>

        {/* Receipt Preview */}
        <div ref={printRef} className="font-mono text-xs bg-white p-4 border mb-4">
          {/* Store Header */}
          <div className="text-center mb-4">
            <h2 className="text-lg font-bold">{store.name || 'My Store'}</h2>
            {store.address && <p className="text-xs">{store.address}</p>}
            {store.phone && <p className="text-xs">Tel: {store.phone}</p>}
            {store.email && <p className="text-xs">{store.email}</p>}
          </div>

          <div className="border-t border-dashed border-gray-400 my-2"></div>

          {/* Invoice Info */}
          <div className="text-center mb-4">
            <p className="font-bold">RECEIPT</p>
            <p className="text-xs">Invoice: {sale.invoiceNumber}</p>
            <p className="text-xs">
              {new Date(sale.createdAt).toLocaleString()}
            </p>
          </div>

          <div className="border-t border-dashed border-gray-400 my-2"></div>

          {/* Customer Info */}
          {customer.name && (
            <div className="mb-2">
              <p className="text-xs">Customer: {customer.name}</p>
            </div>
          )}

          {/* Cashier Info */}
          {employee.name && (
            <div className="mb-2">
              <p className="text-xs">Cashier: {employee.name}</p>
            </div>
          )}

          <div className="border-t border-dashed border-gray-400 my-2"></div>

          {/* Items */}
          <div className="mb-4">
            {sale.items?.map((item: any, index: number) => (
              <div key={index} className="flex justify-between text-xs mb-1">
                <div className="flex-1">
                  <p>{item.product?.name}</p>
                  <p className="text-gray-500">
                    {item.quantity} x {formatCurrency(item.price || 0)}
                  </p>
                </div>
                <div className="text-right">
                  {formatCurrency(item.subtotal || 0)}
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-dashed border-gray-400 my-2"></div>

          {/* Totals */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span>Subtotal</span>
              <span>{formatCurrency(sale.subtotal || 0)}</span>
            </div>

            {sale.gst > 0 && (
              <div className="flex justify-between text-xs">
                <span>GST ({store.gstRate || 10}%)</span>
                <span>{formatCurrency(sale.gst || 0)}</span>
              </div>
            )}

            {sale.discount > 0 && (
              <div className="flex justify-between text-xs">
                <span>Discount</span>
                <span>-{formatCurrency(sale.discount || 0)}</span>
              </div>
            )}

            <div className="border-t border-dashed border-gray-400 my-2"></div>

            <div className="flex justify-between text-lg font-bold">
              <span>TOTAL</span>
              <span>{formatCurrency(sale.total || 0)}</span>
            </div>
          </div>

          <div className="border-t border-dashed border-gray-400 my-2"></div>

          {/* Payment Info */}
          <div className="text-center text-xs mb-4">
            <p className="capitalize">Paid by {payment.method}</p>
            {payment.reference && <p>Ref: {payment.reference}</p>}
          </div>

          {/* Footer */}
          <div className="text-center text-xs mt-4">
            <p>Thank you for shopping!</p>
            <p>Please come again</p>
          </div>
        </div>

        {/* Share Options */}
        <div className="space-y-4">
          {/* WhatsApp */}
          <div className="space-y-2">
            <Label className="text-gray-500">Share via WhatsApp</Label>
            <div className="flex gap-2">
              <Input
                placeholder="+91XXXXXXXXXX"
                value={whatsappNumber}
                onChange={(e) => setWhatsAppNumber(e.target.value)}
                className="flex-1 border-blue-500/20 bg-gray-800 text-white placeholder-gray-400 focus:border-blue-primary focus:ring-blue-primary/20"
              />
              <Button onClick={handleWhatsAppShare} disabled={!whatsappNumber} className="bg-amber-600 hover:bg-blue-accent text-white">
                <MessageCircle className="w-4 h-4 mr-2" />
                WhatsApp
              </Button>
            </div>
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label className="text-gray-500">Share via Email</Label>
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="customer@example.com"
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
                className="flex-1 border-blue-500/20 bg-gray-800 text-white placeholder-gray-400 focus:border-blue-primary focus:ring-blue-primary/20"
              />
              <Button onClick={handleEmailShare} disabled={!emailTo} className="bg-amber-600 hover:bg-blue-accent text-white">
                <Mail className="w-4 h-4 mr-2" />
                Email
              </Button>
            </div>
          </div>

          {/* Export CSV */}
          <Button onClick={handleExportCSV} variant="outline" className="w-full border-blue-500/20">
            <Download className="w-4 h-4 mr-2" />
            Export Receipt as CSV
          </Button>
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-4">
          <Button variant="outline" className="flex-1 border-blue-500/20" onClick={onClose}>
            <X className="w-4 h-4 mr-2" />
            Close
          </Button>
          <Button onClick={handlePrint} className="flex-1 bg-amber-600 hover:bg-blue-accent text-white">
            <Printer className="w-4 h-4 mr-2" />
            Print
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
