import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Tenant from '#modules/tenant/models/tenant'

export default class extends BaseSeeder {
  async run() {
    // Create test tenants for development
    await Tenant.updateOrCreateMany('slug', [
      {
        name: 'Default Store',
        slug: 'default',
        description: 'Default e-commerce store',
        status: 'active',
        settings: {
          currency: 'XOF',
          language: 'fr',
          timezone: 'Africa/Dakar',
        },
      },
      {
        name: 'Apple Store Senegal',
        slug: 'apple-store-sn',
        domain: 'apple-sn.example.com',
        description: 'Apple Store for Senegal market',
        status: 'active',
        settings: {
          currency: 'XOF',
          language: 'fr',
          timezone: 'Africa/Dakar',
        },
      },
      {
        name: 'Boutique Dakar',
        slug: 'boutique-dakar',
        description: 'Local boutique in Dakar',
        status: 'active',
        settings: {
          currency: 'XOF',
          language: 'fr',
          timezone: 'Africa/Dakar',
        },
      },
    ])
  }
}
