import { BaseModel, column, belongsTo, manyToMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, ManyToMany } from '@adonisjs/lucid/types/relations'
import { DateTime } from 'luxon'
import Tenant from '#modules/tenant/models/tenant'
import User from '#modules/user/models/user'
import Permission from '#modules/rbac/models/permission'

export default class Role extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare name: string // 'admin', 'manager', 'staff', 'customer'

  @column()
  declare displayName: string // 'Administrator', 'Store Manager'

  @column()
  declare tenantId: number

  @column()
  declare isDefault: boolean // Default role for new users

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  // Relationships
  @belongsTo(() => Tenant)
  declare tenant: BelongsTo<typeof Tenant>

  @manyToMany(() => User, {
    pivotTable: 'user_roles',
    pivotColumns: ['tenant_id'],
  })
  declare users: ManyToMany<typeof User>

  @manyToMany(() => Permission, {
    pivotTable: 'role_permissions',
  })
  declare permissions: ManyToMany<typeof Permission>

  // Simple helper methods
  static async getDefaultRole(tenantId: number): Promise<Role | null> {
    return await Role.query().where('tenant_id', tenantId).where('is_default', true).first()
  }

  static async findByName(name: string, tenantId: number): Promise<Role | null> {
    return await Role.query().where('name', name).where('tenant_id', tenantId).first()
  }
}
