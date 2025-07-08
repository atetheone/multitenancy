// ================================================================================================
// SUPER ADMIN SEEDER FOR TESTING
// ================================================================================================
// File: database/seeders/super_admin_seeder.ts

import { BaseSeeder } from '@adonisjs/lucid/seeders'
import User from '#modules/user/models/user'
import Role from '#modules/rbac/models/role'
import Tenant from '#modules/tenant/models/tenant'
import { DateTime } from 'luxon'

export default class SuperAdminSeeder extends BaseSeeder {
  async run() {
    console.log('👑 Creating Super Admin for testing...')

    // ================================================================================================
    // 1. CREATE SUPER ADMIN USER
    // ================================================================================================

    const superAdminEmail = 'admin@ecommerce.test'
    const superAdminPassword = 'SuperAdmin123!'

    // Check if super admin already exists
    let superAdmin = await User.findBy('email', superAdminEmail)

    if (!superAdmin) {
      superAdmin = await User.create({
        email: superAdminEmail,
        password: superAdminPassword,
        status: 'active',
        emailVerifiedAt: DateTime.now(),
      })

      // Create profile for super admin
      await superAdmin.related('profile').create({
        firstName: 'Super',
        lastName: 'Administrator',
        phone: '+221 77 123 45 67',
        preferredLanguage: 'fr',
      })

      console.log(`✅ Super Admin user created: ${superAdminEmail}`)
    } else {
      console.log(`ℹ️  Super Admin already exists: ${superAdminEmail}`)
    }

    // ================================================================================================
    // 2. CREATE SUPER ADMIN ROLE IN ALL TENANTS
    // ================================================================================================

    const tenants = await Tenant.all()

    for (const tenant of tenants) {
      console.log(`Processing tenant: ${tenant.name} (${tenant.slug})`)

      // Create or get super admin role for this tenant
      let superAdminRole = await Role.query()
        .where('name', 'super_admin')
        .where('tenant_id', tenant.id)
        .first()

      if (!superAdminRole) {
        superAdminRole = await Role.create({
          name: 'super_admin',
          displayName: 'Super Administrator',
          tenantId: tenant.id,
          isDefault: false,
        })
        console.log(`✅ Super Admin role created for tenant: ${tenant.name}`)
      }

      // Check if super admin already has this role
      const existingAssignment = await superAdmin
        .related('roles')
        .query()
        .where('role_id', superAdminRole.id)
        .where('user_roles.tenant_id', tenant.id)
        .first()

      if (!existingAssignment) {
        // Assign super admin role to user in this tenant
        await superAdmin.related('roles').attach({
          [superAdminRole.id]: {
            tenant_id: tenant.id,
          },
        })
        console.log(`✅ Super Admin role assigned in tenant: ${tenant.name}`)
      } else {
        console.log(`ℹ️  Super Admin already has role in tenant: ${tenant.name}`)
      }
    }

    // ================================================================================================
    // 3. CREATE TEST USERS FOR DIFFERENT ROLES
    // ================================================================================================

    const testUsers = [
      {
        email: 'manager@test-store.com',
        password: 'Manager123!',
        firstName: 'Store',
        lastName: 'Manager',
        roleName: 'manager',
        tenantSlug: 'test-store',
      },
      {
        email: 'staff@test-store.com',
        password: 'Staff123!',
        firstName: 'Staff',
        lastName: 'Member',
        roleName: 'staff',
        tenantSlug: 'test-store',
      },
      {
        email: 'customer@test-store.com',
        password: 'Customer123!',
        firstName: 'Test',
        lastName: 'Customer',
        roleName: 'customer',
        tenantSlug: 'test-store',
      },
    ]

    for (const userData of testUsers) {
      let user = await User.findBy('email', userData.email)

      if (!user) {
        user = await User.create({
          email: userData.email,
          password: userData.password,
          status: 'active',
          emailVerifiedAt: DateTime.now(),
        })

        await user.related('profile').create({
          firstName: userData.firstName,
          lastName: userData.lastName,
          preferredLanguage: 'fr',
        })

        console.log(`✅ Test user created: ${userData.email}`)
      }

      // Find tenant and role
      const tenant = await Tenant.findBy('slug', userData.tenantSlug)
      if (tenant) {
        const role = await Role.query()
          .where('name', userData.roleName)
          .where('tenant_id', tenant.id)
          .first()

        if (role) {
          // Check if already assigned
          const existingAssignment = await user
            .related('roles')
            .query()
            .where('role_id', role.id)
            .where('user_roles.tenant_id', tenant.id)
            .first()

          if (!existingAssignment) {
            await user.related('roles').attach({
              [role.id]: { tenant_id: tenant.id },
            })
            console.log(`✅ Assigned ${userData.roleName} role to ${userData.email}`)
          }
        }
      }
    }

    // ================================================================================================
    // 4. DISPLAY CREDENTIALS
    // ================================================================================================

    console.log('')
    console.log('🔑 Test Credentials Created:')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('👑 SUPER ADMIN (all tenants):')
    console.log(`   Email: ${superAdminEmail}`)
    console.log(`   Password: ${superAdminPassword}`)
    console.log('')
    console.log('🏢 TEST STORE USERS (tenant: test-store):')
    console.log('   📋 Manager:')
    console.log('      Email: manager@test-store.com')
    console.log('      Password: Manager123!')
    console.log('')
    console.log('   👨‍💼 Staff:')
    console.log('      Email: staff@test-store.com')
    console.log('      Password: Staff123!')
    console.log('')
    console.log('   🛒 Customer:')
    console.log('      Email: customer@test-store.com')
    console.log('      Password: Customer123!')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('')

    console.log('✅ Super Admin and test users seeded successfully!')
  }
}
