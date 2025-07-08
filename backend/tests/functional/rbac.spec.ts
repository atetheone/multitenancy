// tests/functional/rbac.spec.ts - Updated for Unified RBAC Module

import { test } from '@japa/runner'
import User from '#modules/user/models/user'
import Role from '#modules/rbac/models/role'
import Permission from '#modules/rbac/models/permission'
import Tenant from '#modules/tenant/models/tenant'
import RoleService from '#modules/rbac/services/role_service'
import PermissionService from '#modules/rbac/services/permission_service'
import testUtils from '@adonisjs/core/services/test_utils'
import { loginAndGetToken } from '#shared/utils/test_helpers'

test.group('RBAC - Unified Controller Tests', (group) => {
  let roleService: RoleService
  let permissionService: PermissionService
  let testTenant: Tenant
  let users: { [key: string]: { user: User; email: string; password: string } } = {}

  group.each.setup(() => testUtils.db().truncate())

  group.setup(async () => {
    permissionService = new PermissionService()
    roleService = new RoleService(permissionService)

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
      const email = `${roleName}@test.com`
      const password = 'password123'

      // Create user
      const user = await User.create({
        email,
        password,
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

      users[roleName] = { user, email, password }
    }
  })

  // ================================================================================================
  // ROLE MANAGEMENT TESTS
  // ================================================================================================

  test('should list roles for admin users', async ({ client, assert }) => {
    // Login to get token
    const token = await loginAndGetToken(
      client,
      users.admin.email,
      users.admin.password,
      testTenant.slug
    )

    const response = await client
      .get('/api/rbac/roles')
      .header('Authorization', `Bearer ${token}`)
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
    // Login to get token
    const token = await loginAndGetToken(
      client,
      users.admin.email,
      users.admin.password,
      testTenant.slug
    )

    const roleData = {
      name: 'test_role',
      displayName: 'Test Role',
    }

    const response = await client
      .post('/api/rbac/roles')
      .header('Authorization', `Bearer ${token}`)
      .header('X-Tenant-Slug', testTenant.slug)
      .json(roleData)

    response.assertStatus(201)
    response.assertBodyContains({
      success: true,
    })

    const body = response.body()
    assert.equal(body.data.name, roleData.name)
    assert.equal(body.data.displayName, roleData.displayName)
  })

  test('should assign roles to user as admin', async ({ client, assert }) => {
    // Login to get token
    const token = await loginAndGetToken(
      client,
      users.admin.email,
      users.admin.password,
      testTenant.slug
    )

    // Get manager role
    const managerRole = await Role.findByName('manager', testTenant.id)
    assert.isNotNull(managerRole)

    const assignData = {
      roleIds: [managerRole!.id],
      tenantId: testTenant.id,
    }

    const response = await client
      .post(`/api/rbac/users/${users.customer.user.id}/roles`)
      .header('Authorization', `Bearer ${token}`)
      .header('X-Tenant-Slug', testTenant.slug)
      .json(assignData)

    response.assertStatus(200)
    response.assertBodyContains({
      success: true,
    })

    // Verify role assignment
    const userRoles = await roleService.getUserRoles(users.customer.user, testTenant.id)
    assert.isTrue(userRoles.some((role) => role.name === 'manager'))
  })

  // ================================================================================================
  // PERMISSION MANAGEMENT TESTS
  // ================================================================================================

  test('should list permissions for admin users', async ({ client, assert }) => {
    // Login to get token
    const token = await loginAndGetToken(
      client,
      users.admin.email,
      users.admin.password,
      testTenant.slug
    )

    const response = await client
      .get('/api/rbac/permissions')
      .header('Authorization', `Bearer ${token}`)
      .header('X-Tenant-Slug', testTenant.slug)

    response.assertStatus(200)
    response.assertBodyContains({
      success: true,
    })

    const body = response.body()
    assert.isArray(body.data)
    assert.isAtLeast(body.data.length, 10) // Should have many default permissions
  })

  test('should create new permission as admin', async ({ client, assert }) => {
    // Login to get token
    const token = await loginAndGetToken(
      client,
      users.admin.email,
      users.admin.password,
      testTenant.slug
    )

    const permissionData = {
      resource: 'test_resource',
      action: 'test_action',
      description: 'Test permission for testing',
    }

    const response = await client
      .post('/api/rbac/permissions')
      .header('Authorization', `Bearer ${token}`)
      .header('X-Tenant-Slug', testTenant.slug)
      .json(permissionData)

    response.assertStatus(201)
    response.assertBodyContains({
      success: true,
    })

    const body = response.body()
    assert.equal(body.data.resource, permissionData.resource)
    assert.equal(body.data.action, permissionData.action)
  })

  test('should assign permissions to role as admin', async ({ client, assert }) => {
    // Login to get token
    const token = await loginAndGetToken(
      client,
      users.admin.email,
      users.admin.password,
      testTenant.slug
    )

    // First create a test permission
    const permission = await Permission.create({
      name: 'test:read',
      resource: 'test',
      action: 'read',
      description: 'Test read permission',
      tenantId: testTenant.id,
    })

    // Get staff role
    const staffRole = await Role.findByName('staff', testTenant.id)
    assert.isNotNull(staffRole)

    const assignData = {
      permissionIds: [permission.id],
    }

    const response = await client
      .post(`/api/rbac/roles/${staffRole!.id}/permissions`)
      .header('Authorization', `Bearer ${token}`)
      .header('X-Tenant-Slug', testTenant.slug)
      .json(assignData)

    response.assertStatus(200)
    response.assertBodyContains({
      success: true,
    })

    // Verify permission assignment
    await staffRole!.load('permissions')
    assert.isTrue(staffRole!.permissions.some((perm) => perm.id === permission.id))
  })

  // ================================================================================================
  // ACCESS CONTROL TESTS
  // ================================================================================================

  test('should deny role creation for non-admin users', async ({ client }) => {
    // Login as staff user
    const token = await loginAndGetToken(
      client,
      users.staff.email,
      users.staff.password,
      testTenant.slug
    )

    const roleData = {
      name: 'unauthorized_role',
      displayName: 'Unauthorized Role',
    }

    const response = await client
      .post('/api/rbac/roles')
      .header('Authorization', `Bearer ${token}`)
      .header('X-Tenant-Slug', testTenant.slug)
      .json(roleData)

    response.assertStatus(403) // Should be forbidden
  })

  test('should deny permission creation for non-admin users', async ({ client }) => {
    // Login as manager user
    const token = await loginAndGetToken(
      client,
      users.manager.email,
      users.manager.password,
      testTenant.slug
    )

    const permissionData = {
      resource: 'unauthorized_resource',
      action: 'unauthorized_action',
      description: 'Unauthorized permission',
    }

    const response = await client
      .post('/api/rbac/permissions')
      .header('Authorization', `Bearer ${token}`)
      .header('X-Tenant-Slug', testTenant.slug)
      .json(permissionData)

    response.assertStatus(403) // Should be forbidden
  })

  test('should allow managers to view roles but not create them', async ({ client, assert }) => {
    // Login as manager user
    const token = await loginAndGetToken(
      client,
      users.manager.email,
      users.manager.password,
      testTenant.slug
    )

    // Should be able to list roles
    const listResponse = await client
      .get('/api/rbac/roles')
      .header('Authorization', `Bearer ${token}`)
      .header('X-Tenant-Slug', testTenant.slug)

    listResponse.assertStatus(200)
    assert.isArray(listResponse.body().data)

    // Should NOT be able to create roles
    const createResponse = await client
      .post('/api/rbac/roles')
      .header('Authorization', `Bearer ${token}`)
      .header('X-Tenant-Slug', testTenant.slug)
      .json({
        name: 'manager_created_role',
        displayName: 'Manager Created Role',
      })

    createResponse.assertStatus(403) // Should be forbidden
  })
})
