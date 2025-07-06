// ================================================================================================
// SIMPLE RBAC TEST TO VALIDATE UNIFIED SETUP
// ================================================================================================

import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import User from '#modules/user/models/user'
import Role from '#modules/rbac/models/role'
import Permission from '#modules/rbac/models/permission'
import Tenant from '#modules/tenant/models/tenant'
import RoleService from '#modules/rbac/services/role_service'
import PermissionService from '#modules/rbac/services/permission_service'

test.group('Simple RBAC Test - Unified Module', (group) => {
  group.each.setup(() => testUtils.db().truncate())

  test('should create and assign roles correctly with permissions', async ({ assert }) => {
    const permissionService = new PermissionService()
    const roleService = new RoleService(permissionService)

    // Create tenant
    const tenant = await Tenant.create({
      name: 'Test Store',
      slug: 'test-store',
      status: 'active',
    })

    // Create default roles and permissions
    await roleService.createDefaultRoles(tenant.id)

    // Verify roles were created
    const roles = await Role.query().where('tenant_id', tenant.id)
    assert.isAtLeast(roles.length, 5) // Should have 5 default roles

    // Verify permissions were created
    const permissions = await Permission.query().where('tenant_id', tenant.id)
    assert.isAtLeast(permissions.length, 50) // Should have many default permissions

    // Create user
    const user = await User.create({
      email: 'test@example.com',
      password: 'password123',
      status: 'active',
    })

    // Assign customer role
    await roleService.assignRole(user, 'customer', tenant.id)

    // Verify role assignment
    const userRoles = await roleService.getUserRoles(user, tenant.id)
    assert.lengthOf(userRoles, 1)
    assert.equal(userRoles[0].name, 'customer')

    // Test permission-based access (not role-based)
    const canReadProducts = await roleService.canAccessResource(user, 'product', 'read', tenant.id)
    assert.isTrue(canReadProducts) // Customer should be able to read products

    const canManageUsers = await roleService.canAccessResource(user, 'user', 'manage', tenant.id)
    assert.isFalse(canManageUsers) // Customer should not be able to manage users
  })

  test('should list roles via unified API', async ({ client, assert }) => {
    const permissionService = new PermissionService()
    const roleService = new RoleService(permissionService)

    // Create tenant
    const tenant = await Tenant.create({
      name: 'API Test Store',
      slug: 'api-test-store',
      status: 'active',
    })

    // Create admin user
    const user = await User.create({
      email: 'admin@test.com',
      password: 'password123',
      status: 'active',
    })

    await user.related('profile').create({
      firstName: 'Admin',
      lastName: 'User',
    })

    // Associate user with tenant
    await user.related('tenants').attach([tenant.id])

    // Create default roles and permissions
    await roleService.createDefaultRoles(tenant.id)

    // Assign admin role to user
    await roleService.assignRole(user, 'admin', tenant.id)

    // Login
    const loginResponse = await client
      .post('/api/auth/login')
      .headers({ 'X-Tenant-Slug': tenant.slug })
      .json({
        email: 'admin@test.com',
        password: 'password123',
      })

    loginResponse.assertStatus(200)
    const token = loginResponse.body().data.token.accessToken

    // List roles via unified RBAC API
    const rolesResponse = await client.get('/api/rbac/roles').headers({
      'Authorization': `Bearer ${token}`,
      'X-Tenant-Slug': tenant.slug,
    })

    rolesResponse.assertStatus(200)
    assert.equal(rolesResponse.body().success, true)
    assert.isArray(rolesResponse.body().data)
    assert.isAtLeast(rolesResponse.body().data.length, 5) // Should have 5 default roles
  })

  test('should list permissions via unified API', async ({ client, assert }) => {
    const permissionService = new PermissionService()
    const roleService = new RoleService(permissionService)

    // Create tenant
    const tenant = await Tenant.create({
      name: 'Permission Test Store',
      slug: 'permission-test-store',
      status: 'active',
    })

    // Create admin user
    const user = await User.create({
      email: 'admin@permissions.com',
      password: 'password123',
      status: 'active',
    })

    await user.related('profile').create({
      firstName: 'Permission',
      lastName: 'Admin',
    })

    // Associate user with tenant
    await user.related('tenants').attach([tenant.id])

    // Create default roles and permissions
    await roleService.createDefaultRoles(tenant.id)

    // Assign admin role to user
    await roleService.assignRole(user, 'admin', tenant.id)

    // Login
    const loginResponse = await client
      .post('/api/auth/login')
      .headers({ 'X-Tenant-Slug': tenant.slug })
      .json({
        email: 'admin@permissions.com',
        password: 'password123',
      })

    loginResponse.assertStatus(200)
    const token = loginResponse.body().data.token.accessToken

    // List permissions via unified RBAC API
    const permissionsResponse = await client.get('/api/rbac/permissions').headers({
      'Authorization': `Bearer ${token}`,
      'X-Tenant-Slug': tenant.slug,
    })

    permissionsResponse.assertStatus(200)
    assert.equal(permissionsResponse.body().success, true)
    assert.isArray(permissionsResponse.body().data)
    assert.isAtLeast(permissionsResponse.body().data.length, 50) // Should have many permissions

    // Test filtering permissions by resource
    const productPermissionsResponse = await client
      .get('/api/rbac/permissions')
      .qs({ resource: 'product' })
      .headers({
        'Authorization': `Bearer ${token}`,
        'X-Tenant-Slug': tenant.slug,
      })

    productPermissionsResponse.assertStatus(200)
    const productPermissions = productPermissionsResponse.body().data
    assert.isArray(productPermissions)
    assert.isAtLeast(productPermissions.length, 5) // Should have at least 5 product permissions

    // All permissions should be for 'product' resource
    productPermissions.forEach((permission: any) => {
      assert.equal(permission.resource, 'product')
    })
  })

  test('should handle role assignment via unified API', async ({ client, assert }) => {
    const permissionService = new PermissionService()
    const roleService = new RoleService(permissionService)

    // Create tenant
    const tenant = await Tenant.create({
      name: 'Assignment Test Store',
      slug: 'assignment-test-store',
      status: 'active',
    })

    // Create admin user
    const adminUser = await User.create({
      email: 'admin@assignment.com',
      password: 'password123',
      status: 'active',
    })

    await adminUser.related('profile').create({
      firstName: 'Assignment',
      lastName: 'Admin',
    })

    // Create regular user
    const regularUser = await User.create({
      email: 'user@assignment.com',
      password: 'password123',
      status: 'active',
    })

    await regularUser.related('profile').create({
      firstName: 'Regular',
      lastName: 'User',
    })

    // Associate users with tenant
    await adminUser.related('tenants').attach([tenant.id])
    await regularUser.related('tenants').attach([tenant.id])

    // Create default roles and permissions
    await roleService.createDefaultRoles(tenant.id)

    // Assign admin role to admin user
    await roleService.assignRole(adminUser, 'admin', tenant.id)

    // Login as admin
    const loginResponse = await client
      .post('/api/auth/login')
      .headers({ 'X-Tenant-Slug': tenant.slug })
      .json({
        email: 'admin@assignment.com',
        password: 'password123',
      })

    loginResponse.assertStatus(200)
    const token = loginResponse.body().data.token.accessToken

    // Get manager role ID
    const managerRole = await Role.findByName('manager', tenant.id)
    assert.isNotNull(managerRole)

    // Assign manager role to regular user via API
    const assignResponse = await client
      .post(`/api/rbac/users/${regularUser.id}/roles`)
      .headers({
        'Authorization': `Bearer ${token}`,
        'X-Tenant-Slug': tenant.slug,
      })
      .json({
        roleIds: [managerRole!.id],
        tenantId: tenant.id,
      })

    assignResponse.assertStatus(200)
    assert.equal(assignResponse.body().success, true)
    assert.equal(assignResponse.body().message, 'Roles assigned successfully')

    // Verify role assignment
    const userRoles = await roleService.getUserRoles(regularUser, tenant.id)
    assert.isTrue(userRoles.some((role) => role.name === 'manager'))
  })

  test('should validate permission format consistency', async ({ assert }) => {
    const permissionService = new PermissionService()

    // Create tenant
    const tenant = await Tenant.create({
      name: 'Format Test Store',
      slug: 'format-test-store',
      status: 'active',
    })

    // Create default permissions
    await permissionService.createEcommercePermissions(tenant.id)

    // Verify all permissions follow action:resource format
    const permissions = await Permission.query().where('tenant_id', tenant.id)

    permissions.forEach((permission) => {
      // Check that name follows action:resource format
      const nameParts = permission.name.split(':')
      assert.lengthOf(
        nameParts,
        2,
        `Permission name ${permission.name} should follow action:resource format`
      )
      assert.equal(
        nameParts[0],
        permission.action,
        `Action mismatch in permission ${permission.name}`
      )
      assert.equal(
        nameParts[1],
        permission.resource,
        `Resource mismatch in permission ${permission.name}`
      )

      // Check that fullName getter works correctly
      assert.equal(
        permission.fullName,
        permission.name,
        `fullName getter should match name for ${permission.name}`
      )
    })

    // Test wildcard matching
    const readProductPermission = permissions.find((p) => p.name === 'read:product')
    assert.isNotNull(readProductPermission)

    // Should match exact permission
    assert.isTrue(readProductPermission!.matches('read:product'))

    // Should match wildcard patterns
    assert.isTrue(readProductPermission!.matches('read:*'))
    assert.isTrue(readProductPermission!.matches('*:product'))
    assert.isTrue(readProductPermission!.matches('*:*'))

    // Should not match different permissions
    assert.isFalse(readProductPermission!.matches('write:product'))
    assert.isFalse(readProductPermission!.matches('read:user'))
  })
})
