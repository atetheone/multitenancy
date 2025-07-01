import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'jwt_refresh_tokens'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('tokenable_id').unsigned().notNullable()
      table.string('type', 50).notNullable()
      table.string('name', 100).nullable()
      table.string('hash', 80).notNullable()
      table.text('abilities').nullable()
      table.timestamp('expires_at').nullable()
      table.timestamp('last_used_at').nullable()
      table.timestamps(true, true)
      table.index(['tokenable_id', 'type'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
