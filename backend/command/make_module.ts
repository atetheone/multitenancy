import { BaseCommand, args, flags } from '@adonisjs/core/ace'
import { CommandOptions } from '@adonisjs/core/types/ace'
import string from '@adonisjs/core/helpers/string'
import { join } from 'node:path'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'

export default class MakeModule extends BaseCommand {
  static commandName = 'make:module'
  static description = 'Create a new module with default structure and files'

  @args.string({ description: 'Name of the module' })
  declare name: string

  @flags.boolean({ 
    description: 'Create a default model for the module',
    alias: 'm'
  })
  declare model: boolean

  @flags.boolean({ 
    description: 'Create migration file',
    alias: 'migration'
  })
  declare migration: boolean

  @flags.boolean({ 
    description: 'Create test files',
    alias: 't'
  })
  declare test: boolean

  @flags.string({ 
    description: 'Domain context (auth, user, catalog, etc.)',
    alias: 'd'
  })
  declare domain: string

  static options: CommandOptions = {
    loadApp: true,
  }

  async run() {
    const moduleName = string.camelCase(this.name)
    const moduleNamePascal = string.pascalCase(this.name)
    const moduleNameSnake = string.snakeCase(this.name)
    const domainContext = this.domain || 'shared'

    this.logger.info(`Creating module: ${moduleNamePascal}`)

    // Créer la structure du dossier
    const modulePath = join(this.app.appRoot.toString(), 'app', 'modules', moduleName)
    
    await this.createModuleStructure(modulePath)
    
    // Générer les fichiers de base
    await this.generateFiles(modulePath, {
      moduleName,
      moduleNamePascal,
      moduleNameSnake,
      domainContext,
    })

    // Créer le modèle si demandé
    if (this.model) {
      await this.generateModel(modulePath, moduleNamePascal, moduleNameSnake)
    }

    // Créer la migration si demandée
    if (this.migration) {
      await this.generateMigration(moduleNameSnake, moduleNamePascal)
    }

    // Créer les tests si demandés
    if (this.test) {
      await this.generateTests(modulePath, moduleNamePascal)
    }

    this.logger.success(`Module ${moduleNamePascal} created successfully!`)
    this.logger.info('Next steps:')
    this.logger.info(`1. Add routes to start/routes.ts`)
    this.logger.info(`2. Register module in providers/module_provider.ts`)
    if (this.migration) {
      this.logger.info(`3. Run: node ace migration:run`)
    }
  }

  private async createModuleStructure(modulePath: string) {
    const folders = [
      'controllers',
      'models',
      'services',
      'validators',
      'middleware',
      'routes',
      'events',
      'contracts',
      'exceptions',
    ]

    for (const folder of folders) {
      const folderPath = join(modulePath, folder)
      if (!existsSync(folderPath)) {
        await mkdir(folderPath, { recursive: true })
      }
    }
  }

  private async generateFiles(modulePath: string, context: any) {
    const files = [
      { template: 'controller', path: `controllers/${context.moduleName}_controller.ts` },
      { template: 'service', path: `services/${context.moduleName}_service.ts` },
      { template: 'validator', path: `validators/${context.moduleName}_validator.ts` },
      { template: 'route', path: `routes/${context.moduleName}_routes.ts` },
    ]

    for (const file of files) {
      await this.generateFromTemplate(file.template, join(modulePath, file.path), context)
    }
  }

  private async generateModel(modulePath: string, moduleNamePascal: string, moduleNameSnake: string) {
    const context = {
      moduleNamePascal,
      moduleNameSnake,
      tableName: string.pluralize(moduleNameSnake),
    }
    
    await this.generateFromTemplate(
      'model',
      join(modulePath, 'models', `${moduleNameSnake}.ts`),
      context
    )
  }

  private async generateMigration(moduleNameSnake: string, moduleNamePascal: string) {
    const timestamp = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 14)
    const tableName = string.pluralize(moduleNameSnake)
    
    const migrationPath = join(
      this.app.appRoot.toString(),
      'database',
      'migrations',
      `${timestamp}_create_${tableName}_table.ts`
    )

    const context = {
      moduleNamePascal,
      tableName,
      className: `Create${string.pluralize(moduleNamePascal)}Table`,
    }

    await this.generateFromTemplate('migration', migrationPath, context)
  }

  private async generateTests(modulePath: string, moduleNamePascal: string) {
    const testPath = join(
      this.app.appRoot.toString(),
      'tests',
      'functional',
      `${string.snakeCase(moduleNamePascal)}.spec.ts`
    )

    const context = { moduleNamePascal }
    await this.generateFromTemplate('test', testPath, context)
  }

  private async generateFromTemplate(templateName: string, outputPath: string, context: any) {
    const templatePath = join(__dirname, 'templates', `${templateName}.txt`)
    
    try {
      let template = await readFile(templatePath, 'utf-8')
      
      // Remplacer les placeholders
      template = template.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
        return context[key.trim()] || match
      })

      // Créer le dossier si nécessaire
      const dir = join(outputPath, '..')
      if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true })
      }

      await writeFile(outputPath, template)
      this.logger.action('create').succeeded(outputPath)
    } catch (error) {
      this.logger.error(`Failed to generate ${templateName}: ${error.message}`)
    }
  }
}