// Advanced Order Management System Type Definitions

// Core Order Types
export interface BaseOrder {
  id: string
  orderNumber: string
  storeId: string
  createdAt: string
  updatedAt: string
  status: OrderStatus
  priority: Priority
  subtotal: number
  gst: number
  discount: number
  total: number
  notes?: string
  tags?: string[]
  metadata?: Record<string, any>
}

export interface HeldOrder extends BaseOrder {
  customerId?: string
  customer?: Customer
  employeeId?: string
  employee?: Employee
  tableNumber?: string
  orderName?: string
  holdDuration?: number
  isAutoSaved: boolean
  retrievedAt?: string
  expiredAt?: string
  age: number
  ageDisplay: string
  itemCount: number
  items: OrderItem[]
  collaborators?: OrderCollaborator[]
  locks?: OrderFieldLock[]
}

export interface OrderItem {
  id: string
  productId: string
  product: Product
  quantity: number
  price: number
  subtotal: number
  discount?: number
  notes?: string
  modifiers?: OrderModifier[]
}

export interface OrderModifier {
  id: string
  name: string
  price: number
  category: string
}

export interface OrderCollaborator {
  id: string
  userId: string
  userName: string
  status: 'viewing' | 'editing' | 'idle'
  lastActivity: string
  cursor?: CursorPosition
  permissions: CollaborationPermission[]
}

export interface OrderFieldLock {
  field: string
  lockedBy: string
  lockedByName: string
  timestamp: string
  expiresAt?: string
}

export interface CursorPosition {
  x: number
  y: number
  element?: string
  timestamp: string
}

export type OrderStatus = 
  | 'held' 
  | 'retrieved' 
  | 'processing' 
  | 'completed' 
  | 'cancelled' 
  | 'expired'

export type Priority = 0 | 1 | 2 | 3 | 4 | 5

// User and Employee Types
export interface User {
  id: string
  name: string
  email: string
  avatar?: string
  role: UserRole
  permissions: Permission[]
  isOnline: boolean
  lastSeen: string
  status: UserStatus
  preferences?: UserPreferences
}

export type UserRole = 'admin' | 'manager' | 'cashier' | 'viewer'

export type UserStatus = 'active' | 'idle' | 'away' | 'offline'

export interface UserPreferences {
  theme: 'light' | 'dark' | 'auto'
  language: string
  notifications: NotificationSettings
  keyboardShortcuts: KeyboardShortcutSettings
  collaboration: CollaborationSettings
}

export interface NotificationSettings {
  email: boolean
  push: boolean
  inApp: boolean
  sound: boolean
  collaboration: boolean
  workflow: boolean
  system: boolean
}

export interface KeyboardShortcutSettings {
  enabled: boolean
  customShortcuts: Record<string, string>
  context: 'pos' | 'held_orders' | 'order_queue' | 'collaboration' | 'analytics'
}

export interface CollaborationSettings {
  showCursor: boolean
  showUserList: boolean
  enableLocks: boolean
  autoSave: boolean
}

export interface Employee extends User {
  employeeId: string
  department: string
  shift: Shift
  performanceMetrics?: EmployeeMetrics
}

export interface Shift {
  id: string
  startTime: string
  endTime: string
  breakTimes: BreakTime[]
}

export interface BreakTime {
  start: string
  end: string
  type: 'lunch' | 'break' | 'other'
}

export interface EmployeeMetrics {
  ordersProcessed: number
  averageProcessingTime: number
  efficiency: number
  customerSatisfaction: number
  errorRate: number
}

// Customer Types
export interface Customer {
  id: string
  name: string
  email?: string
  phone?: string
  address?: Address
  loyaltyPoints: number
  tier: CustomerTier
  preferences?: CustomerPreferences
  orderHistory: string[]
}

export type CustomerTier = 'bronze' | 'silver' | 'gold' | 'platinum'

export interface CustomerPreferences {
  favoriteItems: string[]
  dietaryRestrictions: string[]
  communicationMethod: 'email' | 'sms' | 'phone' | 'none'
  orderReminders: boolean
  promotionalOffers: boolean
}

export interface Address {
  street: string
  city: string
  state: string
  zipCode: string
  country: string
}

