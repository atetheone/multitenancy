import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('email', 100).notNullable().unique()
      table.string('password', 255).notNullable()
      table.timestamp('email_verified_at').nullable()
      table.string('remember_me_token', 255).nullable()
      table.enum('status', ['active', 'inactive', 'suspended']).defaultTo('active')
      table.timestamp('last_login_at').nullable()
      table.integer('current_tenant_id').nullable()
      table.timestamps(true, true)
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
