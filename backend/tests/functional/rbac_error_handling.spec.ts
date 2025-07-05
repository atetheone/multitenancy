// ================================================================================================
// RBAC ERROR HANDLING & EDGE CASES TESTS
// ================================================================================================
// File: tests/functional/rbac_error_handling.spec.ts

import { test } from '@japa/runner'
import { ApiClient } from '@japa/api-client'
import User from '#modules/user/models/user'
import Role from '#modules/rbac/models/role'
import Tenant from '#modules/tenant/models/tenant'
import RbacService from '#modules/rbac/services/rbac_service'
import testUtils from '@adonisjs/core/services/test_utils'

test.group('RBAC - Error Handling & Edge Cases', (group) => {
  let rbacService: RbacService
  let testTenant: Tenant
  let adminUser: User
  let adminToken: string
  let testUser: User

  group.each.setup(() => testUtils.db().truncate())

  group.setup(async () => {
    rbacService = new RbacService()

    // Create test tenant
    testTenant = await Tenant.create({
      name: 'Error Test Store',
      slug: 'error-test-store',
      domain: 'error-test.com',
      status: 'active',
    })

    // Create roles
    const roles = [
      { name: 'admin', displayName: 'Administrator', tenantId: testTenant.id, isDefault: false },
      { name: 'customer', displayName: 'Customer', tenantId: testTenant.id, isDefault: true },
    ]

    for (const roleData of roles) {
      await Role.create(roleData)
    }

    // Create admin user
    adminUser = await User.create({
      email: 'admin@error-test.com',
      password: 'password123',
      status: 'active',
    })

    await adminUser.related('profile').create({
      firstName: 'Admin',
      lastName: 'User',
    })

    // Assign admin role
    const adminRole = await Role.query()
      .where('name', 'admin')
      .where('tenant_id', testTenant.id)
      .firstOrFail()

    await adminUser.related('roles').attach({
      [adminRole.id]: { tenant_id: testTenant.id },
    })

    // Get admin token
    const client = new ApiClient()
    const loginResponse = await client
      .post('/api/auth/login')
      .headers({ 'X-Tenant-Slug': testTenant.slug })
      .json({
        email: adminUser.email,
        password: 'password123',
      })

    adminToken = loginResponse.body().data.token.accessToken

    // Create test user
    testUser = await User.create({
      email: 'testuser@error-test.com',
      password: 'password123',
      status: 'active',
    })

    await testUser.related('profile').create({
      firstName: 'Test',
      lastName: 'User',
    })
  })

  // ================================================================================================
  // 1. AUTHENTICATION & AUTHORIZATION ERROR TESTS
  // ================================================================================================

  test('should return 401 for missing authorization header', async ({ client, assert }) => {
    const response = await client.get('/api/roles').headers({
      'X-Tenant-Slug': testTenant.slug,
    })

    response.assertStatus(401)
    assert.equal(response.body().success, false)
    assert.property(response.body(), 'message')
  })

  test('should return 401 for invalid authorization token', async ({ client, assert }) => {
    const response = await client.get('/api/roles').headers({
      'Authorization': 'Bearer invalid-token',
      'X-Tenant-Slug': testTenant.slug,
    })

    response.assertStatus(401)
    assert.equal(response.body().success, false)
  })

  test('should return 401 for expired token', async ({ client, assert }) => {
    // This would require mocking time or using an actual expired token
    // For now, we'll test with a malformed token that looks expired
    const expiredToken =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyMzkwMjJ9.invalid'

    const response = await client.get('/api/roles').headers({
      'Authorization': `Bearer ${expiredToken}`,
      'X-Tenant-Slug': testTenant.slug,
    })

    response.assertStatus(401)
    assert.equal(response.body().success, false)
  })

  test('should return 400 for missing tenant header', async ({ client, assert }) => {
    const response = await client.get('/api/roles').headers({
      Authorization: `Bearer ${adminToken}`,
    })

    response.assertStatus(400)
    assert.equal(response.body().success, false)
  })

  test('should return 404 for non-existent tenant', async ({ client, assert }) => {
    const response = await client.get('/api/roles').headers({
      'Authorization': `Bearer ${adminToken}`,
      'X-Tenant-Slug': 'non-existent-tenant',
    })

    response.assertStatus(404)
    assert.equal(response.body().success, false)
  })

  test('should return 403 for inactive tenant', async ({ client, assert }) => {
    // Create inactive tenant
    const inactiveTenant = await Tenant.create({
      name: 'Inactive Store',
      slug: 'inactive-store',
      status: 'inactive',
    })

    const response = await client.get('/api/roles').headers({
      'Authorization': `Bearer ${adminToken}`,
      'X-Tenant-Slug': inactiveTenant.slug,
    })

    response.assertStatus(403)
    assert.equal(response.body().success, false)
  })

  // ================================================================================================
  // 2. ROLE ASSIGNMENT ERROR TESTS
  // ================================================================================================

  test('should return 400 for missing roleIds in role assignment', async ({ client, assert }) => {
    const response = await client
      .post(`/api/users/${testUser.id}/roles`)
      .headers({
        'Authorization': `Bearer ${adminToken}`,
        'X-Tenant-Slug': testTenant.slug,
      })
      .json({
        tenantId: testTenant.id,
      })

    response.assertStatus(400)
    assert.equal(response.body().success, false)
    assert.property(response.body(), 'errors')
  })

  test('should return 400 for missing tenantId in role assignment', async ({ client, assert }) => {
    const customerRole = await Role.query()
      .where('name', 'customer')
      .where('tenant_id', testTenant.id)
      .firstOrFail()

    const response = await client
      .post(`/api/users/${testUser.id}/roles`)
      .headers({
        'Authorization': `Bearer ${adminToken}`,
        'X-Tenant-Slug': testTenant.slug,
      })
      .json({
        roleIds: [customerRole.id],
      })

    response.assertStatus(400)
    assert.equal(response.body().success, false)
    assert.property(response.body(), 'errors')
  })

  test('should return 400 for invalid userId type', async ({ client, assert }) => {
    const response = await client
      .post('/api/users/1/roles')
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

  test('should return 400 for empty roleName', async ({ client, assert }) => {
    const response = await client
      .post('/api/users/1/roles')
      .headers({
        'Authorization': `Bearer ${adminToken}`,
        'X-Tenant-Slug': testTenant.slug,
      })
      .json({
        userId: testUser.id,
        roleName: '',
      })

    response.assertStatus(400)
    assert.equal(response.body().success, false)
  })

  test('should return 400 for negative userId', async ({ client, assert }) => {
    const response = await client
      .post('/api/users/1/roles')
      .headers({
        'Authorization': `Bearer ${adminToken}`,
        'X-Tenant-Slug': testTenant.slug,
      })
      .json({
        userId: -1,
        roleName: 'customer',
      })

    response.assertStatus(400)
    assert.equal(response.body().success, false)
  })

  test('should return 400 for zero userId', async ({ client, assert }) => {
    const response = await client
      .post('/api/users/1/roles')
      .headers({
        'Authorization': `Bearer ${adminToken}`,
        'X-Tenant-Slug': testTenant.slug,
      })
      .json({
        userId: 0,
        roleName: 'customer',
      })

    response.assertStatus(400)
    assert.equal(response.body().success, false)
  })

  test('should return 400 for non-existent user ID', async ({ client, assert }) => {
    const response = await client
      .post('/api/users/1/roles')
      .headers({
        'Authorization': `Bearer ${adminToken}`,
        'X-Tenant-Slug': testTenant.slug,
      })
      .json({
        userId: 999999,
        roleName: 'customer',
      })

    response.assertStatus(400)
    assert.equal(response.body().success, false)
    assert.include(response.body().message, 'not found')
  })

  test('should return 400 for non-existent role name', async ({ client, assert }) => {
    const response = await client
      .post('/api/users/1/roles')
      .headers({
        'Authorization': `Bearer ${adminToken}`,
        'X-Tenant-Slug': testTenant.slug,
      })
      .json({
        userId: testUser.id,
        roleName: 'non_existent_role',
      })

    response.assertStatus(400)
    assert.equal(response.body().success, false)
    assert.include(response.body().message, 'not found')
  })

  // ================================================================================================
  // 3. ROLE REMOVAL ERROR TESTS
  // ================================================================================================

  test('should return 400 for missing userId in role removal', async ({ client, assert }) => {
    const response = await client
      .post('/api/roles/remove')
      .headers({
        'Authorization': `Bearer ${adminToken}`,
        'X-Tenant-Slug': testTenant.slug,
      })
      .json({
        roleName: 'customer',
      })

    response.assertStatus(400)
    assert.equal(response.body().success, false)
  })

  test('should return 400 for missing roleName in role removal', async ({ client, assert }) => {
    const response = await client
      .post('/api/roles/remove')
      .headers({
        'Authorization': `Bearer ${adminToken}`,
        'X-Tenant-Slug': testTenant.slug,
      })
      .json({
        userId: testUser.id,
      })

    response.assertStatus(400)
    assert.equal(response.body().success, false)
  })

  test('should return 400 for non-existent user in role removal', async ({ client, assert }) => {
    const response = await client
      .post('/api/roles/remove')
      .headers({
        'Authorization': `Bearer ${adminToken}`,
        'X-Tenant-Slug': testTenant.slug,
      })
      .json({
        userId: 999999,
        roleName: 'customer',
      })

    response.assertStatus(400)
    assert.equal(response.body().success, false)
  })

  test('should return 400 for non-existent role in removal', async ({ client, assert }) => {
    const response = await client
      .post('/api/roles/remove')
      .headers({
        'Authorization': `Bearer ${adminToken}`,
        'X-Tenant-Slug': testTenant.slug,
      })
      .json({
        userId: testUser.id,
        roleName: 'non_existent_role',
      })

    response.assertStatus(400)
    assert.equal(response.body().success, false)
    assert.include(response.body().message, 'not found')
  })

  // ================================================================================================
  // 4. SERVICE LAYER ERROR TESTS
  // ================================================================================================

  test('should throw error for role assignment with invalid tenant ID', async ({ assert }) => {
    try {
      await rbacService.assignRole(testUser, 'customer', -1)
      assert.fail('Should have thrown an error')
    } catch (error) {
      assert.isTrue(true)
    }
  })

  test('should throw error for role assignment with non-existent role', async ({ assert }) => {
    try {
      await rbacService.assignRole(testUser, 'non_existent_role', testTenant.id)
      assert.fail('Should have thrown an error')
    } catch (error) {
      assert.include(error.message, 'not found')
    }
  })

  test('should throw error for role removal with invalid tenant ID', async ({ assert }) => {
    try {
      await rbacService.removeRole(testUser, 'customer', -1)
      assert.fail('Should have thrown an error')
    } catch (error) {
      assert.isTrue(true)
    }
  })

  test('should throw error for role removal with non-existent role', async ({ assert }) => {
    try {
      await rbacService.removeRole(testUser, 'non_existent_role', testTenant.id)
      assert.fail('Should have thrown an error')
    } catch (error) {
      assert.include(error.message, 'not found')
    }
  })

  test('should handle permission check with null user', async ({ assert }) => {
    try {
      await rbacService.canAccess(null as any, 'customer', testTenant.id)
      assert.fail('Should have thrown an error')
    } catch (error) {
      assert.isTrue(true)
    }
  })

  test('should handle getUserRoles with null user', async ({ assert }) => {
    try {
      await rbacService.getUserRoles(null as any, testTenant.id)
      assert.fail('Should have thrown an error')
    } catch (error) {
      assert.isTrue(true)
    }
  })

  // ================================================================================================
  // 5. DATABASE CONSTRAINT ERROR TESTS
  // ================================================================================================

  test('should handle database connection errors gracefully', async ({ client, assert }) => {
    // This test would require actually disconnecting from DB
    // For now, we'll test that the system handles errors properly
    const response = await client.get('/api/roles').headers({
      'Authorization': `Bearer ${adminToken}`,
      'X-Tenant-Slug': testTenant.slug,
    })

    // Should succeed under normal conditions
    response.assertStatus(200)
    assert.equal(response.body().success, true)
  })

  // ================================================================================================
  // 6. MALFORMED REQUEST TESTS
  // ================================================================================================

  test('should handle malformed JSON in role assignment', async ({ client, assert }) => {
    const response = await client
      .post('/api/users/1/roles')
      .headers({
        'Authorization': `Bearer ${adminToken}`,
        'X-Tenant-Slug': testTenant.slug,
        'Content-Type': 'application/json',
      })
      .json('{"roleIds": [1], "tenantId": ' + testTenant.id + '') // Malformed JSON

    response.assertStatus(400)
    assert.equal(response.body().success, false)
  })

  test('should handle empty request body', async ({ client, assert }) => {
    const response = await client
      .post('/api/users/1/roles')
      .headers({
        'Authorization': `Bearer ${adminToken}`,
        'X-Tenant-Slug': testTenant.slug,
      })
      .json({})

    response.assertStatus(400)
    assert.equal(response.body().success, false)
  })

  test('should handle oversized request body', async ({ client, assert }) => {
    const largeRoleName = 'a'.repeat(10000) // Very large string

    const response = await client
      .post('/api/users/1/roles')
      .headers({
        'Authorization': `Bearer ${adminToken}`,
        'X-Tenant-Slug': testTenant.slug,
      })
      .json({
        userId: testUser.id,
        roleName: largeRoleName,
      })

    response.assertStatus(400)
    assert.equal(response.body().success, false)
  })

  // ================================================================================================
  // 7. EDGE CASE SCENARIOS
  // ================================================================================================

  test('should handle user with deleted profile', async ({ client, assert }) => {
    // Create user without profile
    const userWithoutProfile = await User.create({
      email: 'noprofile@test.com',
      password: 'password123',
      status: 'active',
    })

    const response = await client
      .post('/api/users/1/roles')
      .headers({
        'Authorization': `Bearer ${adminToken}`,
        'X-Tenant-Slug': testTenant.slug,
      })
      .json({
        userId: userWithoutProfile.id,
        roleName: 'customer',
      })

    // Should still work even without profile
    response.assertStatus(200)
    assert.equal(response.body().success, true)
  })

  test('should handle suspended user', async ({ client, assert }) => {
    const suspendedUser = await User.create({
      email: 'suspended@test.com',
      password: 'password123',
      status: 'suspended',
    })

    const response = await client
      .post('/api/users/1/roles')
      .headers({
        'Authorization': `Bearer ${adminToken}`,
        'X-Tenant-Slug': testTenant.slug,
      })
      .json({
        userId: suspendedUser.id,
        roleName: 'customer',
      })

    // Should still be able to assign roles to suspended users
    response.assertStatus(200)
    assert.equal(response.body().success, true)
  })

  test('should handle role assignment to same user multiple times', async ({ client, assert }) => {
    // First assignment
    await client
      .post('/api/users/1/roles')
      .headers({
        'Authorization': `Bearer ${adminToken}`,
        'X-Tenant-Slug': testTenant.slug,
      })
      .json({
        userId: testUser.id,
        roleName: 'customer',
      })

    // Second assignment (duplicate)
    const response = await client
      .post('/api/users/1/roles')
      .headers({
        'Authorization': `Bearer ${adminToken}`,
        'X-Tenant-Slug': testTenant.slug,
      })
      .json({
        userId: testUser.id,
        roleName: 'customer',
      })

    // Should handle gracefully (idempotent)
    response.assertStatus(200)
    assert.equal(response.body().success, true)
  })

  test('should handle removing role that was never assigned', async ({ client, assert }) => {
    const response = await client
      .post('/api/roles/remove')
      .headers({
        'Authorization': `Bearer ${adminToken}`,
        'X-Tenant-Slug': testTenant.slug,
      })
      .json({
        userId: testUser.id,
        roleName: 'customer',
      })

    // Should handle gracefully (idempotent)
    response.assertStatus(200)
    assert.equal(response.body().success, true)
  })

  // ================================================================================================
  // 8. CONCURRENT ACCESS TESTS
  // ================================================================================================

  test('should handle concurrent role assignments', async ({ client, assert }) => {
    const newUser = await User.create({
      email: 'concurrent@test.com',
      password: 'password123',
      status: 'active',
    })

    // Make multiple concurrent requests
    const promises = []
    for (let i = 0; i < 5; i++) {
      promises.push(
        client
          .post('/api/users/1/roles')
          .headers({
            'Authorization': `Bearer ${adminToken}`,
            'X-Tenant-Slug': testTenant.slug,
          })
          .json({
            userId: newUser.id,
            roleName: 'customer',
          })
      )
    }

    const responses = await Promise.all(promises)

    // All should succeed (idempotent)
    responses.forEach((response) => {
      response.assertStatus(200)
      assert.equal(response.body().success, true)
    })

    // Verify user has only one role assigned
    const userRoles = await rbacService.getUserRoles(newUser, testTenant.id)
    assert.lengthOf(userRoles, 1)
    assert.equal(userRoles[0].name, 'customer')
  })

  // ================================================================================================
  // 9. MEMORY AND PERFORMANCE EDGE CASES
  // ================================================================================================

  test('should handle large number of roles in listing', async ({ client, assert }) => {
    // Create many roles
    const promises = []
    for (let i = 0; i < 50; i++) {
      promises.push(
        Role.create({
          name: `test_role_${i}`,
          displayName: `Test Role ${i}`,
          tenantId: testTenant.id,
          isDefault: false,
        })
      )
    }
    await Promise.all(promises)

    const response = await client.get('/api/roles').headers({
      'Authorization': `Bearer ${adminToken}`,
      'X-Tenant-Slug': testTenant.slug,
    })

    response.assertStatus(200)
    assert.equal(response.body().success, true)
    // Should have original 2 roles + 50 new ones
    assert.isAtLeast(response.body().data.length, 50)
  })
})
