import { BaseModel, column, manyToMany } from '@adonisjs/lucid/orm'
import type { ManyToMany } from '@adonisjs/lucid/types/relations'
import { DateTime } from 'luxon'
import User from '#modules/user/models/user'

export default class Tenant extends BaseModel {
  static table = 'tenants'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare name: string

  @column()
  declare slug: string

  @column()
  declare domain: string | null

  @column()
  declare description: string | null

  @column()
  declare logo: string | null

  @column()
  declare settings: Record<string, any>

  @column()
  declare status: 'active' | 'inactive' | 'suspended'

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  // Relations
  @manyToMany(() => User, { pivotTable: 'user_tenants' })
  declare users: ManyToMany<typeof User>
}
