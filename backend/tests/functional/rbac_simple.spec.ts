// ================================================================================================
// SIMPLE RBAC TEST TO VALIDATE SETUP
// ================================================================================================

import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import User from '#modules/user/models/user'
import Role from '#modules/rbac/models/role'
import Tenant from '#modules/tenant/models/tenant'
import RbacService from '#modules/rbac/services/rbac_service'

test.group('Simple RBAC Test', (group) => {
  group.each.setup(() => testUtils.db().truncate())

  test('should create and assign roles correctly', async ({ assert }) => {
    const rbacService = new RbacService()

    // Create tenant
    const tenant = await Tenant.create({
      name: 'Test Store',
      slug: 'test-store',
      status: 'active',
    })

    // Create roles
    await rbacService.createDefaultRoles(tenant.id)

    // Verify roles were created
    const roles = await Role.query().where('tenant_id', tenant.id)
    assert.lengthOf(roles, 4)

    // Create user
    const user = await User.create({
      email: 'test@example.com',
      password: 'password123',
      status: 'active',
    })

    // Assign role
    await rbacService.assignRole(user, 'customer', tenant.id)

    // Verify role assignment
    const userRoles = await rbacService.getUserRoles(user, tenant.id)
    assert.lengthOf(userRoles, 1)
    assert.equal(userRoles[0].name, 'customer')

    // Test permission check
    const canAccess = await rbacService.canAccess(user, 'customer', tenant.id)
    assert.isTrue(canAccess)
  })

  test('should list roles via API', async ({ client, assert }) => {
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

    // Create roles
    const adminRole = await Role.create({
      name: 'admin',
      displayName: 'Administrator',
      tenantId: tenant.id,
      isDefault: false,
    })

    await Role.create({
      name: 'customer',
      displayName: 'Customer',
      tenantId: tenant.id,
      isDefault: true,
    })

    // Assign admin role
    await user.related('roles').attach({
      [adminRole.id]: { tenant_id: tenant.id },
    })

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

    // List roles
    const rolesResponse = await client.get('/api/roles').headers({
      'Authorization': `Bearer ${token}`,
      'X-Tenant-Slug': tenant.slug,
    })

    rolesResponse.assertStatus(200)
    assert.equal(rolesResponse.body().success, true)
    assert.isArray(rolesResponse.body().data)
    assert.lengthOf(rolesResponse.body().data, 2)
  })
})
