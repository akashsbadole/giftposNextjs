'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { useSettings } from '@/lib/settings-context'
import { 
  Calculator, 
  Plus, 
  Minus, 
  DollarSign,
  Coins,
  Banknote,
  CheckCircle,
  AlertTriangle,
  Clock,
  RefreshCw
} from 'lucide-react'

interface CashDenomination {
  value: number
  label: string
  count: number
  icon: 'banknote' | 'coin'
  color: string
}

interface CashCount {
  id: string
  countType: 'opening' | 'closing' | 'mid_shift' | 'variance_investigation'
  expectedAmount: number
  actualAmount: number
  variance: number
  denominationBreakdown: { [key: string]: number }
  status: 'pending' | 'approved' | 'rejected'
  createdAt: string
}

interface CashCountInterfaceProps {
  shiftId: string
  expectedAmount: number
  countType: 'opening' | 'closing' | 'mid_shift' | 'variance_investigation'
  onCountComplete?: (count: CashCount) => void
}

const DENOMINATIONS: Omit<CashDenomination, 'count'>[] = [
  { value: 2000, label: '₹2000', icon: 'banknote', color: 'bg-purple-500' },
  { value: 500, label: '₹500', icon: 'banknote', color: 'bg-blue-500' },
  { value: 200, label: '₹200', icon: 'banknote', color: 'bg-green-500' },
  { value: 100, label: '₹100', icon: 'banknote', color: 'bg-yellow-500' },
  { value: 50, label: '₹50', icon: 'banknote', color: 'bg-orange-500' },
  { value: 20, label: '₹20', icon: 'banknote', color: 'bg-pink-500' },
  { value: 10, label: '₹10', icon: 'coin', color: 'bg-red-500' },
  { value: 5, label: '₹5', icon: 'coin', color: 'bg-indigo-500' },
  { value: 2, label: '₹2', icon: 'coin', color: 'bg-teal-500' },
  { value: 1, label: '₹1', icon: 'coin', color: 'bg-gray-500' },
]

