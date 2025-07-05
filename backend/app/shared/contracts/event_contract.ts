// ================================================================================================
// EVENT TYPES DEFINITION
// Define all events for type safety across modules
// ================================================================================================

import User from '#modules/user/models/user'
import Order from '#modules/order/models/order'
import Product from '#modules/catalog/models/product'
import Role from '#modules/rbac/models/role'

declare module '@adonisjs/core/types' {
  interface EventsList {
    // ================================================================================================
    // AUTH MODULE EVENTS
    // ================================================================================================
    'user:registered': {
      user: User
      tenantId: number
      registrationSource: string
    }

    'user:logged_in': {
      user: User
      tenantId: number
      loginMethod: string
      ipAddress?: string
    }

    'user:logged_out': {
      userId: number
      tenantId: number
      sessionDuration: number
    }

    'user:password_changed': {
      user: User
      tenantId: number
      changedBy: 'self' | 'admin'
    }

    // ================================================================================================
    // ORDER MODULE EVENTS
    // ================================================================================================
    'order:created': Order

    'order:paid': {
      order: Order
      paymentId: string
      paymentMethod: string
      amount: number
    }

    'order:shipped': {
      order: Order
      trackingNumber: string
      carrier: string
      estimatedDelivery?: string
    }

    'order:delivered': {
      order: Order
      deliveredAt: string
      deliveredBy?: string
    }

    'order:cancelled': {
      order: Order
      reason: string
      cancelledBy: number
      refundAmount?: number
    }

    'order:refunded': {
      order: Order
      refundAmount: number
      refundReason: string
      processedBy: number
    }

    // ================================================================================================
    // PRODUCT/CATALOG MODULE EVENTS
    // ================================================================================================
    'product:created': Product

    'product:updated': {
      product: Product
      changes: string[]
      updatedBy: number
    }

    'product:deleted': {
      productId: number
      productName: string
      deletedBy: number
      tenantId: number
    }

    'product:low_stock': {
      product: Product
      currentStock: number
      threshold: number
      tenantId: number
    }

    'product:out_of_stock': {
      product: Product
      lastStockUpdate: string
      tenantId: number
    }

    'product:restocked': {
      product: Product
      previousStock: number
      newStock: number
      restockedBy: number
    }

    // ================================================================================================
    // PAYMENT MODULE EVENTS
    // ================================================================================================
    'payment:initiated': {
      orderId: number
      amount: number
      method: string
      tenantId: number
      paymentId: string
    }

    'payment:successful': {
      orderId: number
      paymentId: string
      amount: number
      method: string
      tenantId: number
      processingFee?: number
    }

    'payment:failed': {
      orderId: number
      amount: number
      method: string
      error: string
      tenantId: number
      attemptCount: number
    }

    'payment:refunded': {
      orderId: number
      paymentId: string
      refundAmount: number
      refundReason: string
      tenantId: number
    }

    // ================================================================================================
    // RBAC MODULE EVENTS
    // ================================================================================================
    'role:assigned': {
      user: User
      role: Role
      tenantId: number
      assignedBy: number
      previousRoles?: string[]
    }

    'role:revoked': {
      user: User
      role: Role
      tenantId: number
      revokedBy: number
      reason?: string
    }

    'permission:granted': {
      userId: number
      permission: string
      tenantId: number
      grantedBy: number
    }

    'permission:revoked': {
      userId: number
      permission: string
      tenantId: number
      revokedBy: number
    }

    // ================================================================================================
    // CART MODULE EVENTS
    // ================================================================================================
    'cart:item_added': {
      userId: number
      productId: number
      quantity: number
      price: number
      tenantId: number
    }

    'cart:item_removed': {
      userId: number
      productId: number
      quantity: number
      tenantId: number
    }

    'cart:abandoned': {
      userId: number
      cartValue: number
      itemCount: number
      tenantId: number
      lastActivity: string
    }

    'cart:converted': {
      userId: number
      cartValue: number
      orderId: number
      tenantId: number
    }

    // ================================================================================================
    // INVENTORY MODULE EVENTS
    // ================================================================================================
    'inventory:stock_adjusted': {
      productId: number
      previousStock: number
      newStock: number
      adjustmentType: 'increase' | 'decrease' | 'correction'
      reason: string
      adjustedBy: number
      tenantId: number
    }

    'inventory:stock_reserved': {
      productId: number
      quantity: number
      orderId: number
      tenantId: number
    }

    'inventory:stock_released': {
      productId: number
      quantity: number
      orderId: number
      reason: 'cancellation' | 'expiry'
      tenantId: number
    }

    // ================================================================================================
    // NOTIFICATION MODULE EVENTS
    // ================================================================================================
    'notification:email_sent': {
      to: string
      subject: string
      template: string
      sentAt: string
      tenantId: number
    }

    'notification:email_failed': {
      to: string
      subject: string
      error: string
      tenantId: number
    }

    'notification:sms_sent': {
      to: string
      message: string
      sentAt: string
      tenantId: number
    }

    // ================================================================================================
    // ANALYTICS MODULE EVENTS
    // ================================================================================================
    'analytics:page_view': {
      path: string
      userId?: number
      tenantId: number
      userAgent?: string
      referer?: string
      timestamp: number
    }

    'analytics:conversion': {
      userId: number
      orderId: number
      orderValue: number
      conversionPath?: string[]
      tenantId: number
      timestamp: number
    }

    'analytics:user_activity': {
      userId: number
      activity: string
      metadata?: Record<string, any>
      tenantId: number
      timestamp: number
    }

    // ================================================================================================
    // DELIVERY MODULE EVENTS
    // ================================================================================================
    'delivery:assigned': {
      orderId: number
      deliveryPersonId: number
      estimatedDelivery: string
      tenantId: number
    }

    'delivery:picked_up': {
      orderId: number
      deliveryPersonId: number
      pickedUpAt: string
      tenantId: number
    }

    'delivery:delivered': {
      orderId: number
      deliveryPersonId: number
      deliveredAt: string
      signature?: string
      tenantId: number
    }

    'delivery:failed': {
      orderId: number
      deliveryPersonId: number
      reason: string
      nextAttempt?: string
      tenantId: number
    }

    // ================================================================================================
    // TENANT MODULE EVENTS
    // ================================================================================================
    'tenant:created': {
      tenantId: number
      tenantName: string
      createdBy: number
    }

    'tenant:settings_updated': {
      tenantId: number
      settings: Record<string, any>
      updatedBy: number
    }

    'tenant:deactivated': {
      tenantId: number
      reason: string
      deactivatedBy: number
    }

    // ================================================================================================
    // SYSTEM EVENTS
    // ================================================================================================
    'system:maintenance_mode': {
      enabled: boolean
      reason?: string
      estimatedDuration?: number
    }

    'system:alert': {
      level: 'info' | 'warning' | 'error' | 'critical'
      message: string
      component?: string
      metadata?: Record<string, any>
      timestamp: number
    }

    'system:event_error': {
      eventName: string
      error: string
      eventData: any
      timestamp: number
    }

    // ================================================================================================
    // CUSTOMER SERVICE EVENTS
    // ================================================================================================
    'support:ticket_created': {
      ticketId: number
      userId: number
      subject: string
      priority: 'low' | 'medium' | 'high' | 'urgent'
      tenantId: number
    }

    'support:ticket_resolved': {
      ticketId: number
      resolvedBy: number
      resolutionTime: number
      tenantId: number
    }
  }
}
