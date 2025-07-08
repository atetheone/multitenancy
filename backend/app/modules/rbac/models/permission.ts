import { BaseModel, column, belongsTo, manyToMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, ManyToMany } from '@adonisjs/lucid/types/relations'
import { DateTime } from 'luxon'
import Tenant from '#modules/tenant/models/tenant'
import Role from '#modules/rbac/models/role'

export default class Permission extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare name: string // 'create_product', 'view_analytics'

  @column()
  declare resource: string // 'product', 'order', 'user', 'analytics'

  @column()
  declare action: string // 'create', 'read', 'update', 'delete', 'manage'

  @column()
  declare description: string | null

  @column()
  declare tenantId: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  // Relationships
  @belongsTo(() => Tenant)
  declare tenant: BelongsTo<typeof Tenant>

  @manyToMany(() => Role, {
    pivotTable: 'role_permissions',
  })
  declare roles: ManyToMany<typeof Role>

  // Helper methods
  static async findByName(name: string, tenantId: number): Promise<Permission | null> {
    return await Permission.query().where('name', name).where('tenant_id', tenantId).first()
  }

  static async findByResourceAction(
    resource: string,
    action: string,
    tenantId: number
  ): Promise<Permission | null> {
    return await Permission.query()
      .where('resource', resource)
      .where('action', action)
      .where('tenant_id', tenantId)
      .first()
  }

  // Get all permissions for a tenant by resource
  static async getByResource(resource: string, tenantId: number): Promise<Permission[]> {
    return await Permission.query()
      .where('resource', resource)
      .where('tenant_id', tenantId)
      .orderBy('action')
  }

  // Get all permissions for a tenant
  static async getByTenant(tenantId: number): Promise<Permission[]> {
    return await Permission.query()
      .where('tenant_id', tenantId)
      .orderBy('resource')
      .orderBy('action')
  }

  // Create permission with automatic naming
  static async createPermission(
    resource: string,
    action: string,
    tenantId: number,
    description?: string
  ): Promise<Permission> {
    const name = `${action}:${resource}`
    return await Permission.create({
      name,
      resource,
      action,
      tenantId,
      description: description || `${action} ${resource}`,
    })
  }

  // Bulk create permissions for a resource
  static async createResourcePermissions(
    resource: string,
    actions: string[],
    tenantId: number
  ): Promise<Permission[]> {
    const permissions = actions.map((action) => ({
      name: `${action}:${resource}`,
      resource,
      action,
      tenantId,
      description: `${action} ${resource}`,
    }))

    return await Permission.createMany(permissions)
  }

  // Get full permission identifier
  get fullName(): string {
    return `${this.action}:${this.resource}`
  }

  // Check if permission matches a pattern (e.g., 'read:*' or '*:product')
  matches(pattern: string): boolean {
    const [actionPattern, resourcePattern] = pattern.split(':')

    const actionMatches = actionPattern === '*' || actionPattern === this.action
    const resourceMatches = resourcePattern === '*' || resourcePattern === this.resource

    return actionMatches && resourceMatches
  }
}