// Product Types
export interface Product {
  id: string
  name: string
  sku: string
  barcode?: string
  description?: string
  price: number
  cost?: number
  stock: number
  minStock?: number
  category: ProductCategory
  tags: string[]
  modifiers: ProductModifier[]
  allergens?: string[]
  nutritionalInfo?: NutritionalInfo
}

export interface ProductCategory {
  id: string
  name: string
  color?: string
  description?: string
}

export interface ProductModifier {
  id: string
  name: string
  options: ModifierOption[]
  type: 'single' | 'multiple' | 'quantity'
  required: boolean
  maxSelections?: number
}

export interface ModifierOption {
  id: string
  name: string
  price: number
  default?: boolean
}

export interface NutritionalInfo {
  calories: number
  protein: number
  carbohydrates: number
  fat: number
  fiber: number
  sodium: number
  sugar: number
}

// Collaboration Types
export interface CollaborationSession {
  id: string
  orderId: string
  participants: User[]
  locks: OrderFieldLock[]
  conflicts: CollaborationConflict[]
  activities: CollaborationActivity[]
  createdAt: string
  lastActivity: string
}

export interface CollaborationConflict {
  id: string
  field: string
  userId: string
  userName: string
  value: any
  timestamp: string
  resolved: boolean
  resolution?: ConflictResolution
}

export interface ConflictResolution {
  resolvedBy: string
  resolvedValue: any
  timestamp: string
  method: 'auto' | 'manual' | 'merge'
}

export interface CollaborationActivity {
  id: string
  userId: string
  userName: string
  action: CollaborationAction
  target: string
  details?: Record<string, any>
  timestamp: string
}

export type CollaborationAction = 
  | 'view' 
  | 'edit' 
  | 'lock' 
  | 'unlock' 
  | 'comment' 
  | 'status_change' 
  | 'join' 
  | 'leave'

export interface CollaborationPermission {
  resource: string
  actions: ('read' | 'write' | 'delete' | 'admin')[]
  restrictions?: PermissionRestriction[]
}

export interface PermissionRestriction {
  field: string
  condition: string
  value: any
}

// Analytics Types
export interface AnalyticsMetrics {
  performance: PerformanceMetrics
  system: SystemMetrics
  user: UserMetrics
  business: BusinessMetrics
  realtime: RealtimeMetrics
}

export interface PerformanceMetrics {
  totalOrders: number
  completedOrders: number
  averageOrderValue: number
  averageProcessingTime: number
  ordersPerHour: number
  efficiency: number
  successRate: number
  errorRate: number
}

export interface SystemMetrics {
  status: SystemStatus
  cpuUsage: number
  memoryUsage: number
  responseTime: number
  errorRate: number
  activeConnections: number
  databaseConnections: number
  uptime: number
}

export type SystemStatus = 'healthy' | 'warning' | 'critical' | 'maintenance'

export interface UserMetrics {
  activeUsers: number
  ordersByUser: Record<string, number>
  performanceByUser: Record<string, UserPerformanceMetrics>
  collaborationMetrics: CollaborationMetrics
}

export interface UserPerformanceMetrics {
  ordersProcessed: number
  averageTime: number
  efficiency: number
  errorRate: number
  customerSatisfaction: number
}

export interface CollaborationMetrics {
  activeSessions: number
  averageSessionDuration: number
  conflictsResolved: number
  locksUtilized: number
}

export interface BusinessMetrics {
  revenue: number
  revenueGrowth: number
  orderGrowth: number
  customerGrowth: number
  averageOrderValue: number
  repeatCustomerRate: number
}

export interface RealtimeMetrics {
  ordersInQueue: number
  averageWaitTime: number
  peakHours: string[]
  currentLoad: number
  predictions: MetricPrediction[]
}

export interface MetricPrediction {
  metric: string
  predicted: number
  confidence: number
  timeframe: string
}

// Analytics Data Points
export interface TimeSeriesData {
  timestamp: string
  value: number
  category?: string
  metadata?: Record<string, any>
}

export interface MetricPoint {
  timestamp: string
  value: number
  label?: string
}

export interface ChartData {
  series: TimeSeriesData[]
  categories: string[]
  metadata: ChartMetadata
}

