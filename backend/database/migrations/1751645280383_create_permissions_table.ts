import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'permissions'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('name', 100).notNullable() // 'create_product', 'view_analytics'
      table.string('resource', 50).notNullable() // 'product', 'order', 'user'
      table.string('action', 50).notNullable() // 'create', 'read', 'update', 'delete'
      table.string('description', 255).nullable()
      table.integer('tenant_id').unsigned().references('id').inTable('tenants').onDelete('CASCADE')
      table.timestamp('created_at', { useTz: true }).defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).defaultTo(this.now())

      // Unique constraints
      table.unique(['name', 'tenant_id'])
      table.unique(['resource', 'action', 'tenant_id'])

      // Indexes for performance
      table.index(['tenant_id'])
      table.index(['resource'])
      table.index(['action'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
