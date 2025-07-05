import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Tenant from '#modules/tenant/models/tenant'
import RbacService from '#modules/rbac/services/rbac_service'
import PermissionService from '#modules/rbac/services/permission_service'
import app from '@adonisjs/core/services/app'

export default class SimpleRbacSeeder extends BaseSeeder {
  async run() {
    const permissionService = await app.container.make(PermissionService)
    const rbacService = await app.container.make(RbacService)
    const tenants = await Tenant.all()

    for (const tenant of tenants) {
      console.log(`Creating permissions and roles for tenant: ${tenant.name}`)
      
      try {
        // Create default e-commerce permissions
        console.log(`  - Creating default e-commerce permissions...`)
        await permissionService.createEcommercePermissions(tenant.id)
        
        // Create default roles with proper permissions
        console.log(`  - Creating default roles...`)
        await rbacService.createDefaultRoles(tenant.id)
        
        console.log(`  ✅ Successfully seeded tenant: ${tenant.name}`)
      } catch (error) {
        console.log(`  ⚠️  Error seeding tenant ${tenant.name}: ${error.message}`)
        // Continue with next tenant
      }
    }

    console.log('✅ Simple RBAC seeded successfully')
  }
}