export default function CashCountInterface({ 
  shiftId, 
  expectedAmount, 
  countType, 
  onCountComplete 
}: CashCountInterfaceProps) {
  const { toast } = useToast()
  const { formatCurrency } = useSettings()
  
  const [denominations, setDenominations] = useState<CashDenomination[]>(
    DENOMINATIONS.map(d => ({ ...d, count: 0 }))
  )
  const [totalCount, setTotalCount] = useState(0)
  const [variance, setVariance] = useState(0)
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)

  useEffect(() => {
    calculateTotal()
  }, [denominations])

  const calculateTotal = () => {
    const total = denominations.reduce((sum, denom) => sum + (denom.value * denom.count), 0)
    setTotalCount(total)
    setVariance(total - expectedAmount)
  }

  const updateDenominationCount = (index: number, newCount: number) => {
    if (newCount < 0) newCount = 0
    setDenominations(prev => 
      prev.map((denom, i) => 
        i === index ? { ...denom, count: newCount } : denom
      )
    )
  }

  const incrementCount = (index: number) => {
    updateDenominationCount(index, denominations[index].count + 1)
  }

  const decrementCount = (index: number) => {
    updateDenominationCount(index, denominations[index].count - 1)
  }

  const resetCounts = () => {
    setDenominations(prev => prev.map(d => ({ ...d, count: 0 })))
    setNotes('')
  }

  const getVarianceColor = () => {
    if (variance === 0) return 'text-green-400'
    if (Math.abs(variance) <= 10) return 'text-yellow-400'
    return 'text-red-400'
  }

  const getVarianceIcon = () => {
    if (variance === 0) return CheckCircle
    if (Math.abs(variance) <= 10) return AlertTriangle
    return AlertTriangle
  }

  const getVarianceMessage = () => {
    if (variance === 0) return 'Cash count is exact!'
    if (variance > 0) return `Cash is over by ${formatCurrency(variance)}`
    return `Cash is short by ${formatCurrency(Math.abs(variance))}`
  }

  const submitCount = async () => {
    setIsSubmitting(true)
    try {
      const denominationBreakdown = denominations.reduce((acc, denom) => {
        if (denom.count > 0) {
          acc[denom.value.toString()] = denom.count
        }
        return acc
      }, {} as { [key: string]: number })

      const response = await fetch(`/api/pos/shifts/${shiftId}/cash-counts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          countType,
          expectedAmount,
          actualAmount: totalCount,
          denominationBreakdown,
          notes
        })
      })

      if (response.ok) {
        const count = await response.json()
        onCountComplete?.(count)
        
        toast({
          title: 'Cash count submitted',
          description: `${countType.replace('_', ' ')} count has been recorded`,
        })
        
        setShowConfirmDialog(false)
        resetCounts()
      } else {
        const error = await response.json()
        toast({
          title: 'Failed to submit count',
          description: error.error || 'Please try again',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to submit cash count. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const getCountTypeLabel = () => {
    return countType.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ')
  }

  const VarianceIcon = getVarianceIcon()

  return (
    <Card className="bg-gray-900 border-blue-500">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-gray-300">
              <Calculator className="w-5 h-5" />
              {getCountTypeLabel()} Cash Count
            </CardTitle>
            <CardDescription className="text-gray-400">
              Expected: {formatCurrency(expectedAmount)}
            </CardDescription>
          </div>
          <Badge variant="outline" className="border-blue-500 text-blue-400">
            <Clock className="w-3 h-3 mr-1" />
            {new Date().toLocaleTimeString()}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Variance Summary */}
        <div className={`p-4 rounded-lg border ${variance === 0 ? 'bg-green-500/10 border-green-500/30' : Math.abs(variance) <= 10 ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
          <div className="flex items-center gap-3">
            <VarianceIcon className={`w-6 h-6 ${getVarianceColor()}`} />
            <div>
              <p className={`font-semibold ${getVarianceColor()}`}>
                {formatCurrency(totalCount)}
              </p>
              <p className={`text-sm ${getVarianceColor()}`}>
                {getVarianceMessage()}
              </p>
            </div>
          </div>
        </div>

        {/* Denomination Counters */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-300 flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Count Cash Denominations
          </h3>
          
          <div className="grid gap-3">
            {denominations.map((denomination, index) => (
              <div key={denomination.value} className="flex items-center gap-4 p-3 bg-gray-800 rounded-lg border border-gray-700">
                <div className={`w-12 h-8 ${denomination.color} rounded flex items-center justify-center text-white font-bold text-sm`}>
                  {denomination.icon === 'banknote' ? (
                    <Banknote className="w-6 h-6" />
                  ) : (
                    <Coins className="w-4 h-4" />
                  )}
                </div>
                
                <div className="flex-1">
                  <div className="font-semibold text-gray-300">{denomination.label}</div>
                  <div className="text-sm text-gray-400">
                    {formatCurrency(denomination.value)} each
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 border-gray-600 hover:border-gray-500"
                    onClick={() => decrementCount(index)}
                  >
                    <Minus className="w-3 h-3" />
                  </Button>
                  
                  <Input
                    type="number"
                    value={denomination.count}
                    onChange={(e) => updateDenominationCount(index, parseInt(e.target.value) || 0)}
                    className="w-16 h-8 text-center border-gray-600 bg-gray-700 text-white"
                    min="0"
                  />
                  
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 border-gray-600 hover:border-gray-500"
                    onClick={() => incrementCount(index)}
                  >
                    <Plus className="w-3 h-3" />
                  </Button>
                </div>

                <div className="text-right min-w-20">
                  <div className="font-semibold text-gray-300">
                    {formatCurrency(denomination.value * denomination.count)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <Separator className="border-blue-500" />

        {/* Notes */}
        <div>
          <Label htmlFor="count-notes" className="text-gray-300">Notes (Optional)</Label>
          <Input
            id="count-notes"
            placeholder="Any notes about this count..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="border-blue-500 bg-gray-800 text-white mt-2"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={resetCounts}
            className="border-gray-600 text-gray-300 hover:bg-gray-800"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Reset
          </Button>
          
          <Button
            onClick={() => setShowConfirmDialog(true)}
            disabled={isSubmitting}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            Submit Count
          </Button>
        </div>

        {/* Confirmation Dialog */}
        <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <DialogContent className="bg-gray-900 border-blue-500">
            <DialogHeader>
              <DialogTitle className="text-gray-300">Confirm Cash Count</DialogTitle>
              <DialogDescription className="text-gray-400">
                Please verify your cash count before submitting
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="bg-gray-800 p-4 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-400">Expected Amount:</span>
                  <span className="text-gray-300">{formatCurrency(expectedAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Counted Amount:</span>
                  <span className="text-gray-300 font-semibold">{formatCurrency(totalCount)}</span>
                </div>
                <Separator className="border-gray-600" />
                <div className="flex justify-between">
                  <span className="text-gray-400">Variance:</span>
                  <span className={`font-semibold ${getVarianceColor()}`}>
                    {variance >= 0 ? '+' : ''}{formatCurrency(variance)}
                  </span>
                </div>
              </div>

              {notes && (
                <div>
                  <span className="text-gray-400 text-sm">Notes:</span>
                  <p className="text-gray-300 mt-1">{notes}</p>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => setShowConfirmDialog(false)}
                className="border-blue-500 text-gray-300"
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button 
                onClick={submitCount}
                disabled={isSubmitting}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isSubmitting ? 'Submitting...' : 'Confirm & Submit'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}