import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import db from '@adonisjs/lucid/services/db'

export default class DbDescribe extends BaseCommand {
  static commandName = 'db:describe'
  static description = 'Show all database tables with their columns and attributes'

  static options: CommandOptions = {}

  async run() {
    try {
      this.logger.info('🗄️  Database Schema Overview')
      this.logger.info('='.repeat(50))

      // Get all table names
      const tables = await db.rawQuery(`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_type = 'BASE TABLE'
          ORDER BY table_name
        `)

      if (tables.rows.length === 0) {
        this.logger.warning('No tables found in the database')
        return
      }

      // For each table, get column information
      for (const table of tables.rows) {
        const tableName = table.table_name

        this.logger.info(`\n📋 Table: ${tableName}`)
        this.logger.info('-'.repeat(60))

        const columns = await db.rawQuery(`
            SELECT 
              column_name,
              data_type,
              character_maximum_length,
              is_nullable,
              column_default,
              CASE 
                WHEN column_name IN (
                  SELECT column_name 
                  FROM information_schema.table_constraints tc
                  JOIN information_schema.key_column_usage kcu 
                    ON tc.constraint_name = kcu.constraint_name
                  WHERE tc.table_name = '${tableName}' 
                  AND tc.constraint_type = 'PRIMARY KEY'
                ) THEN 'PRIMARY KEY'
                WHEN column_name IN (
                  SELECT kcu.column_name
                  FROM information_schema.table_constraints tc
                  JOIN information_schema.key_column_usage kcu 
                    ON tc.constraint_name = kcu.constraint_name
                  WHERE tc.table_name = '${tableName}' 
                  AND tc.constraint_type = 'FOREIGN KEY'
                ) THEN 'FOREIGN KEY'
                WHEN column_name IN (
                  SELECT kcu.column_name
                  FROM information_schema.table_constraints tc
                  JOIN information_schema.key_column_usage kcu 
                    ON tc.constraint_name = kcu.constraint_name
                  WHERE tc.table_name = '${tableName}' 
                  AND tc.constraint_type = 'UNIQUE'
                ) THEN 'UNIQUE'
                ELSE ''
              END as constraint_type
            FROM information_schema.columns 
            WHERE table_name = '${tableName}'
            ORDER BY ordinal_position
          `)

        // Display columns in a formatted table
        for (const col of columns.rows) {
          const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'
          const length = col.character_maximum_length ? `(${col.character_maximum_length})` : ''
          const constraint = col.constraint_type ? `[${col.constraint_type}]` : ''
          const defaultValue = col.column_default ? `DEFAULT: ${col.column_default}` : ''

          this.logger.info(
            `  ${col.column_name.padEnd(25)} ${(col.data_type + length).padEnd(20)} ${nullable.padEnd(10)} ${constraint.padEnd(15)} ${defaultValue}`
          )
        }

        // Get foreign key relationships
        const foreignKeys = await db.rawQuery(`
            SELECT
              kcu.column_name,
              ccu.table_name AS foreign_table_name,
              ccu.column_name AS foreign_column_name
            FROM information_schema.table_constraints AS tc
            JOIN information_schema.key_column_usage AS kcu
              ON tc.constraint_name = kcu.constraint_name
            JOIN information_schema.constraint_column_usage AS ccu
              ON ccu.constraint_name = tc.constraint_name
            WHERE tc.constraint_type = 'FOREIGN KEY'
            AND tc.table_name = '${tableName}'
          `)

        if (foreignKeys.rows.length > 0) {
          this.logger.info('\n  🔗 Foreign Key Relationships:')
          for (const fk of foreignKeys.rows) {
            this.logger.info(
              `     ${fk.column_name} → ${fk.foreign_table_name}.${fk.foreign_column_name}`
            )
          }
        }

        // Get row count
        const countResult = await db.rawQuery(`SELECT COUNT(*) as count FROM "${tableName}"`)
        const rowCount = countResult.rows[0].count
        this.logger.info(`\n  📊 Rows: ${rowCount}`)
      }

      this.logger.info('\n✅ Database schema overview completed!')
    } catch (error) {
      this.logger.error('❌ Error describing database:', error.message)
    }
  }
}
