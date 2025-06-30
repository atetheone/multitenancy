import Tenant from '#modules/tenant/models/tenant'
import { BaseModel, column, hasOne, manyToMany } from '@adonisjs/lucid/orm'
import type { HasOne, ManyToMany } from '@adonisjs/lucid/types/relations'
import { DateTime } from 'luxon'
import UserProfile from './user_profile.js'
import { withAuthFinder } from '@adonisjs/auth/mixins/lucid'
import hash from '@adonisjs/core/services/hash'
import { compose } from '@adonisjs/core/helpers'
import { DbAccessTokensProvider } from '@adonisjs/auth/access_tokens'

const AuthFinder = withAuthFinder(() => hash.use('scrypt'), {
  uids: ['email'],
  passwordColumnName: 'password',
})

export default class User extends compose(BaseModel, AuthFinder) {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare email: string

  @column({ serializeAs: null })
  declare password: string

  @column.dateTime({
    serialize: (value: DateTime | null) => {
      return value ? value.toISO() : null
    },
  })
  declare emailVerifiedAt: DateTime | null

  @column({ serializeAs: null })
  declare rememberMeToken: string | null

  @column()
  declare status: 'active' | 'inactive' | 'suspended'

  @column.dateTime({
    serialize: (value: DateTime | null) => {
      return value ? value.toISO() : null
    },
  })
  declare lastLoginAt: DateTime | null

  @column()
  declare currentTenantId: number | null

  // Relationships
  @hasOne(() => UserProfile)
  declare profile: HasOne<typeof UserProfile>

  @manyToMany(() => Tenant, { pivotTable: 'user_tenants' })
  declare tenants: ManyToMany<typeof Tenant>

  @column.dateTime({
    autoCreate: true,
    serialize: (value: DateTime) => {
      return value.toISO()
    },
  })
  declare createdAt: DateTime

  @column.dateTime({
    autoCreate: true,
    autoUpdate: true,
    serialize: (value: DateTime) => {
      return value.toISO()
    },
  })
  declare updatedAt: DateTime

  static refreshTokens = DbAccessTokensProvider.forModel(User, {
    prefix: 'rf_',
    table: 'jwt_refresh_tokens',
    type: 'jwt_refresh_token',
    tokenSecretLength: 40,
  })
  /*
    having a table called 
      jwt_refresh_tokens: {
        tokenable_id: 'integer',
        type: 'string',
        name: 'string',
        hash: 'string'(80),
        abilities: 'text',
        expires_at: 'dateTime',
        created_at: 'dateTime',
        updated_at: 'dateTime',
        last_used_at: 'dateTime',
      }
  */
}
