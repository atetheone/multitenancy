import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'user_profiles'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('user_id').unsigned().notNullable().unique()
      table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE')
      table.string('first_name', 50).nullable()
      table.string('last_name', 50).nullable()
      table.string('phone', 20).nullable()
      table.date('date_of_birth').nullable()
      table.string('profile_picture_url', 255).nullable()
      table.string('preferred_language', 10).defaultTo('fr')
      table.timestamps(true, true)
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
