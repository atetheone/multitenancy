// ================================================================================================
// RBAC PERMISSION VALIDATION TESTS - Updated for Unified Module
// ================================================================================================

import { test } from '@japa/runner'
import User from '#modules/user/models/user'
import Permission from '#modules/rbac/models/permission'
import Tenant from '#modules/tenant/models/tenant'
import RoleService from '#modules/rbac/services/role_service'
import PermissionService from '#modules/rbac/services/permission_service'
import testUtils from '@adonisjs/core/services/test_utils'

test.group('RBAC - Permission Validation & Access Control', (group) => {
  let roleService: RoleService
  let permissionService: PermissionService
  let testTenant: Tenant
  let adminUser: User
  let customerUser: User
  let adminToken: string
  let customerToken: string

  group.each.setup(() => testUtils.db().truncate())

  group.setup(async () => {
    permissionService = new PermissionService()
    roleService = new RoleService(permissionService)

    // Create test tenant
    testTenant = await Tenant.create({
      name: 'Permission Test Store',
      slug: 'permission-test-store',
      status: 'active',
    })

    // Create default roles and permissions
    await roleService.createDefaultRoles(testTenant.id)

    // Create admin user
    adminUser = await User.create({
      email: 'admin@permissions.com',
      password: 'password123',
      status: 'active',
    })

    await adminUser.related('profile').create({
      firstName: 'Admin',
      lastName: 'User',
    })

    await adminUser.related('tenants').attach([testTenant.id])
    await roleService.assignRole(adminUser, 'admin', testTenant.id)

    // Create customer user
    customerUser = await User.create({
      email: 'customer@permissions.com',
      password: 'password123',
      status: 'active',
    })

    await customerUser.related('profile').create({
      firstName: 'Customer',
      lastName: 'User',
    })

    await customerUser.related('tenants').attach([testTenant.id])
    await roleService.assignRole(customerUser, 'customer', testTenant.id)

    // Generate tokens
    const app = await import('@adonisjs/core/services/app')
    const ctx = app.default.container.make('HttpContext')
    
    const adminTokenObj = await ctx.auth.use('jwt').generate(adminUser)
    const customerTokenObj = await ctx.auth.use('jwt').generate(customerUser)
    
    adminToken = adminTokenObj.token
    customerToken = customerTokenObj.token
  })

  test('should validate action:resource permission format', async ({ assert }) => {
    const permissions = await Permission.query().where('tenant_id', testTenant.id)
    
    permissions.forEach(permission => {
      // Verify action:resource format
      const parts = permission.name.split(':')
      assert.lengthOf(parts, 2, `Permission ${permission.name} should have action:resource format`)
      assert.equal(parts[0], permission.action)
      assert.equal(parts[1], permission.resource)
      
      // Verify fullName getter
      assert.equal(permission.fullName, `${permission.action}:${permission.resource}`)
    })
  })

  test('should handle wildcard permission matching correctly', async ({ assert }) => {
    const readProductPermission = await Permission.findByName('read:product', testTenant.id)
    assert.isNotNull(readProductPermission)

    // Test exact match
    assert.isTrue(readProductPermission!.matches('read:product'))
    
    // Test wildcard matches
    assert.isTrue(readProductPermission!.matches('read:*'))
    assert.isTrue(readProductPermission!.matches('*:product'))
    assert.isTrue(readProductPermission!.matches('*:*'))
    
    // Test non-matches
    assert.isFalse(readProductPermission!.matches('write:product'))
    assert.isFalse(readProductPermission!.matches('read:user'))
    assert.isFalse(readProductPermission!.matches('manage:order'))
  })

  test('should enforce permission-based access via middleware', async ({ client }) => {
    // Admin should be able to access role management (has manage:role)
    const adminResponse = await client
      .get('/api/rbac/roles')
      .header('Authorization', `Bearer ${adminToken}`)
      .header('X-Tenant-Slug', testTenant.slug)

    adminResponse.assertStatus(200)

    // Customer should not be able to access role management (no manage:role)
    const customerResponse = await client
      .get('/api/rbac/roles')
      .header('Authorization', `Bearer ${customerToken}`)
      .header('X-Tenant-Slug', testTenant.slug)

    customerResponse.assertStatus(403)
  })

  test('should validate user permission checking via service', async ({ assert }) => {
    // Admin should have manage:user permission
    const adminCanManageUsers = await permissionService.hasPermission(
      adminUser, 
      'manage:user', 
      testTenant.id
    )
    assert.isTrue(adminCanManageUsers)

    // Customer should not have manage:user permission
    const customerCanManageUsers = await permissionService.hasPermission(
      customerUser, 
      'manage:user', 
      testTenant.id
    )
    assert.isFalse(customerCanManageUsers)

    // Customer should have read:product permission
    const customerCanReadProducts = await permissionService.hasPermission(
      customerUser, 
      'read:product', 
      testTenant.id
    )
    assert.isTrue(customerCanReadProducts)
  })

  test('should handle bulk permission operations correctly', async ({ client, assert }) => {
    const bulkData = {
      resource: 'test_bulk_resource',
      actions: ['create', 'read', 'update', 'delete', 'manage'],
    }

    const response = await client
      .post('/api/rbac/permissions/bulk')
      .header('Authorization', `Bearer ${adminToken}`)
      .header('X-Tenant-Slug', testTenant.slug)
      .json(bulkData)

    response.assertStatus(201)
    const body = response.body()
    
    assert.isArray(body.data)
    assert.lengthOf(body.data, 5)

    // Verify all permissions follow correct naming
    const expectedNames = bulkData.actions.map(action => `${action}:${bulkData.resource}`)
    const actualNames = body.data.map((perm: any) => perm.name)
    
    expectedNames.forEach(name => {
      assert.include(actualNames, name)
    })
  })

  test('should filter permissions by resource correctly', async ({ client, assert }) => {
    const response = await client
      .get('/api/rbac/permissions')
      .qs({ resource: 'user' })
      .header('Authorization', `Bearer ${adminToken}`)
      .header('X-Tenant-Slug', testTenant.slug)

    response.assertStatus(200)
    const body = response.body()
    
    assert.isArray(body.data)
    assert.isAtLeast(body.data.length, 5) // Should have at least 5 user permissions

    // All returned permissions should be for 'user' resource
    body.data.forEach((permission: any) => {
      assert.equal(permission.resource, 'user')
    })
  })

  test('should validate tenant isolation for permissions', async ({ assert }) => {
    // Create second tenant
    const secondTenant = await Tenant.create({
      name: 'Second Test Store',
      slug: 'second-test-store',
      status: 'active',
    })

    // Create permissions for second tenant
    await permissionService.createEcommercePermissions(secondTenant.id)

    // Get permissions for first tenant
    const firstTenantPermissions = await permissionService.getPermissionsByTenant(testTenant.id)
    
    // Get permissions for second tenant
    const secondTenantPermissions = await permissionService.getPermissionsByTenant(secondTenant.id)

    // Should have similar number of permissions but different IDs
    assert.approximately(firstTenantPermissions.length, secondTenantPermissions.length, 5)

    // Verify no permission IDs overlap
    const firstTenantIds = firstTenantPermissions.map(p => p.id)
    const secondTenantIds = secondTenantPermissions.map(p => p.id)
    
    const intersection = firstTenantIds.filter(id => secondTenantIds.includes(id))
    assert.lengthOf(intersection, 0, 'Permission IDs should not overlap between tenants')
  })
})