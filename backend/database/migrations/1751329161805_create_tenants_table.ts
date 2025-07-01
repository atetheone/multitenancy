import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'tenants'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('name', 100).notNullable()
      table.string('slug', 100).notNullable().unique()
      table.string('domain', 255).nullable().unique()
      table.text('description').nullable()
      table.string('logo', 255).nullable()
      table.jsonb('settings').defaultTo('{}')
      table.enum('status', ['active', 'inactive', 'suspended']).defaultTo('active')
      table.timestamps(true, true)
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
