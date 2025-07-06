// tests/functional/rbac.spec.ts - Updated for Unified RBAC Module

import { test } from '@japa/runner'
import User from '#modules/user/models/user'
import Role from '#modules/rbac/models/role'
import Permission from '#modules/rbac/models/permission'
import Tenant from '#modules/tenant/models/tenant'
import RoleService from '#modules/rbac/services/role_service'
import PermissionService from '#modules/rbac/services/permission_service'
import testUtils from '@adonisjs/core/services/test_utils'

test.group('RBAC - Unified Controller Tests', (group) => {
  let roleService: RoleService
  let permissionService: PermissionService
  let testTenant: Tenant
  let users: { [key: string]: User } = {}
  let tokens: { [key: string]: string } = {}

  group.each.setup(() => testUtils.db().truncate())

  group.setup(async () => {
    roleService = new RoleService(new PermissionService())
    permissionService = new PermissionService()

    // Create test tenant
    testTenant = await Tenant.create({
      name: 'Test Store',
      slug: 'test-store',
      domain: 'test-store.com',
      status: 'active',
    })

    // Create default roles and permissions
    await roleService.createDefaultRoles(testTenant.id)

    // Create test users for each role
    const userRoles = ['super_admin', 'admin', 'manager', 'staff', 'customer']

    for (const roleName of userRoles) {
      // Create user
      const user = await User.create({
        email: `${roleName}@test.com`,
        password: 'password123',
        status: 'active',
      })

      // Create profile
      await user.related('profile').create({
        firstName: roleName.charAt(0).toUpperCase() + roleName.slice(1),
        lastName: 'User',
        preferredLanguage: 'en',
      })

      // Associate with tenant
      await user.related('tenants').attach([testTenant.id])

      // Assign role
      const role = await Role.findByName(roleName, testTenant.id)
      if (role) {
        await roleService.assignRole(user, roleName, testTenant.id)
      }

      users[roleName] = user
    }

    // Generate auth tokens for each user
    const app = await import('@adonisjs/core/services/app')
    const ctx = app.default.container.make('HttpContext')

    for (const [roleName, user] of Object.entries(users)) {
      const token = await ctx.auth.use('jwt').generate(user)
      tokens[roleName] = token.token
    }
  })

  // ================================================================================================
  // ROLE MANAGEMENT TESTS
  // ================================================================================================

  test('should list roles for admin users', async ({ client, assert }) => {
    const response = await client
      .get('/api/rbac/roles')
      .header('Authorization', `Bearer ${tokens.admin}`)
      .header('X-Tenant-Slug', testTenant.slug)

    response.assertStatus(200)
    response.assertBodyContains({
      success: true,
    })

    const body = response.body()
    assert.isArray(body.data)
    assert.isAtLeast(body.data.length, 5) // Should have at least 5 default roles
  })

  test('should create new role as admin', async ({ client, assert }) => {
    const roleData = {
      name: 'test_role',
      displayName: 'Test Role',
    }

    const response = await client
      .post('/api/rbac/roles')
      .header('Authorization', `Bearer ${tokens.admin}`)
      .header('X-Tenant-Slug', testTenant.slug)
      .json(roleData)

    response.assertStatus(201)
    response.assertBodyContains({
      success: true,
      message: 'Role created successfully',
    })

    const body = response.body()
    assert.equal(body.data.name, roleData.name)
    assert.equal(body.data.displayName, roleData.displayName)
  })

  test('should assign roles to user as admin', async ({ client, assert }) => {
    // Get manager role
    const managerRole = await Role.findByName('manager', testTenant.id)
    assert.isNotNull(managerRole)

    const assignData = {
      roleIds: [managerRole!.id],
      tenantId: testTenant.id,
    }

    const response = await client
      .post(`/api/rbac/users/${users.customer.id}/roles`)
      .header('Authorization', `Bearer ${tokens.admin}`)
      .header('X-Tenant-Slug', testTenant.slug)
      .json(assignData)

    response.assertStatus(200)
    response.assertBodyContains({
      success: true,
      message: 'Roles assigned successfully',
    })

    // Verify role assignment
    const userRoles = await roleService.getUserRoles(users.customer, testTenant.id)
    assert.isTrue(userRoles.some((role) => role.name === 'manager'))
  })

  test('should deny role creation for non-admin users', async ({ client }) => {
    const roleData = {
      name: 'unauthorized_role',
      displayName: 'Unauthorized Role',
    }

    const response = await client
      .post('/api/rbac/roles')
      .header('Authorization', `Bearer ${tokens.customer}`)
      .header('X-Tenant-Slug', testTenant.slug)
      .json(roleData)

    response.assertStatus(403)
  })

  // ================================================================================================
  // PERMISSION MANAGEMENT TESTS
  // ================================================================================================

  test('should list permissions for authorized users', async ({ client, assert }) => {
    const response = await client
      .get('/api/rbac/permissions')
      .header('Authorization', `Bearer ${tokens.admin}`)
      .header('X-Tenant-Slug', testTenant.slug)

    response.assertStatus(200)
    response.assertBodyContains({
      success: true,
    })

    const body = response.body()
    assert.isArray(body.data)
    assert.isAtLeast(body.data.length, 50) // Should have many default permissions
  })

  test('should get permissions grouped by resource', async ({ client, assert }) => {
    const response = await client
      .get('/api/rbac/permissions/grouped')
      .header('Authorization', `Bearer ${tokens.admin}`)
      .header('X-Tenant-Slug', testTenant.slug)

    response.assertStatus(200)
    response.assertBodyContains({
      success: true,
    })

    const body = response.body()
    assert.isObject(body.data)
    assert.property(body.data, 'user')
    assert.property(body.data, 'product')
    assert.property(body.data, 'order')
  })

  test('should filter permissions by resource', async ({ client, assert }) => {
    const response = await client
      .get('/api/rbac/permissions')
      .qs({ resource: 'product' })
      .header('Authorization', `Bearer ${tokens.admin}`)
      .header('X-Tenant-Slug', testTenant.slug)

    response.assertStatus(200)
    const body = response.body()
    assert.isArray(body.data)

    // All permissions should be for 'product' resource
    body.data.forEach((permission: any) => {
      assert.equal(permission.resource, 'product')
    })
  })

  test('should create new permission as super admin', async ({ client, assert }) => {
    const permissionData = {
      resource: 'test_resource',
      action: 'test_action',
      description: 'Test permission for testing',
    }

    const response = await client
      .post('/api/rbac/permissions')
      .header('Authorization', `Bearer ${tokens.super_admin}`)
      .header('X-Tenant-Slug', testTenant.slug)
      .json(permissionData)

    response.assertStatus(201)
    response.assertBodyContains({
      success: true,
      message: 'Permission created successfully',
    })

    const body = response.body()
    assert.equal(body.data.resource, permissionData.resource)
    assert.equal(body.data.action, permissionData.action)
    assert.equal(body.data.name, `${permissionData.action}:${permissionData.resource}`)
  })

  test('should create bulk permissions for a resource', async ({ client, assert }) => {
    const bulkData = {
      resource: 'test_bulk_resource',
      actions: ['create', 'read', 'update', 'delete'],
    }

    const response = await client
      .post('/api/rbac/permissions/bulk')
      .header('Authorization', `Bearer ${tokens.super_admin}`)
      .header('X-Tenant-Slug', testTenant.slug)
      .json(bulkData)

    response.assertStatus(201)
    response.assertBodyContains({
      success: true,
      message: 'Resource permissions created successfully',
    })

    const body = response.body()
    assert.isArray(body.data)
    assert.lengthOf(body.data, 4)

    // Verify all permissions were created with correct naming
    const expectedNames = bulkData.actions.map((action) => `${action}:${bulkData.resource}`)
    const actualNames = body.data.map((perm: any) => perm.name)
    expectedNames.forEach((name) => {
      assert.include(actualNames, name)
    })
  })

  test('should deny permission creation for non-super-admin users', async ({ client }) => {
    const permissionData = {
      resource: 'unauthorized_resource',
      action: 'unauthorized_action',
    }

    const response = await client
      .post('/api/rbac/permissions')
      .header('Authorization', `Bearer ${tokens.admin}`) // Admin but not super admin
      .header('X-Tenant-Slug', testTenant.slug)
      .json(permissionData)

    response.assertStatus(403)
  })

  // ================================================================================================
  // ROLE-PERMISSION MANAGEMENT TESTS
  // ================================================================================================

  test('should get permissions for a role', async ({ client, assert }) => {
    const adminRole = await Role.findByName('admin', testTenant.id)
    assert.isNotNull(adminRole)

    const response = await client
      .get(`/api/rbac/roles/${adminRole!.id}/permissions`)
      .header('Authorization', `Bearer ${tokens.admin}`)
      .header('X-Tenant-Slug', testTenant.slug)

    response.assertStatus(200)
    response.assertBodyContains({
      success: true,
    })

    const body = response.body()
    assert.isArray(body.data)
    assert.isAtLeast(body.data.length, 10) // Admin should have many permissions
  })

  test('should assign permissions to role as super admin', async ({ client, assert }) => {
    // Create a test role first
    const testRole = await Role.create({
      name: 'test_role_permissions',
      displayName: 'Test Role for Permissions',
      tenantId: testTenant.id,
    })

    // Get some permissions to assign
    const permissions = await Permission.getByResource('user', testTenant.id)
    const permissionIds = permissions.slice(0, 3).map((p) => p.id)

    const response = await client
      .post(`/api/rbac/roles/${testRole.id}/permissions`)
      .header('Authorization', `Bearer ${tokens.super_admin}`)
      .header('X-Tenant-Slug', testTenant.slug)
      .json({ permissionIds })

    response.assertStatus(200)
    response.assertBodyContains({
      success: true,
      message: 'Permissions assigned to role successfully',
    })

    // Verify permissions were assigned
    const rolePermissions = await permissionService.getRolePermissions(testRole.id, testTenant.id)
    assert.lengthOf(rolePermissions, 3)
  })

  // ================================================================================================
  // USER PERMISSION UTILITY TESTS
  // ================================================================================================

  test('should get user permissions', async ({ client, assert }) => {
    const response = await client
      .get(`/api/rbac/users/${users.admin.id}/permissions`)
      .header('Authorization', `Bearer ${tokens.admin}`)
      .header('X-Tenant-Slug', testTenant.slug)

    response.assertStatus(200)
    response.assertBodyContains({
      success: true,
    })

    const body = response.body()
    assert.isArray(body.data)
    assert.isAtLeast(body.data.length, 10) // Admin should have many permissions
  })

  test('should check if user has specific permission', async ({ client, assert }) => {
    const response = await client
      .post(`/api/rbac/users/${users.admin.id}/check-permission`)
      .header('Authorization', `Bearer ${tokens.admin}`)
      .header('X-Tenant-Slug', testTenant.slug)
      .json({ permission: 'manage:user' })

    response.assertStatus(200)
    response.assertBodyContains({
      success: true,
    })

    const body = response.body()
    assert.isTrue(body.data.hasPermission) // Admin should have manage:user permission
  })

  test('should return false for permission user does not have', async ({ client, assert }) => {
    const response = await client
      .post(`/api/rbac/users/${users.customer.id}/check-permission`)
      .header('Authorization', `Bearer ${tokens.admin}`)
      .header('X-Tenant-Slug', testTenant.slug)
      .json({ permission: 'manage:*' })

    response.assertStatus(200)
    const body = response.body()
    assert.isFalse(body.data.hasPermission) // Customer should not have manage:* permission
  })

  // ================================================================================================
  // MIDDLEWARE INTEGRATION TESTS
  // ================================================================================================

  test('should allow access with correct permissions', async ({ client }) => {
    // Admin should be able to access role listing (has manage:role permission)
    const response = await client
      .get('/api/rbac/roles')
      .header('Authorization', `Bearer ${tokens.admin}`)
      .header('X-Tenant-Slug', testTenant.slug)

    response.assertStatus(200)
  })

  test('should deny access without correct permissions', async ({ client }) => {
    // Customer should not be able to create permissions (no manage:permission)
    const response = await client
      .post('/api/rbac/permissions')
      .header('Authorization', `Bearer ${tokens.customer}`)
      .header('X-Tenant-Slug', testTenant.slug)
      .json({ resource: 'test', action: 'test' })

    response.assertStatus(403)
  })
})
