import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'roles'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('name', 50).notNullable() // 'admin', 'customer'
      table.string('display_name', 100).notNullable() // 'Administrator'
      table.integer('tenant_id').unsigned().references('id').inTable('tenants').onDelete('CASCADE')
      table.boolean('is_default').defaultTo(false)
      table.timestamp('created_at', { useTz: true }).defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).defaultTo(this.now())

      table.unique(['name', 'tenant_id'])
      table.index(['tenant_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
