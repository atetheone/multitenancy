// ================================================================================================
// RBAC ERROR HANDLING & EDGE CASES - Updated for Unified Module
// ================================================================================================

import { test } from '@japa/runner'
import User from '#modules/user/models/user'
import Tenant from '#modules/tenant/models/tenant'
import RoleService from '#modules/rbac/services/role_service'
import PermissionService from '#modules/rbac/services/permission_service'
import testUtils from '@adonisjs/core/services/test_utils'

test.group('RBAC - Error Handling & Edge Cases', (group) => {
  let roleService: RoleService
  let permissionService: PermissionService
  let testTenant: Tenant

  group.each.setup(() => testUtils.db().truncate())

  group.setup(async () => {
    permissionService = new PermissionService()
    roleService = new RoleService(permissionService)

    testTenant = await Tenant.create({
      name: 'Error Test Store',
      slug: 'error-test-store',
      status: 'active',
    })

    await roleService.createDefaultRoles(testTenant.id)
  })

  test('should handle missing tenant context gracefully', async ({ client }) => {
    const user = await User.create({
      email: 'test@error.com',
      password: 'password123',
      status: 'active',
    })

    await user.related('profile').create({
      firstName: 'Test',
      lastName: 'User',
    })

    const app = await import('@adonisjs/core/services/app')
    const ctx = app.default.container.make('HttpContext')
    const tokenObj = await ctx.auth.use('jwt').generate(user)

    // Request without tenant header should fail
    const response = await client
      .get('/api/rbac/roles')
      .header('Authorization', `Bearer ${tokenObj.token}`)
      // Missing X-Tenant-Slug header

    response.assertStatus(400)
  })

  test('should handle duplicate permission creation gracefully', async ({ assert }) => {
    // Create a permission
    await permissionService.createPermission({
      resource: 'test_resource',
      action: 'test_action',
      tenantId: testTenant.id,
    })

    // Try to create the same permission again
    try {
      await permissionService.createPermission({
        resource: 'test_resource',
        action: 'test_action',
        tenantId: testTenant.id,
      })
      assert.fail('Should have thrown an error for duplicate permission')
    } catch (error) {
      assert.equal(error.status, 409)
      assert.include(error.message, 'already exists')
    }
  })

  test('should handle non-existent role assignment gracefully', async ({ assert }) => {
    const user = await User.create({
      email: 'test@nonexistent.com',
      password: 'password123',
      status: 'active',
    })

    try {
      await roleService.assignRole(user, 'non_existent_role', testTenant.id)
      assert.fail('Should have thrown an error for non-existent role')
    } catch (error) {
      assert.equal(error.status, 404)
      assert.include(error.message, 'not found')
    }
  })

  test('should handle invalid permission format in middleware', async ({ client }) => {
    const user = await User.create({
      email: 'admin@invalid.com',
      password: 'password123',
      status: 'active',
    })

    await user.related('profile').create({
      firstName: 'Admin',
      lastName: 'User',
    })

    await user.related('tenants').attach([testTenant.id])
    await roleService.assignRole(user, 'admin', testTenant.id)

    const app = await import('@adonisjs/core/services/app')
    const ctx = app.default.container.make('HttpContext')
    const tokenObj = await ctx.auth.use('jwt').generate(user)

    // Test with invalid permission format (missing colon)
    const response = await client
      .post('/api/rbac/users/1/check-permission')
      .header('Authorization', `Bearer ${tokenObj.token}`)
      .header('X-Tenant-Slug', testTenant.slug)
      .json({ permission: 'invalid_format_no_colon' })

    response.assertStatus(200) // Should still work, just return false
    const body = response.body()
    assert.isFalse(body.data.hasPermission)
  })

  test('should handle bulk permission creation with partial failures', async ({ assert }) => {
    // Create some permissions first
    await permissionService.createPermission({
      resource: 'existing_resource',
      action: 'create',
      tenantId: testTenant.id,
    })

    // Try to create bulk permissions where some already exist
    try {
      await permissionService.createResourcePermissions(
        'existing_resource', 
        ['create', 'read', 'update'], // 'create' already exists
        testTenant.id
      )
      assert.fail('Should have thrown an error for duplicate permissions')
    } catch (error) {
      assert.equal(error.status, 409)
      assert.include(error.message, 'already exist')
    }
  })

  test('should validate tenant isolation in role assignment', async ({ assert }) => {
    // Create second tenant
    const secondTenant = await Tenant.create({
      name: 'Second Tenant',
      slug: 'second-tenant',
      status: 'active',
    })

    await roleService.createDefaultRoles(secondTenant.id)

    const user = await User.create({
      email: 'cross@tenant.com',
      password: 'password123',
      status: 'active',
    })

    // User should only be able to get roles from their own tenant
    await user.related('tenants').attach([testTenant.id]) // Only first tenant

    const firstTenantRoles = await roleService.getUserRoles(user, testTenant.id)
    const secondTenantRoles = await roleService.getUserRoles(user, secondTenant.id)

    assert.lengthOf(firstTenantRoles, 0) // No roles assigned yet
    assert.lengthOf(secondTenantRoles, 0) // No access to second tenant
  })

  test('should handle permission service with invalid user gracefully', async ({ assert }) => {
    const fakeUser = new User()
    fakeUser.id = 99999 // Non-existent user ID

    const hasPermission = await permissionService.hasPermission(
      fakeUser, 
      'read:product', 
      testTenant.id
    )

    assert.isFalse(hasPermission) // Should return false, not throw error
  })
})