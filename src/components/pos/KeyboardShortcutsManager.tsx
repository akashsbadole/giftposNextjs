'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { useInputProtection, useInputDebugging } from '@/hooks/use-input-protection'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Search,
  Keyboard,
  Zap,
  ShoppingCart,
  Clock,
  Users,
  Settings,
  Play,
  Pause,
  Plus,
  Minus,
  Trash2,
  Eye,
  Edit,
  Save,
  X,
  CheckCircle,
  AlertTriangle,
  Bell,
  Timer,
  Activity,
  Target,
  RefreshCw,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Home
} from 'lucide-react'

interface KeyboardShortcut {
  id: string
  key: string
  modifiers: {
    ctrl?: boolean
    alt?: boolean
    shift?: boolean
    meta?: boolean
  }
  description: string
  category: 'navigation' | 'order_management' | 'cart' | 'system' | 'collaboration' | 'quick_actions'
  action: string
  context?: string[]
  enabled: boolean
  global: boolean
}

interface KeyboardShortcutsManagerProps {
  isOpen: boolean
  onClose: () => void
  onShortcutTrigger: (action: string, context?: any) => void
  context?: 'pos' | 'held_orders' | 'order_queue' | 'collaboration' | 'analytics'
}

export default function KeyboardShortcutsManager({
  isOpen,
  onClose,
  onShortcutTrigger,
  context = 'pos'
}: KeyboardShortcutsManagerProps) {
  const [shortcuts, setShortcuts] = useState<KeyboardShortcut[]>([])
  const [activeContext, setActiveContext] = useState(context)
  const [searchTerm, setSearchTerm] = useState('')
  const [showCommandPalette, setShowCommandPalette] = useState(false)
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [isEnabled, setIsEnabled] = useState(true)
  const [recentCommands, setRecentCommands] = useState<Array<{ command: string; timestamp: number }>>([])
  
  // Input protection and debugging
  const { handleGlobalKeydown } = useInputProtection()
  const { logInputEvent, enableDebugging, disableDebugging, isDebugging } = useInputDebugging()

  // Default keyboard shortcuts configuration
  const defaultShortcuts: KeyboardShortcut[] = [
    // Navigation
    {
      id: 'nav-help',
      key: 'F1',
      modifiers: {},
      description: 'Show keyboard shortcuts help',
      category: 'navigation',
      action: 'show_help',
      context: ['all'],
      enabled: true,
      global: true
    },
    {
      id: 'nav-search',
      key: 'k',
      modifiers: { ctrl: true },
      description: 'Open command palette',
      category: 'navigation',
      action: 'command_palette',
      context: ['all'],
      enabled: true,
      global: true
    },
    {
      id: 'nav-escape',
      key: 'Escape',
      modifiers: {},
      description: 'Close dialogs and clear selection',
      category: 'navigation',
      action: 'escape',
      context: ['all'],
      enabled: true,
      global: true
    },

    // Order Management
    {
      id: 'order-hold',
      key: 'h',
      modifiers: { ctrl: true, shift: true },
      description: 'Hold current order',
      category: 'order_management',
      action: 'hold_order',
      context: ['pos'],
      enabled: true,
      global: false
    },
    {
      id: 'order-recall',
      key: 'r',
      modifiers: { ctrl: true, shift: true },
      description: 'Recall held orders',
      category: 'order_management',
      action: 'recall_orders',
      context: ['pos'],
      enabled: true,
      global: false
    },
    {
      id: 'order-complete',
      key: 'Enter',
      modifiers: { ctrl: true },
      description: 'Complete current order',
      category: 'order_management',
      action: 'complete_order',
      context: ['pos'],
      enabled: true,
      global: false
    },
    {
      id: 'order-edit',
      key: 'e',
      modifiers: { ctrl: true },
      description: 'Edit selected order',
      category: 'order_management',
      action: 'edit_order',
      context: ['held_orders', 'order_queue'],
      enabled: true,
      global: false
    },
    {
      id: 'order-cancel',
      key: 'Delete',
      modifiers: { ctrl: true },
      description: 'Cancel selected order',
      category: 'order_management',
      action: 'cancel_order',
      context: ['held_orders', 'order_queue'],
      enabled: true,
      global: false
    },

    // Cart Operations
    {
      id: 'cart-clear',
      key: 'c',
      modifiers: { ctrl: true, shift: true },
      description: 'Clear cart',
      category: 'cart',
      action: 'clear_cart',
      context: ['pos'],
      enabled: true,
      global: false
    },
    {
      id: 'cart-increase',
      key: '+',
      modifiers: {},
      description: 'Increase selected item quantity',
      category: 'cart',
      action: 'increase_quantity',
      context: ['pos'],
      enabled: true,
      global: false
    },
    {
      id: 'cart-decrease',
      key: '-',
      modifiers: {},
      description: 'Decrease selected item quantity',
      category: 'cart',
      action: 'decrease_quantity',
      context: ['pos'],
      enabled: true,
      global: false
    },
    {
      id: 'cart-remove',
      key: 'Backspace',
      modifiers: {},
      description: 'Remove selected item from cart',
      category: 'cart',
      action: 'remove_item',
      context: ['pos'],
      enabled: true,
      global: false
    },

    // System Operations
    {
      id: 'sys-refresh',
      key: 'F5',
      modifiers: {},
      description: 'Refresh data',
      category: 'system',
      action: 'refresh',
      context: ['all'],
      enabled: true,
      global: true
    },
    {
      id: 'sys-settings',
      key: ',',
      modifiers: { ctrl: true },
      description: 'Open settings',
      category: 'system',
      action: 'settings',
      context: ['all'],
      enabled: true,
      global: true
    },
    {
      id: 'sys-notifications',
      key: 'n',
      modifiers: { ctrl: true, shift: true },
      description: 'Show notifications',
      category: 'system',
      action: 'notifications',
      context: ['all'],
      enabled: true,
      global: true
    },

    // Collaboration
    {
      id: 'collab-panel',
      key: 'l',
      modifiers: { ctrl: true, shift: true },
      description: 'Open collaboration panel',
      category: 'collaboration',
      action: 'collaboration_panel',
      context: ['held_orders', 'order_queue'],
      enabled: true,
      global: false
    },
    {
      id: 'collab-users',
      key: 'u',
      modifiers: { ctrl: true, shift: true },
      description: 'Show active users',
      category: 'collaboration',
      action: 'active_users',
      context: ['all'],
      enabled: true,
      global: true
    },

    // Quick Actions
    {
      id: 'quick-analytics',
      key: 'a',
      modifiers: { ctrl: true, shift: true },
      description: 'Open analytics dashboard',
      category: 'quick_actions',
      action: 'analytics',
      context: ['all'],
      enabled: true,
      global: true
    },
    {
      id: 'quick-workflow',
      key: 'w',
      modifiers: { ctrl: true, shift: true },
      description: 'Open workflow manager',
      category: 'quick_actions',
      action: 'workflow',
      context: ['all'],
      enabled: true,
      global: true
    },
    {
      id: 'quick-select-all',
      key: 'a',
      modifiers: { ctrl: true },
      description: 'Select all items',
      category: 'quick_actions',
      action: 'select_all',
      context: ['held_orders', 'order_queue'],
      enabled: true,
      global: false
    }
  ]

  // Load shortcuts on mount
  useEffect(() => {
    loadShortcuts()
  }, [])

  // Global keyboard event handler with enhanced input protection
  useEffect(() => {
    if (!isEnabled) return

    const handleKeyDown = (event: KeyboardEvent) => {
      // Log input events for debugging
      logInputEvent('keydown', event)
      
      // Use enhanced input protection
      if (!handleGlobalKeydown(event)) {
        return // Event should be handled by input normally
      }

      const matchingShortcut = findMatchingShortcut(event)
      if (matchingShortcut) {
        event.preventDefault()
        event.stopPropagation()
        handleShortcutTrigger(matchingShortcut)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isEnabled, shortcuts, context, handleGlobalKeydown, logInputEvent])

  const loadShortcuts = () => {
    // Load from localStorage or use defaults
    const saved = localStorage.getItem('pos_keyboard_shortcuts')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        setShortcuts(parsed)
      } catch (error) {
        console.error('Error loading shortcuts:', error)
        setShortcuts(defaultShortcuts)
      }
    } else {
      setShortcuts(defaultShortcuts)
    }

    // Load settings
    const settings = localStorage.getItem('pos_shortcut_settings')
    if (settings) {
      try {
        const parsed = JSON.parse(settings)
        setIsEnabled(parsed.enabled ?? true)
        setActiveContext(parsed.activeContext ?? context)
      } catch (error) {
        console.error('Error loading shortcut settings:', error)
      }
    }
  }

  const saveShortcuts = (newShortcuts: KeyboardShortcut[]) => {
    setShortcuts(newShortcuts)
    localStorage.setItem('pos_keyboard_shortcuts', JSON.stringify(newShortcuts))
  }

  const saveSettings = (settings: any) => {
    localStorage.setItem('pos_shortcut_settings', JSON.stringify(settings))
  }

  const findMatchingShortcut = (event: KeyboardEvent): KeyboardShortcut | null => {
    const key = event.key.toLowerCase()
    
    for (const shortcut of shortcuts) {
      if (!shortcut.enabled) continue
      
      // Check if shortcut applies to current context
      if (!shortcut.context?.includes('all') && !shortcut.context?.includes(context)) {
        continue
      }

      // Check modifiers
      const ctrlMatch = shortcut.modifiers.ctrl ? event.ctrlKey : !event.ctrlKey
      const altMatch = shortcut.modifiers.alt ? event.altKey : !event.altKey
      const shiftMatch = shortcut.modifiers.shift ? event.shiftKey : !event.shiftKey
      const metaMatch = shortcut.modifiers.meta ? event.metaKey : !event.metaKey

      if (ctrlMatch && altMatch && shiftMatch && metaMatch && shortcut.key.toLowerCase() === key) {
        return shortcut
      }
    }
    
    return null
  }

  const handleShortcutTrigger = (shortcut: KeyboardShortcut) => {
    onShortcutTrigger(shortcut.action, { shortcutId: shortcut.id, context })
    
    // Add to recent commands
    const recent = { command: shortcut.description, timestamp: Date.now() }
    setRecentCommands(prev => [recent, ...prev.slice(0, 9)])
  }

  const toggleShortcut = (shortcutId: string) => {
    const newShortcuts = shortcuts.map(shortcut =>
      shortcut.id === shortcutId ? { ...shortcut, enabled: !shortcut.enabled } : shortcut
    )
    saveShortcuts(newShortcuts)
  }

  const resetToDefaults = () => {
    saveShortcuts(defaultShortcuts)
  }

  const filteredShortcuts = shortcuts.filter(shortcut => {
    const matchesSearch = !searchTerm || 
      shortcut.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      shortcut.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      shortcut.category.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesContext = shortcut.context?.includes('all') || shortcut.context?.includes(activeContext)
    
    return matchesSearch && matchesContext
  })

  const shortcutsByCategory = filteredShortcuts.reduce((acc, shortcut) => {
    if (!acc[shortcut.category]) {
      acc[shortcut.category] = []
    }
    acc[shortcut.category].push(shortcut)
    return acc
  }, {} as Record<string, KeyboardShortcut[]>)

  const formatKey = (shortcut: KeyboardShortcut) => {
    const parts: string[] = []
    if (shortcut.modifiers.ctrl) parts.push('Ctrl')
    if (shortcut.modifiers.alt) parts.push('Alt')
    if (shortcut.modifiers.shift) parts.push('Shift')
    if (shortcut.modifiers.meta) parts.push('Meta')
    parts.push(shortcut.key)
    return parts.join('+')
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'navigation': return <ArrowUp className="w-4 h-4" />
      case 'order_management': return <ShoppingCart className="w-4 h-4" />
      case 'cart': return <Plus className="w-4 h-4" />
      case 'system': return <Settings className="w-4 h-4" />
      case 'collaboration': return <Users className="w-4 h-4" />
      case 'quick_actions': return <Zap className="w-4 h-4" />
      default: return <Keyboard className="w-4 h-4" />
    }
  }

  const commands = [
    { name: 'Hold Current Order', action: 'hold_order', description: 'Save current cart for later' },
    { name: 'Recall Held Orders', action: 'recall_orders', description: 'Open held orders panel' },
    { name: 'Complete Order', action: 'complete_order', description: 'Process current order' },
    { name: 'Clear Cart', action: 'clear_cart', description: 'Remove all items from cart' },
    { name: 'Refresh Data', action: 'refresh', description: 'Reload all data' },
    { name: 'Open Analytics', action: 'analytics', description: 'Show analytics dashboard' },
    { name: 'Collaboration Panel', action: 'collaboration_panel', description: 'Open collaboration tools' },
    { name: 'Workflow Manager', action: 'workflow', description: 'Manage automation rules' },
    { name: 'Show Notifications', action: 'notifications', description: 'Display notification center' },
    { name: 'Settings', action: 'settings', description: 'Open system settings' }
  ]

  const handleCommandSelect = (command: any) => {
    onShortcutTrigger(command.action)
    setCommandPaletteOpen(false)
    
    // Add to recent commands
    const recent = { command: command.name, timestamp: Date.now() }
    setRecentCommands(prev => [recent, ...prev.slice(0, 9)])
  }

  // Command palette component
  const CommandPalette = () => (
    <Dialog open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen}>
      <DialogContent className="bg-gray-900 border-blue-500 p-0 max-w-2xl">
        <Command>
          <CommandInput 
            placeholder="Type a command..." 
            className="border-0 bg-transparent text-white placeholder-gray-400 focus:ring-0"
          />
          <CommandList>
            <CommandEmpty>No commands found.</CommandEmpty>
            
            {commands.map((command) => (
              <CommandItem
                key={command.action}
                onSelect={() => handleCommandSelect(command)}
                className="text-gray-400 hover:bg-gray-800"
              >
                <div className="flex-1">
                  <p className="font-medium">{command.name}</p>
                  <p className="text-sm text-gray-500">{command.description}</p>
                </div>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  )

  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
        <div className="bg-gray-900 border border-blue-500 rounded-lg shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-blue-500">
            <div>
              <h2 className="text-2xl font-bold text-gray-400">Keyboard Shortcuts</h2>
              <p className="text-gray-400">Power user shortcuts for faster workflow</p>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center space-x-2">
                <Switch
                  checked={isEnabled}
                  onCheckedChange={(checked) => {
                    setIsEnabled(checked)
                    saveSettings({ ...{ enabled: checked, activeContext } })
                  }}
                />
                <label className="text-sm text-gray-400">Enabled</label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch
                  checked={isDebugging()}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      enableDebugging()
                    } else {
                      disableDebugging()
                    }
                  }}
                />
                <label className="text-sm text-gray-400">Debug Input</label>
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCommandPaletteOpen(true)}
                className="border-blue-500 hover:bg-blue-500/10"
              >
                <Search className="w-4 h-4 mr-2" />
                Command Palette
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={resetToDefaults}
                className="border-blue-500 hover:bg-blue-500/10"
              >
                Reset Defaults
              </Button>
              
              <Button variant="ghost" size="sm" onClick={onClose} className="text-gray-400 hover:text-white">
                ✕
              </Button>
            </div>
          </div>

          <div className="flex-1 flex overflow-hidden">
            {/* Sidebar */}
            <div className="w-64 border-r border-blue-500 p-4">
              <div className="space-y-4">
                {/* Context Selector */}
                <div>
                  <label className="text-sm font-medium mb-2 block text-gray-400">Context</label>
                  <div className="space-y-2">
                    {['pos', 'held_orders', 'order_queue', 'collaboration', 'analytics'].map((ctx) => (
                      <Button
                        key={ctx}
                        variant={activeContext === ctx ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => {
                          setActiveContext(ctx as any)
                          saveSettings({ ...{ enabled: isEnabled, activeContext: ctx } })
                        }}
                        className="w-full justify-start text-sm"
                      >
                        {ctx.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Recent Commands */}
                <div>
                  <label className="text-sm font-medium mb-2 block text-gray-400">Recent</label>
                  <ScrollArea className="h-40">
                    <div className="space-y-1">
                      {recentCommands.map((cmd, index) => (
                        <div key={index} className="text-xs text-gray-400 p-2 rounded hover:bg-gray-800">
                          {cmd.command}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 p-6">
              <div className="mb-4">
                <Input
                  placeholder="Search shortcuts..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="border-blue-500 bg-gray-800 text-white"
                />
              </div>

              <ScrollArea className="h-full">
                <div className="space-y-6">
                  {Object.entries(shortcutsByCategory).map(([category, categoryShortcuts]) => (
                    <div key={category}>
                      <div className="flex items-center gap-2 mb-3">
                        {getCategoryIcon(category)}
                        <h3 className="text-lg font-semibold text-gray-400 capitalize">
                          {category.replace('_', ' ')}
                        </h3>
                        <Badge variant="outline" className="border-blue-500 text-gray-400">
                          {categoryShortcuts.length}
                        </Badge>
                      </div>
                      
                      <div className="grid gap-2">
                        {categoryShortcuts.map((shortcut) => (
                          <Card key={shortcut.id} className="bg-gray-800 border-blue-500">
                            <CardContent className="p-4">
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-3 mb-2">
                                    <kbd className="px-2 py-1 text-xs font-mono bg-gray-700 text-gray-300 rounded border border-gray-600">
                                      {formatKey(shortcut)}
                                    </kbd>
                                    <Badge className={shortcut.enabled ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}>
                                      {shortcut.enabled ? 'Enabled' : 'Disabled'}
                                    </Badge>
                                    {shortcut.global && (
                                      <Badge variant="outline" className="border-blue-500/30 text-blue-400">
                                        Global
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-sm text-gray-400">{shortcut.description}</p>
                                </div>
                                
                                <Switch
                                  checked={shortcut.enabled}
                                  onCheckedChange={() => toggleShortcut(shortcut.id)}
                                />
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>
        </div>
      </div>

      {/* Command Palette */}
      <CommandPalette />
    </>
  )
}