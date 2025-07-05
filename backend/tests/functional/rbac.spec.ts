// ================================================================================================
// RBAC FUNCTIONAL TESTS
// ================================================================================================
// File: tests/functional/rbac.spec.ts

import { test } from '@japa/runner'
import { ApiClient } from '@japa/api-client'
import User from '#modules/user/models/user'
import Role from '#modules/rbac/models/role'
import Tenant from '#modules/tenant/models/tenant'
import testUtils from '@adonisjs/core/services/test_utils'

test.group('RBAC - Role Management', (group) => {
  let superAdminToken: string
  let adminToken: string
  let managerToken: string
  let customerToken: string
  let testTenant: Tenant
  let secondTenant: Tenant

  group.each.setup(() => testUtils.db().truncate())

  group.setup(async () => {
    // Create test tenants
    testTenant = await Tenant.create({
      name: 'Test Store',
      slug: 'test-store',
      domain: 'test-store.com',
      status: 'active',
    })

    secondTenant = await Tenant.create({
      name: 'Second Store', 
      slug: 'second-store',
      domain: 'second-store.com',
      status: 'active',
    })

    // Create roles for test tenant
    const roles = [
      { name: 'super_admin', displayName: 'Super Administrator', tenantId: testTenant.id, isDefault: false },
      { name: 'admin', displayName: 'Administrator', tenantId: testTenant.id, isDefault: false },
      { name: 'manager', displayName: 'Manager', tenantId: testTenant.id, isDefault: false },
      { name: 'customer', displayName: 'Customer', tenantId: testTenant.id, isDefault: true },
    ]

    for (const roleData of roles) {
      await Role.create(roleData)
    }

    // Create roles for second tenant
    for (const roleData of roles) {
      await Role.create({ ...roleData, tenantId: secondTenant.id })
    }

    // Create test users and get tokens
    const users = [
      { email: 'superadmin@test.com', password: 'password123', role: 'super_admin' },
      { email: 'admin@test.com', password: 'password123', role: 'admin' },
      { email: 'manager@test.com', password: 'password123', role: 'manager' },
      { email: 'customer@test.com', password: 'password123', role: 'customer' },
    ]

    const tokens: { [key: string]: string } = {}

    for (const userData of users) {
      // Create user
      const user = await User.create({
        email: userData.email,
        password: userData.password,
        status: 'active',
      })

      // Create profile
      await user.related('profile').create({
        firstName: userData.role,
        lastName: 'User',
      })

      // Assign role
      const role = await Role.query()
        .where('name', userData.role)
        .where('tenant_id', testTenant.id)
        .firstOrFail()

      await user.related('roles').attach({
        [role.id]: { tenant_id: testTenant.id }
      })

      // Get auth token
      const client = new ApiClient()
      const loginResponse = await client
        .post('/api/auth/login')
        .headers({ 'X-Tenant-Slug': testTenant.slug })
        .json({
          email: userData.email,
          password: userData.password,
        })

      console.log(`Login response for ${userData.role}:`, loginResponse.body())
      
      if (loginResponse.body()?.data?.token?.accessToken) {
        tokens[`${userData.role}Token`] = loginResponse.body().data.token.accessToken
      } else {
        throw new Error(`Failed to get token for ${userData.role}: ${JSON.stringify(loginResponse.body())}`)
      }
    }

    superAdminToken = tokens.superAdminToken
    adminToken = tokens.adminToken
    managerToken = tokens.managerToken
    customerToken = tokens.customerToken
  })


  // ================================================================================================
  // 1. ROLE LISTING TESTS
  // ================================================================================================

  test('should list roles for tenant (admin access)', async ({ client, assert }) => {
    const response = await client
      .get('/api/roles')
      .headers({
        'Authorization': `Bearer ${adminToken}`,
        'X-Tenant-Slug': testTenant.slug,
      })

    response.assertStatus(200)
    assert.equal(response.body().success, true)
    assert.isArray(response.body().data)
    assert.lengthOf(response.body().data, 4) // 4 default roles
    
    const roleNames = response.body().data.map((role: any) => role.name)
    assert.includeMembers(roleNames, ['super_admin', 'admin', 'manager', 'customer'])
  })

  test('should list roles for tenant (super admin access)', async ({ client, assert }) => {
    const response = await client
      .get('/api/roles')
      .headers({
        'Authorization': `Bearer ${superAdminToken}`,
        'X-Tenant-Slug': testTenant.slug,
      })

    response.assertStatus(200)
    assert.equal(response.body().success, true)
    assert.isArray(response.body().data)
  })

  test('should deny role listing for manager', async ({ client, assert }) => {
    const response = await client
      .get('/api/roles')
      .headers({
        'Authorization': `Bearer ${managerToken}`,
        'X-Tenant-Slug': testTenant.slug,
      })

    response.assertStatus(403)
    assert.equal(response.body().success, false)
  })

  test('should deny role listing for customer', async ({ client, assert }) => {
    const response = await client
      .get('/api/roles')
      .headers({
        'Authorization': `Bearer ${customerToken}`,
        'X-Tenant-Slug': testTenant.slug,
      })

    response.assertStatus(403)
    assert.equal(response.body().success, false)
  })

  test('should deny role listing without authentication', async ({ client, assert }) => {
    const response = await client
      .get('/api/roles')
      .headers({
        'X-Tenant-Slug': testTenant.slug,
      })

    response.assertStatus(401)
    assert.equal(response.body().success, false)
  })

  test('should deny role listing without tenant', async ({ client, assert }) => {
    const response = await client
      .get('/api/roles')
      .headers({
        'Authorization': `Bearer ${adminToken}`,
      })

    response.assertStatus(400)
    assert.equal(response.body().success, false)
  })

  // ================================================================================================
  // 2. ROLE ASSIGNMENT TESTS
  // ================================================================================================

  test('should assign role to user (admin)', async ({ client, assert }) => {
    // Create a new user for testing
    const newUser = await User.create({
      email: 'newuser@test.com',
      password: 'password123',
      status: 'active',
    })

    await newUser.related('profile').create({
      firstName: 'New',
      lastName: 'User',
    })

    // Get the manager role ID
    const managerRole = await Role.query()
      .where('name', 'manager')
      .where('tenant_id', testTenant.id)
      .firstOrFail()

    const response = await client
      .post(`/api/users/${newUser.id}/roles`)
      .headers({
        'Authorization': `Bearer ${adminToken}`,
        'X-Tenant-Slug': testTenant.slug,
      })
      .json({
        roleIds: [managerRole.id],
        tenantId: testTenant.id,
      })

    response.assertStatus(200)
    assert.equal(response.body().success, true)

    // Verify role was assigned
    await newUser.load('roles', (query) => {
      query.where('tenant_id', testTenant.id)
    })
    
    assert.lengthOf(newUser.roles, 1)
    assert.equal(newUser.roles[0].name, 'manager')
  })

  test('should assign role to user (super admin)', async ({ client, assert }) => {
    const newUser = await User.create({
      email: 'newuser2@test.com',
      password: 'password123',
      status: 'active',
    })

    await newUser.related('profile').create({
      firstName: 'New',
      lastName: 'User 2',
    })

    // Get the admin role ID
    const adminRole = await Role.query()
      .where('name', 'admin')
      .where('tenant_id', testTenant.id)
      .firstOrFail()

    const response = await client
      .post(`/api/users/${newUser.id}/roles`)
      .headers({
        'Authorization': `Bearer ${superAdminToken}`,
        'X-Tenant-Slug': testTenant.slug,
      })
      .json({
        roleIds: [adminRole.id],
        tenantId: testTenant.id,
      })

    response.assertStatus(200)
    assert.equal(response.body().success, true)
  })

  test('should deny role assignment for manager', async ({ client, assert }) => {
    const newUser = await User.create({
      email: 'newuser3@test.com',
      password: 'password123',
      status: 'active',
    })

    const response = await client
      .post('/api/users/${userId}/roles')
      .headers({
        'Authorization': `Bearer ${managerToken}`,
        'X-Tenant-Slug': testTenant.slug,
      })
      .json({
        userId: newUser.id,
        roleName: 'customer',
      })

    response.assertStatus(403)
    assert.equal(response.body().success, false)
  })

  test('should deny role assignment for customer', async ({ client, assert }) => {
    const newUser = await User.create({
      email: 'newuser4@test.com',
      password: 'password123',
      status: 'active',
    })

    const response = await client
      .post('/api/users/${userId}/roles')
      .headers({
        'Authorization': `Bearer ${customerToken}`,
        'X-Tenant-Slug': testTenant.slug,
      })
      .json({
        userId: newUser.id,
        roleName: 'customer',
      })

    response.assertStatus(403)
    assert.equal(response.body().success, false)
  })

  test('should fail to assign non-existent role', async ({ client, assert }) => {
    const newUser = await User.create({
      email: 'newuser5@test.com',
      password: 'password123',
      status: 'active',
    })

    const response = await client
      .post('/api/users/${userId}/roles')
      .headers({
        'Authorization': `Bearer ${adminToken}`,
        'X-Tenant-Slug': testTenant.slug,
      })
      .json({
        userId: newUser.id,
        roleName: 'non_existent_role',
      })

    response.assertStatus(400)
    assert.equal(response.body().success, false)
    assert.include(response.body().message, 'not found')
  })

  test('should fail to assign role to non-existent user', async ({ client, assert }) => {
    const response = await client
      .post('/api/users/${userId}/roles')
      .headers({
        'Authorization': `Bearer ${adminToken}`,
        'X-Tenant-Slug': testTenant.slug,
      })
      .json({
        userId: 99999,
        roleName: 'customer',
      })

    response.assertStatus(400)
    assert.equal(response.body().success, false)
  })

  test('should handle duplicate role assignment gracefully', async ({ client, assert }) => {
    const newUser = await User.create({
      email: 'newuser6@test.com',
      password: 'password123',
      status: 'active',
    })

    // First assignment
    await client
      .post('/api/users/${userId}/roles')
      .headers({
        'Authorization': `Bearer ${adminToken}`,
        'X-Tenant-Slug': testTenant.slug,
      })
      .json({
        userId: newUser.id,
        roleName: 'customer',
      })

    // Second assignment (duplicate)
    const response = await client
      .post('/api/users/${userId}/roles')
      .headers({
        'Authorization': `Bearer ${adminToken}`,
        'X-Tenant-Slug': testTenant.slug,
      })
      .json({
        userId: newUser.id,
        roleName: 'customer',
      })

    // Should still succeed (idempotent)
    response.assertStatus(200)
    assert.equal(response.body().success, true)

    // Verify user still has only one role
    await newUser.load('roles', (query) => {
      query.where('tenant_id', testTenant.id)
    })
    
    assert.lengthOf(newUser.roles, 1)
  })

  // ================================================================================================
  // 3. ROLE REMOVAL TESTS
  // ================================================================================================

  test('should remove role from user (admin)', async ({ client, assert }) => {
    // Create a user with a role
    const newUser = await User.create({
      email: 'removeuser1@test.com',
      password: 'password123',
      status: 'active',
    })

    await newUser.related('profile').create({
      firstName: 'Remove',
      lastName: 'User 1',
    })

    // First assign a role
    await client
      .post('/api/users/${userId}/roles')
      .headers({
        'Authorization': `Bearer ${adminToken}`,
        'X-Tenant-Slug': testTenant.slug,
      })
      .json({
        userId: newUser.id,
        roleName: 'manager',
      })

    // Now remove the role
    const response = await client
      .post('/api/roles/remove')
      .headers({
        'Authorization': `Bearer ${adminToken}`,
        'X-Tenant-Slug': testTenant.slug,
      })
      .json({
        userId: newUser.id,
        roleName: 'manager',
      })

    response.assertStatus(200)
    assert.equal(response.body().success, true)

    // Verify role was removed
    await newUser.load('roles', (query) => {
      query.where('tenant_id', testTenant.id)
    })
    
    assert.lengthOf(newUser.roles, 0)
  })

  test('should remove role from user (super admin)', async ({ client, assert }) => {
    const newUser = await User.create({
      email: 'removeuser2@test.com',
      password: 'password123',
      status: 'active',
    })

    await newUser.related('profile').create({
      firstName: 'Remove',
      lastName: 'User 2',
    })

    // Assign role first
    await client
      .post('/api/users/${userId}/roles')
      .headers({
        'Authorization': `Bearer ${superAdminToken}`,
        'X-Tenant-Slug': testTenant.slug,
      })
      .json({
        userId: newUser.id,
        roleName: 'admin',
      })

    // Remove role
    const response = await client
      .post('/api/roles/remove')
      .headers({
        'Authorization': `Bearer ${superAdminToken}`,
        'X-Tenant-Slug': testTenant.slug,
      })
      .json({
        userId: newUser.id,
        roleName: 'admin',
      })

    response.assertStatus(200)
    assert.equal(response.body().success, true)
  })

  test('should deny role removal for manager', async ({ client, assert }) => {
    const newUser = await User.create({
      email: 'removeuser3@test.com',
      password: 'password123',
      status: 'active',
    })

    const response = await client
      .post('/api/roles/remove')
      .headers({
        'Authorization': `Bearer ${managerToken}`,
        'X-Tenant-Slug': testTenant.slug,
      })
      .json({
        userId: newUser.id,
        roleName: 'customer',
      })

    response.assertStatus(403)
    assert.equal(response.body().success, false)
  })

  test('should deny role removal for customer', async ({ client, assert }) => {
    const newUser = await User.create({
      email: 'removeuser4@test.com',
      password: 'password123',
      status: 'active',
    })

    const response = await client
      .post('/api/roles/remove')
      .headers({
        'Authorization': `Bearer ${customerToken}`,
        'X-Tenant-Slug': testTenant.slug,
      })
      .json({
        userId: newUser.id,
        roleName: 'customer',
      })

    response.assertStatus(403)
    assert.equal(response.body().success, false)
  })

  test('should fail to remove non-existent role', async ({ client, assert }) => {
    const newUser = await User.create({
      email: 'removeuser5@test.com',
      password: 'password123',
      status: 'active',
    })

    const response = await client
      .post('/api/roles/remove')
      .headers({
        'Authorization': `Bearer ${adminToken}`,
        'X-Tenant-Slug': testTenant.slug,
      })
      .json({
        userId: newUser.id,
        roleName: 'non_existent_role',
      })

    response.assertStatus(400)
    assert.equal(response.body().success, false)
    assert.include(response.body().message, 'not found')
  })

  test('should fail to remove role from non-existent user', async ({ client, assert }) => {
    const response = await client
      .post('/api/roles/remove')
      .headers({
        'Authorization': `Bearer ${adminToken}`,
        'X-Tenant-Slug': testTenant.slug,
      })
      .json({
        userId: 99999,
        roleName: 'customer',
      })

    response.assertStatus(400)
    assert.equal(response.body().success, false)
  })

  test('should handle removing non-assigned role gracefully', async ({ client, assert }) => {
    const newUser = await User.create({
      email: 'removeuser6@test.com',
      password: 'password123',
      status: 'active',
    })

    // Try to remove a role that was never assigned
    const response = await client
      .post('/api/roles/remove')
      .headers({
        'Authorization': `Bearer ${adminToken}`,
        'X-Tenant-Slug': testTenant.slug,
      })
      .json({
        userId: newUser.id,
        roleName: 'manager',
      })

    // Should still succeed (idempotent)
    response.assertStatus(200)
    assert.equal(response.body().success, true)

    // Verify user still has no roles
    await newUser.load('roles', (query) => {
      query.where('tenant_id', testTenant.id)
    })
    
    assert.lengthOf(newUser.roles, 0)
  })

  test('should remove only specified role when user has multiple roles', async ({ client, assert }) => {
    const newUser = await User.create({
      email: 'removeuser7@test.com',
      password: 'password123',
      status: 'active',
    })

    await newUser.related('profile').create({
      firstName: 'Multi',
      lastName: 'Role User',
    })

    // Assign multiple roles
    await client
      .post('/api/users/${userId}/roles')
      .headers({
        'Authorization': `Bearer ${adminToken}`,
        'X-Tenant-Slug': testTenant.slug,
      })
      .json({
        userId: newUser.id,
        roleName: 'manager',
      })

    await client
      .post('/api/users/${userId}/roles')
      .headers({
        'Authorization': `Bearer ${adminToken}`,
        'X-Tenant-Slug': testTenant.slug,
      })
      .json({
        userId: newUser.id,
        roleName: 'customer',
      })

    // Remove only one role
    const response = await client
      .post('/api/roles/remove')
      .headers({
        'Authorization': `Bearer ${adminToken}`,
        'X-Tenant-Slug': testTenant.slug,
      })
      .json({
        userId: newUser.id,
        roleName: 'manager',
      })

    response.assertStatus(200)
    assert.equal(response.body().success, true)

    // Verify user still has the customer role
    await newUser.load('roles', (query) => {
      query.where('tenant_id', testTenant.id)
    })
    
    assert.lengthOf(newUser.roles, 1)
    assert.equal(newUser.roles[0].name, 'customer')
  })

  // ================================================================================================
  // 4. VALIDATION TESTS
  // ================================================================================================

  test('should validate required fields for role assignment', async ({ client, assert }) => {
    const response = await client
      .post('/api/users/${userId}/roles')
      .headers({
        'Authorization': `Bearer ${adminToken}`,
        'X-Tenant-Slug': testTenant.slug,
      })
      .json({
        // Missing userId and roleName
      })

    response.assertStatus(400)
    assert.equal(response.body().success, false)
  })

  test('should validate userId type for role assignment', async ({ client, assert }) => {
    const response = await client
      .post('/api/users/${userId}/roles')
      .headers({
        'Authorization': `Bearer ${adminToken}`,
        'X-Tenant-Slug': testTenant.slug,
      })
      .json({
        userId: 'not-a-number',
        roleName: 'customer',
      })

    response.assertStatus(400)
    assert.equal(response.body().success, false)
  })

  test('should validate roleName format for role assignment', async ({ client, assert }) => {
    const newUser = await User.create({
      email: 'newuser7@test.com',
      password: 'password123',
      status: 'active',
    })

    const response = await client
      .post('/api/users/${userId}/roles')
      .headers({
        'Authorization': `Bearer ${adminToken}`,
        'X-Tenant-Slug': testTenant.slug,
      })
      .json({
        userId: newUser.id,
        roleName: '', // Empty role name
      })

    response.assertStatus(400)
    assert.equal(response.body().success, false)
  })
})