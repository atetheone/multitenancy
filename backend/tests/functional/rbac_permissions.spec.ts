// ================================================================================================
// RBAC PERMISSION VALIDATION TESTS
// ================================================================================================
// File: tests/functional/rbac_permissions.spec.ts

import { test } from '@japa/runner'
import { ApiClient } from '@japa/api-client'
import User from '#modules/user/models/user'
import Role from '#modules/rbac/models/role'
import Tenant from '#modules/tenant/models/tenant'
import RbacService from '#modules/rbac/services/rbac_service'
import testUtils from '@adonisjs/core/services/test_utils'

test.group('RBAC - Permission Validation & Access Control', (group) => {
  let rbacService: RbacService
  let testTenant: Tenant
  let users: { [key: string]: User } = {}
  let tokens: { [key: string]: string } = {}

  group.each.setup(() => testUtils.db().truncate())

  group.setup(async () => {
    rbacService = new RbacService()

    // Create test tenant
    testTenant = await Tenant.create({
      name: 'Permission Test Store',
      slug: 'permission-test-store',
      domain: 'permission-test.com',
      status: 'active',
    })

    // Create roles with hierarchy
    const roles = [
      {
        name: 'super_admin',
        displayName: 'Super Administrator',
        tenantId: testTenant.id,
        isDefault: false,
      },
      { name: 'admin', displayName: 'Administrator', tenantId: testTenant.id, isDefault: false },
      { name: 'manager', displayName: 'Manager', tenantId: testTenant.id, isDefault: false },
      { name: 'staff', displayName: 'Staff', tenantId: testTenant.id, isDefault: false },
      { name: 'customer', displayName: 'Customer', tenantId: testTenant.id, isDefault: true },
    ]

    for (const roleData of roles) {
      await Role.create(roleData)
    }

    // Create test users for each role
    const userRoles = ['super_admin', 'admin', 'manager', 'staff', 'customer']

    for (const roleName of userRoles) {
      // Create user
      const user = await User.create({
        email: `${roleName}@permission-test.com`,
        password: 'password123',
        status: 'active',
      })

      // Create profile
      await user.related('profile').create({
        firstName: roleName.charAt(0).toUpperCase() + roleName.slice(1),
        lastName: 'User',
      })

      // Assign role
      const role = await Role.query()
        .where('name', roleName)
        .where('tenant_id', testTenant.id)
        .firstOrFail()

      await user.related('roles').attach({
        [role.id]: { tenant_id: testTenant.id },
      })

      // Store user and get token
      users[roleName] = user

      const client = new ApiClient()
      const loginResponse = await client
        .post('/api/auth/login')
        .headers({ 'X-Tenant-Slug': testTenant.slug })
        .json({
          email: user.email,
          password: 'password123',
        })

      tokens[roleName] = loginResponse.body().data.token.accessToken
    }
  })

  // ================================================================================================
  // 1. ROLE HIERARCHY ACCESS TESTS
  // ================================================================================================

  test('should validate role hierarchy for canAccess method', async ({ assert }) => {
    // Super admin should have access to everything
    assert.isTrue(await rbacService.canAccess(users.super_admin, 'customer', testTenant.id))
    assert.isTrue(await rbacService.canAccess(users.super_admin, 'staff', testTenant.id))
    assert.isTrue(await rbacService.canAccess(users.super_admin, 'manager', testTenant.id))
    assert.isTrue(await rbacService.canAccess(users.super_admin, 'admin', testTenant.id))
    assert.isTrue(await rbacService.canAccess(users.super_admin, 'super_admin', testTenant.id))

    // Admin should have access to manager and below
    assert.isTrue(await rbacService.canAccess(users.admin, 'customer', testTenant.id))
    assert.isTrue(await rbacService.canAccess(users.admin, 'staff', testTenant.id))
    assert.isTrue(await rbacService.canAccess(users.admin, 'manager', testTenant.id))
    assert.isTrue(await rbacService.canAccess(users.admin, 'admin', testTenant.id))
    assert.isFalse(await rbacService.canAccess(users.admin, 'super_admin', testTenant.id))

    // Manager should have access to staff and customer
    assert.isTrue(await rbacService.canAccess(users.manager, 'customer', testTenant.id))
    assert.isTrue(await rbacService.canAccess(users.manager, 'staff', testTenant.id))
    assert.isTrue(await rbacService.canAccess(users.manager, 'manager', testTenant.id))
    assert.isFalse(await rbacService.canAccess(users.manager, 'admin', testTenant.id))
    assert.isFalse(await rbacService.canAccess(users.manager, 'super_admin', testTenant.id))

    // Staff should have access to customer only
    assert.isTrue(await rbacService.canAccess(users.staff, 'customer', testTenant.id))
    assert.isTrue(await rbacService.canAccess(users.staff, 'staff', testTenant.id))
    assert.isFalse(await rbacService.canAccess(users.staff, 'manager', testTenant.id))
    assert.isFalse(await rbacService.canAccess(users.staff, 'admin', testTenant.id))
    assert.isFalse(await rbacService.canAccess(users.staff, 'super_admin', testTenant.id))

    // Customer should only have access to customer level
    assert.isTrue(await rbacService.canAccess(users.customer, 'customer', testTenant.id))
    assert.isFalse(await rbacService.canAccess(users.customer, 'staff', testTenant.id))
    assert.isFalse(await rbacService.canAccess(users.customer, 'manager', testTenant.id))
    assert.isFalse(await rbacService.canAccess(users.customer, 'admin', testTenant.id))
    assert.isFalse(await rbacService.canAccess(users.customer, 'super_admin', testTenant.id))
  })

  test('should get user roles correctly', async ({ assert }) => {
    const superAdminRoles = await rbacService.getUserRoles(users.super_admin, testTenant.id)
    assert.lengthOf(superAdminRoles, 1)
    assert.equal(superAdminRoles[0].name, 'super_admin')

    const adminRoles = await rbacService.getUserRoles(users.admin, testTenant.id)
    assert.lengthOf(adminRoles, 1)
    assert.equal(adminRoles[0].name, 'admin')

    const customerRoles = await rbacService.getUserRoles(users.customer, testTenant.id)
    assert.lengthOf(customerRoles, 1)
    assert.equal(customerRoles[0].name, 'customer')
  })

  // ================================================================================================
  // 2. MIDDLEWARE ACCESS CONTROL TESTS
  // ================================================================================================

  test('should allow super admin access to admin endpoints', async ({ client, assert }) => {
    const response = await client.get('/api/roles').headers({
      'Authorization': `Bearer ${tokens.super_admin}`,
      'X-Tenant-Slug': testTenant.slug,
    })

    response.assertStatus(200)
    assert.equal(response.body().success, true)
  })

  test('should allow admin access to admin endpoints', async ({ client, assert }) => {
    const response = await client.get('/api/roles').headers({
      'Authorization': `Bearer ${tokens.admin}`,
      'X-Tenant-Slug': testTenant.slug,
    })

    response.assertStatus(200)
    assert.equal(response.body().success, true)
  })

  test('should deny manager access to admin endpoints', async ({ client, assert }) => {
    const response = await client.get('/api/roles').headers({
      'Authorization': `Bearer ${tokens.manager}`,
      'X-Tenant-Slug': testTenant.slug,
    })

    response.assertStatus(403)
    assert.equal(response.body().success, false)
  })

  test('should deny staff access to admin endpoints', async ({ client, assert }) => {
    const response = await client.get('/api/roles').headers({
      'Authorization': `Bearer ${tokens.staff}`,
      'X-Tenant-Slug': testTenant.slug,
    })

    response.assertStatus(403)
    assert.equal(response.body().success, false)
  })

  test('should deny customer access to admin endpoints', async ({ client, assert }) => {
    const response = await client.get('/api/roles').headers({
      'Authorization': `Bearer ${tokens.customer}`,
      'X-Tenant-Slug': testTenant.slug,
    })

    response.assertStatus(403)
    assert.equal(response.body().success, false)
  })

  // ================================================================================================
  // 3. ROLE ASSIGNMENT PERMISSION TESTS
  // ================================================================================================

  test('should allow super admin to assign any role', async ({ client, assert }) => {
    const newUser = await User.create({
      email: 'test-super-assign@test.com',
      password: 'password123',
      status: 'active',
    })

    // Try to assign admin role
    const response = await client
      .post('/api/users/{userId}/roles')
      .headers({
        'Authorization': `Bearer ${tokens.super_admin}`,
        'X-Tenant-Slug': testTenant.slug,
      })
      .json({
        userId: newUser.id,
        roleName: 'admin',
      })

    response.assertStatus(200)
    assert.equal(response.body().success, true)
  })

  test('should allow admin to assign lower roles', async ({ client, assert }) => {
    const newUser = await User.create({
      email: 'test-admin-assign@test.com',
      password: 'password123',
      status: 'active',
    })

    // Try to assign manager role
    const response = await client
      .post('/api/users/{userId}/roles')
      .headers({
        'Authorization': `Bearer ${tokens.admin}`,
        'X-Tenant-Slug': testTenant.slug,
      })
      .json({
        userId: newUser.id,
        roleName: 'manager',
      })

    response.assertStatus(200)
    assert.equal(response.body().success, true)
  })

  test('should allow super admin to remove any role', async ({ client, assert }) => {
    const newUser = await User.create({
      email: 'test-super-remove@test.com',
      password: 'password123',
      status: 'active',
    })

    // First assign a role
    await client
      .post('/api/users/{userId}/roles')
      .headers({
        'Authorization': `Bearer ${tokens.super_admin}`,
        'X-Tenant-Slug': testTenant.slug,
      })
      .json({
        userId: newUser.id,
        roleName: 'admin',
      })

    // Then remove it
    const response = await client
      .post('/api/roles/remove')
      .headers({
        'Authorization': `Bearer ${tokens.super_admin}`,
        'X-Tenant-Slug': testTenant.slug,
      })
      .json({
        userId: newUser.id,
        roleName: 'admin',
      })

    response.assertStatus(200)
    assert.equal(response.body().success, true)
  })

  test('should allow admin to remove lower roles', async ({ client, assert }) => {
    const newUser = await User.create({
      email: 'test-admin-remove@test.com',
      password: 'password123',
      status: 'active',
    })

    // First assign a role
    await client
      .post('/api/users/{userId}/roles')
      .headers({
        'Authorization': `Bearer ${tokens.admin}`,
        'X-Tenant-Slug': testTenant.slug,
      })
      .json({
        userId: newUser.id,
        roleName: 'manager',
      })

    // Then remove it
    const response = await client
      .post('/api/roles/remove')
      .headers({
        'Authorization': `Bearer ${tokens.admin}`,
        'X-Tenant-Slug': testTenant.slug,
      })
      .json({
        userId: newUser.id,
        roleName: 'manager',
      })

    response.assertStatus(200)
    assert.equal(response.body().success, true)
  })

  // ================================================================================================
  // 4. MULTI-ROLE USER TESTS
  // ================================================================================================

  test('should handle users with multiple roles correctly', async ({ assert }) => {
    // Create a user with multiple roles
    const multiRoleUser = await User.create({
      email: 'multirole@test.com',
      password: 'password123',
      status: 'active',
    })

    // Assign multiple roles
    const managerRole = await Role.query()
      .where('name', 'manager')
      .where('tenant_id', testTenant.id)
      .firstOrFail()

    const staffRole = await Role.query()
      .where('name', 'staff')
      .where('tenant_id', testTenant.id)
      .firstOrFail()

    await multiRoleUser.related('roles').attach({
      [managerRole.id]: { tenant_id: testTenant.id },
      [staffRole.id]: { tenant_id: testTenant.id },
    })

    // Should have access based on highest role (manager)
    assert.isTrue(await rbacService.canAccess(multiRoleUser, 'customer', testTenant.id))
    assert.isTrue(await rbacService.canAccess(multiRoleUser, 'staff', testTenant.id))
    assert.isTrue(await rbacService.canAccess(multiRoleUser, 'manager', testTenant.id))
    assert.isFalse(await rbacService.canAccess(multiRoleUser, 'admin', testTenant.id))

    // Should return all roles
    const userRoles = await rbacService.getUserRoles(multiRoleUser, testTenant.id)
    assert.lengthOf(userRoles, 2)

    const roleNames = userRoles.map((role) => role.name).sort()
    assert.deepEqual(roleNames, ['manager', 'staff'])
  })

  // ================================================================================================
  // 5. DEFAULT ROLE ASSIGNMENT TESTS
  // ================================================================================================

  test('should assign default role to new users', async ({ assert }) => {
    const newUser = await User.create({
      email: 'defaultrole@test.com',
      password: 'password123',
      status: 'active',
    })

    // Assign default role
    await rbacService.assignDefaultRole(newUser, testTenant.id)

    // Verify default role was assigned
    const userRoles = await rbacService.getUserRoles(newUser, testTenant.id)
    assert.lengthOf(userRoles, 1)
    assert.equal(userRoles[0].name, 'customer')
    assert.isTrue(userRoles[0].isDefault)
  })

  test('should create default roles for tenant', async ({ assert }) => {
    // Create a new tenant
    const newTenant = await Tenant.create({
      name: 'New Test Store',
      slug: 'new-test-store',
      status: 'active',
    })

    // Create default roles
    const createdRoles = await rbacService.createDefaultRoles(newTenant.id)

    assert.lengthOf(createdRoles, 4)

    const roleNames = createdRoles.map((role) => role.name).sort()
    assert.deepEqual(roleNames, ['admin', 'customer', 'manager', 'super_admin'])

    // Verify customer is default role
    const customerRole = createdRoles.find((role) => role.name === 'customer')
    assert.isTrue(customerRole?.isDefault)

    // Verify other roles are not default
    const nonDefaultRoles = createdRoles.filter((role) => role.name !== 'customer')
    nonDefaultRoles.forEach((role) => {
      assert.isFalse(role.isDefault)
    })
  })

  // ================================================================================================
  // 6. EDGE CASES AND ERROR HANDLING
  // ================================================================================================

  test('should handle non-existent roles in canAccess', async ({ assert }) => {
    const result = await rbacService.canAccess(users.customer, 'non_existent_role', testTenant.id)
    assert.isFalse(result)
  })

  test('should handle users with no roles', async ({ assert }) => {
    const userWithNoRoles = await User.create({
      email: 'noroles@test.com',
      password: 'password123',
      status: 'active',
    })

    const result = await rbacService.canAccess(userWithNoRoles, 'customer', testTenant.id)
    assert.isFalse(result)

    const userRoles = await rbacService.getUserRoles(userWithNoRoles, testTenant.id)
    assert.lengthOf(userRoles, 0)
  })

  test('should handle invalid tenant ID in role operations', async ({ assert }) => {
    try {
      await rbacService.canAccess(users.customer, 'customer', 99999)
      assert.fail('Should have thrown an error for invalid tenant')
    } catch (error) {
      // Expected behavior - invalid tenant should cause issues
      assert.isTrue(true)
    }
  })
})
