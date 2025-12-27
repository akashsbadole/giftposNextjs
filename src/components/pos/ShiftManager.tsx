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
  Clock, 
  Play, 
  Square, 
  Pause, 
  DollarSign, 
  TrendingUp, 
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Timer,
  User
} from 'lucide-react'

interface Shift {
  id: string
  employeeId: string
  startTime: string
  endTime?: string
  startingCash: number
  expectedCash: number
  actualCash?: number
  cashVariance?: number
  status: 'active' | 'closed' | 'suspended' | 'break'
  notes?: string
  isBreak: boolean
  breakStart?: string
  breakEnd?: string
  employee: {
    id: string
    name: string
    email: string
    role: string
  }
  metrics: {
    totalSales: number
    totalCashIn: number
    totalCashOut: number
    expectedCash: number
    transactionCount: number
  }
}

interface ShiftManagerProps {
  employeeId: string
  storeId: string
  onShiftChange?: (shift: Shift | null) => void
}

export default function ShiftManager({ employeeId, storeId, onShiftChange }: ShiftManagerProps) {
  const { toast } = useToast()
  const { formatCurrency } = useSettings()
  const [currentShift, setCurrentShift] = useState<Shift | null>(null)
  const [loading, setLoading] = useState(true)
  const [startDialogOpen, setStartDialogOpen] = useState(false)
  const [closeDialogOpen, setCloseDialogOpen] = useState(false)
  const [startingCash, setStartingCash] = useState('')
  const [shiftNotes, setShiftNotes] = useState('')
  const [closingCash, setClosingCash] = useState('')
  const [isStarting, setIsStarting] = useState(false)
  const [isClosing, setIsClosing] = useState(false)

  useEffect(() => {
    loadCurrentShift()
  }, [employeeId, storeId])

  const loadCurrentShift = async () => {
    try {
      const response = await fetch(`/api/pos/shifts/current?storeId=${storeId}&employeeId=${employeeId}`)
      if (response.ok) {
        const data = await response.json()
        if (data.hasActiveShift) {
          setCurrentShift(data.shift)
          onShiftChange?.(data.shift)
        } else {
          setCurrentShift(null)
          onShiftChange?.(null)
        }
      }
    } catch (error) {
      console.error('Error loading current shift:', error)
    } finally {
      setLoading(false)
    }
  }

  const startShift = async () => {
    if (!startingCash || parseFloat(startingCash) < 0) {
      toast({
        title: 'Invalid starting cash',
        description: 'Please enter a valid starting cash amount',
        variant: 'destructive',
      })
      return
    }

    setIsStarting(true)
    try {
      const response = await fetch('/api/pos/shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId,
          storeId,
          startingCash: parseFloat(startingCash),
          notes: shiftNotes
        })
      })

      if (response.ok) {
        const shift = await response.json()
        setCurrentShift(shift)
        onShiftChange?.(shift)
        setStartDialogOpen(false)
        setStartingCash('')
        setShiftNotes('')
        toast({
          title: 'Shift started successfully',
          description: `Shift started with ${formatCurrency(parseFloat(startingCash))} starting cash`,
        })
      } else {
        const error = await response.json()
        toast({
          title: 'Failed to start shift',
          description: error.error || 'Please try again',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to start shift. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setIsStarting(false)
    }
  }

  const closeShift = async () => {
    if (!currentShift) return

    if (!closingCash || parseFloat(closingCash) < 0) {
      toast({
        title: 'Invalid closing cash',
        description: 'Please enter a valid closing cash amount',
        variant: 'destructive',
      })
      return
    }

    setIsClosing(true)
    try {
      const response = await fetch(`/api/pos/shifts/${currentShift.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'closed',
          actualCash: parseFloat(closingCash),
          notes: shiftNotes
        })
      })

      if (response.ok) {
        const updatedShift = await response.json()
        setCurrentShift(null)
        onShiftChange?.(null)
        setCloseDialogOpen(false)
        setClosingCash('')
        setShiftNotes('')
        
        const variance = updatedShift.cashVariance || 0
        const varianceStatus = variance === 0 ? 'exact' : variance > 0 ? 'over' : 'short'
        
        toast({
          title: 'Shift closed successfully',
          description: `Cash variance: ${varianceStatus} by ${formatCurrency(Math.abs(variance))}`,
          variant: variance === 0 ? 'default' : 'destructive',
        })
      } else {
        const error = await response.json()
        toast({
          title: 'Failed to close shift',
          description: error.error || 'Please try again',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to close shift. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setIsClosing(false)
    }
  }

  const takeBreak = async () => {
    if (!currentShift) return

    try {
      const response = await fetch(`/api/pos/shifts/${currentShift.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'break' })
      })

      if (response.ok) {
        const updatedShift = await response.json()
        setCurrentShift(updatedShift)
        toast({
          title: 'Break started',
          description: 'Remember to resume your shift when you return',
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to start break. Please try again.',
        variant: 'destructive',
      })
    }
  }

  const resumeShift = async () => {
    if (!currentShift) return

    try {
      const response = await fetch(`/api/pos/shifts/${currentShift.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'active' })
      })

      if (response.ok) {
        const updatedShift = await response.json()
        setCurrentShift(updatedShift)
        toast({
          title: 'Shift resumed',
          description: 'Welcome back! Your shift is now active.',
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to resume shift. Please try again.',
        variant: 'destructive',
      })
    }
  }

  const formatDuration = (startTime: string, endTime?: string) => {
    const start = new Date(startTime)
    const end = endTime ? new Date(endTime) : new Date()
    const duration = Math.floor((end.getTime() - start.getTime()) / 1000 / 60) // minutes
    
    const hours = Math.floor(duration / 60)
    const minutes = duration % 60
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`
    }
    return `${minutes}m`
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

  if (!currentShift) {
    return (
      <Card className="bg-gray-900 border-blue-500">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-300">
            <Clock className="w-5 h-5" />
            Shift Management
          </CardTitle>
          <CardDescription className="text-gray-400">
            Start your shift to begin tracking cash transactions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={() => setStartDialogOpen(true)}
            className="w-full bg-green-600 hover:bg-green-700 text-white"
            size="lg"
          >
            <Play className="w-4 h-4 mr-2" />
            Start Shift
          </Button>

          <Dialog open={startDialogOpen} onOpenChange={setStartDialogOpen}>
            <DialogContent className="bg-gray-900 border-blue-500">
              <DialogHeader>
                <DialogTitle className="text-gray-300">Start New Shift</DialogTitle>
                <DialogDescription className="text-gray-400">
                  Enter the starting cash amount for your shift
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label htmlFor="starting-cash" className="text-gray-300">Starting Cash Amount</Label>
                  <Input
                    id="starting-cash"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={startingCash}
                    onChange={(e) => setStartingCash(e.target.value)}
                    className="border-blue-500 bg-gray-800 text-white"
                  />
                </div>
                <div>
                  <Label htmlFor="shift-notes" className="text-gray-300">Notes (Optional)</Label>
                  <Input
                    id="shift-notes"
                    placeholder="Any notes about this shift..."
                    value={shiftNotes}
                    onChange={(e) => setShiftNotes(e.target.value)}
                    className="border-blue-500 bg-gray-800 text-white"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => setStartDialogOpen(false)}
                  className="border-blue-500 text-gray-300"
                  disabled={isStarting}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={startShift}
                  disabled={isStarting}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  {isStarting ? 'Starting...' : 'Start Shift'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    )
  }

  const variance = currentShift.cashVariance || 0
  const varianceColor = variance === 0 ? 'text-green-400' : variance > 0 ? 'text-blue-400' : 'text-red-400'
  const varianceIcon = variance === 0 ? CheckCircle : variance > 0 ? TrendingUp : TrendingDown

  return (
    <>
      <Card className="bg-gray-900 border-blue-500">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-gray-300">
                <User className="w-5 h-5" />
                Current Shift
                <Badge variant={currentShift.status === 'active' ? 'default' : 'secondary'}>
                  {currentShift.status}
                </Badge>
              </CardTitle>
              <CardDescription className="text-gray-400">
                Started {new Date(currentShift.startTime).toLocaleString()}
              </CardDescription>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-2 text-gray-300">
                <Timer className="w-4 h-4" />
                <span className="font-mono">
                  {formatDuration(currentShift.startTime, currentShift.endTime)}
                </span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Cash Summary */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-gray-400">Starting Cash</Label>
              <p className="text-lg font-semibold text-gray-300">
                {formatCurrency(currentShift.startingCash)}
              </p>
            </div>
            <div className="space-y-2">
              <Label className="text-gray-400">Expected Cash</Label>
              <p className="text-lg font-semibold text-gray-300">
                {formatCurrency(currentShift.metrics.expectedCash)}
              </p>
            </div>
          </div>

          <Separator className="border-blue-500" />

          {/* Transaction Summary */}
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-green-400">
                {formatCurrency(currentShift.metrics.totalSales)}
              </div>
              <div className="text-sm text-gray-400">Total Sales</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-400">
                {currentShift.metrics.transactionCount}
              </div>
              <div className="text-sm text-gray-400">Transactions</div>
            </div>
            <div>
              <div className={`text-2xl font-bold ${varianceColor}`}>
                {formatCurrency(Math.abs(variance))}
              </div>
              <div className="text-sm text-gray-400">
                {variance === 0 ? 'Exact' : variance > 0 ? 'Over' : 'Short'}
              </div>
            </div>
          </div>

          <Separator className="border-blue-500" />

          {/* Action Buttons */}
          <div className="flex gap-2">
            {currentShift.status === 'active' && !currentShift.isBreak ? (
              <>
                <Button
                  onClick={() => setCloseDialogOpen(true)}
                  variant="destructive"
                  className="flex-1"
                >
                  <Square className="w-4 h-4 mr-2" />
                  Close Shift
                </Button>
                <Button
                  onClick={takeBreak}
                  variant="outline"
                  className="border-orange-500 text-orange-400"
                >
                  <Pause className="w-4 h-4 mr-2" />
                  Break
                </Button>
              </>
            ) : currentShift.status === 'break' ? (
              <Button
                onClick={resumeShift}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
              >
                <Play className="w-4 h-4 mr-2" />
                Resume Shift
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {/* Close Shift Dialog */}
      <Dialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
        <DialogContent className="bg-gray-900 border-blue-500">
          <DialogHeader>
            <DialogTitle className="text-gray-300">Close Shift</DialogTitle>
            <DialogDescription className="text-gray-400">
              Count the cash in your drawer and enter the total amount
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-gray-800 p-4 rounded-lg">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-400">Starting Cash:</span>
                  <span className="ml-2 text-gray-300">{formatCurrency(currentShift.startingCash)}</span>
                </div>
                <div>
                  <span className="text-gray-400">Expected Cash:</span>
                  <span className="ml-2 text-gray-300">{formatCurrency(currentShift.metrics.expectedCash)}</span>
                </div>
              </div>
            </div>
            <div>
              <Label htmlFor="closing-cash" className="text-gray-300">Actual Cash Count</Label>
              <Input
                id="closing-cash"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={closingCash}
                onChange={(e) => setClosingCash(e.target.value)}
                className="border-blue-500 bg-gray-800 text-white"
              />
            </div>
            {closingCash && (
              <div className="bg-gray-800 p-3 rounded-lg">
                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Expected:</span>
                    <span className="text-gray-300">{formatCurrency(currentShift.metrics.expectedCash)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Actual:</span>
                    <span className="text-gray-300">{formatCurrency(parseFloat(closingCash) || 0)}</span>
                  </div>
                  <Separator className="border-blue-500" />
                  <div className="flex justify-between font-semibold">
                    <span className="text-gray-400">Variance:</span>
                    <span className={`${varianceColor}`}>
                      {((parseFloat(closingCash) || 0) - currentShift.metrics.expectedCash) >= 0 ? '+' : ''}
                      {formatCurrency((parseFloat(closingCash) || 0) - currentShift.metrics.expectedCash)}
                    </span>
                  </div>
                </div>
              </div>
            )}
            <div>
              <Label htmlFor="close-notes" className="text-gray-300">Notes (Optional)</Label>
              <Input
                id="close-notes"
                placeholder="Any notes about closing..."
                value={shiftNotes}
                onChange={(e) => setShiftNotes(e.target.value)}
                className="border-blue-500 bg-gray-800 text-white"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => setCloseDialogOpen(false)}
              className="border-blue-500 text-gray-300"
              disabled={isClosing}
            >
              Cancel
            </Button>
            <Button 
              onClick={closeShift}
              disabled={isClosing}
              variant="destructive"
            >
              {isClosing ? 'Closing...' : 'Close Shift'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}