export interface ChartMetadata {
  title: string
  description?: string
  unit?: string
  aggregation?: 'sum' | 'average' | 'count' | 'min' | 'max'
  timeframe: string
}

// Workflow Types
export interface WorkflowRule {
  id: string
  name: string
  description: string
  trigger: WorkflowTrigger
  conditions: WorkflowCondition[]
  actions: WorkflowAction[]
  isActive: boolean
  priority: WorkflowPriority
  createdAt: string
  updatedAt: string
  executionCount: number
  successRate: number
  lastExecuted?: string
  tags: string[]
  version: string
}

export interface WorkflowTrigger {
  type: TriggerType
  config: TriggerConfig
  schedule?: ScheduleConfig
}

export type TriggerType = 
  | 'order_status_change'
  | 'order_value'
  | 'time_based'
  | 'stock_level'
  | 'customer_type'
  | 'manual'
  | 'webhook'

export interface TriggerConfig {
  field?: string
  value?: any
  operator?: ComparisonOperator
  [key: string]: any
}

export interface ScheduleConfig {
  type: 'once' | 'recurring' | 'cron'
  expression: string
  timezone?: string
}

export interface WorkflowCondition {
  field: string
  operator: ComparisonOperator
  value: any
  logicalOperator?: 'AND' | 'OR'
}

export type ComparisonOperator = 
  | 'equals'
  | 'not_equals'
  | 'greater_than'
  | 'less_than'
  | 'greater_than_or_equal'
  | 'less_than_or_equal'
  | 'contains'
  | 'not_contains'
  | 'in'
  | 'not_in'
  | 'is_null'
  | 'is_not_null'

export interface WorkflowAction {
  type: ActionType
  config: ActionConfig
  delay?: number
  retryPolicy?: RetryPolicy
  condition?: WorkflowCondition
}

export type ActionType = 
  | 'notification'
  | 'email'
  | 'sms'
  | 'print'
  | 'status_update'
  | 'inventory_update'
  | 'assign_employee'
  | 'webhook'
  | 'database_update'
  | 'file_operation'
  | 'custom'

export interface ActionConfig {
  template?: string
  recipients?: string[]
  message?: string
  data?: Record<string, any>
  [key: string]: any
}

export interface RetryPolicy {
  maxAttempts: number
  backoffStrategy: 'linear' | 'exponential' | 'fixed'
  initialDelay: number
  maxDelay: number
}

export type WorkflowPriority = 'low' | 'medium' | 'high' | 'critical'

export interface JobQueueItem {
  id: string
  ruleId: string
  ruleName: string
  status: JobStatus
  progress: number
  payload: any
  result?: any
  error?: JobError
  createdAt: string
  startedAt?: string
  completedAt?: string
  retryCount: number
  maxRetries: number
}

export type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'retrying'

export interface JobError {
  code: string
  message: string
  details?: Record<string, any>
  stack?: string
}

export interface WorkflowTemplate {
  id: string
  name: string
  description: string
  category: WorkflowCategory
  rules: Partial<WorkflowRule>[]
  isPopular: boolean
  downloadCount: number
  rating: number
  tags: string[]
  createdBy: string
  createdAt: string
  updatedAt: string
}

export type WorkflowCategory = 
  | 'order_management'
  | 'inventory'
  | 'notifications'
  | 'reporting'
  | 'customer_service'
  | 'analytics'
  | 'integration'

// Component Props Types
export interface BaseComponentProps {
  className?: string
  storeId: string
  isOpen?: boolean
  onClose?: () => void
  [key: string]: any
}

export interface CollaborationPanelProps extends BaseComponentProps {
  orderId?: string
  onLockRequest?: (orderId: string, field: string) => void
  onUnlockRequest?: (orderId: string, field: string) => void
}

export interface AnalyticsDashboardProps extends BaseComponentProps {
  refreshInterval?: number
  timeRange?: '1h' | '24h' | '7d' | '30d'
  selectedMetrics?: string[]
}

export interface WorkflowManagerProps extends BaseComponentProps {
  onRuleCreate?: (rule: WorkflowRule) => void
  onRuleUpdate?: (rule: WorkflowRule) => void
  onRuleDelete?: (ruleId: string) => void
}

