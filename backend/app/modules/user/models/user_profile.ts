import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { DateTime } from 'luxon'
import User from './user.js'

export default class UserProfile extends BaseModel {
  static table = 'user_profiles'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare userId: number

  @column()
  declare firstName: string | null

  @column()
  declare lastName: string | null

  @column()
  declare phone: string | null

  @column.date()
  declare dateOfBirth: DateTime | null

  @column()
  declare profilePictureUrl: string | null

  @column()
  declare preferredLanguage: string // Default 'fr' for Senegal

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  get fullName(): string {
    return `${this.firstName || ''} ${this.lastName || ''}`.trim()
  }
}