export interface KeyboardShortcutsManagerProps extends BaseComponentProps {
  onShortcutTrigger: (action: string, context?: any) => void
  context?: 'pos' | 'held_orders' | 'order_queue' | 'collaboration' | 'analytics'
}

export interface EnhancedOrderIndicatorsProps {
  order: HeldOrder
  onStatusChange?: (orderId: string, newStatus: string) => void
  onRetrieve?: (orderId: string) => void
  onEdit?: (orderId: string) => void
  onQuickAction?: (action: string, orderId: string) => void
  showCollaboration?: boolean
  size?: 'sm' | 'md' | 'lg'
  variant?: 'default' | 'compact' | 'minimal'
}

export interface ContextualMenuProps extends BaseComponentProps {
  type: 'order' | 'cart_item' | 'bulk_orders' | 'empty_space' | 'header' | 'sidebar'
  data?: any
  position?: { x: number; y: number }
  disabled?: boolean
}

export interface BulkActionsToolbarProps {
  selectedItems: any[]
  onAction: (action: string, data?: any) => void
  className?: string
}

export interface QuickActionButtonProps {
  action: string
  icon: React.ComponentType<{ className?: string }>
  label: string
  description?: string
  onClick: () => void
  disabled?: boolean
  variant?: 'default' | 'destructive' | 'outline'
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export interface AdvancedOrderManagementProps {
  storeId: string
  currentOrder?: BaseOrder
  heldOrders?: HeldOrder[]
  onOrderUpdate?: (order: BaseOrder) => void
  onOrderRetrieve?: (orderId: string) => void
  onOrderHold?: (orderData: any) => void
  className?: string
  initialView?: 'pos' | 'collaboration' | 'analytics' | 'workflow'
  enableRealTime?: boolean
  enableCollaboration?: boolean
  enableAnalytics?: boolean
  enableWorkflow?: boolean
  enableKeyboardShortcuts?: boolean
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: ApiError
  message?: string
  pagination?: PaginationInfo
}

export interface ApiError {
  code: string
  message: string
  details?: Record<string, any>
  timestamp: string
}

export interface PaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrevious: boolean
}

// Event Types
export interface SystemEvent {
  id: string
  type: EventType
  source: string
  data: any
  timestamp: string
  userId?: string
  correlationId?: string
}

export type EventType = 
  | 'order_created'
  | 'order_updated'
  | 'order_status_changed'
  | 'order_retrieved'
  | 'order_held'
  | 'user_joined'
  | 'user_left'
  | 'collaboration_started'
  | 'collaboration_ended'
  | 'workflow_triggered'
  | 'workflow_completed'
  | 'error_occurred'
  | 'system_alert'

export interface NotificationEvent extends SystemEvent {
  type: 'notification'
  data: {
    title: string
    message: string
    severity: 'info' | 'success' | 'warning' | 'error'
    actions?: NotificationAction[]
  }
}

export interface NotificationAction {
  id: string
  label: string
  action: string
  style?: 'primary' | 'secondary' | 'destructive'
}

// Utility Types
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

export type FilterOptions<T> = {
  [K in keyof T]?: T[K] | { equals?: T[K]; not?: T[K]; in?: T[K][]; contains?: T[K] }
}

export type SortOptions<T> = {
  [K in keyof T]?: 'asc' | 'desc'
}

// Constants
export const ORDER_STATUSES: OrderStatus[] = ['held', 'retrieved', 'processing', 'completed', 'cancelled', 'expired']

export const PRIORITIES: Priority[] = [0, 1, 2, 3, 4, 5]

export const USER_ROLES: UserRole[] = ['admin', 'manager', 'cashier', 'viewer']

export const WORKFLOW_PRIORITIES: WorkflowPriority[] = ['low', 'medium', 'high', 'critical']

export const TRIGGER_TYPES: TriggerType[] = [
  'order_status_change',
  'order_value', 
  'time_based',
  'stock_level',
  'customer_type',
  'manual',
  'webhook'
]

export const ACTION_TYPES: ActionType[] = [
  'notification',
  'email',
  'sms', 
  'print',
  'status_update',
  'inventory_update',
  'assign_employee',
  'webhook',
  'database_update',
  'file_operation',
  'custom'
]

// Export all types for easy importing
export * from './order-management'
export * from './collaboration'  
export * from './analytics'
export * from './workflow'