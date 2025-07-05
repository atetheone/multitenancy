// ================================================================================================
// RBAC TENANT ISOLATION TESTS
// ================================================================================================
// File: tests/functional/rbac_tenant_isolation.spec.ts

import { test } from '@japa/runner'
import { ApiClient } from '@japa/api-client'
import User from '#modules/user/models/user'
import Role from '#modules/rbac/models/role'
import Tenant from '#modules/tenant/models/tenant'
import RbacService from '#modules/rbac/services/rbac_service'
import testUtils from '@adonisjs/core/services/test_utils'

test.group('RBAC - Tenant Isolation', (group) => {
  let rbacService: RbacService
  let tenantA: Tenant
  let tenantB: Tenant
  let tenantC: Tenant
  let testUser: User
  let adminUserA: User
  let adminUserB: User
  let adminTokenA: string
  let adminTokenB: string
  let crossTenantUser: User

  group.each.setup(() => testUtils.db().truncate())

  group.setup(async () => {
    rbacService = new RbacService()

    // Create multiple test tenants
    tenantA = await Tenant.create({
      name: 'Tenant A Store',
      slug: 'tenant-a',
      domain: 'tenant-a.com',
      status: 'active',
    })

    tenantB = await Tenant.create({
      name: 'Tenant B Store',
      slug: 'tenant-b',
      domain: 'tenant-b.com',
      status: 'active',
    })

    tenantC = await Tenant.create({
      name: 'Tenant C Store',
      slug: 'tenant-c',
      domain: 'tenant-c.com',
      status: 'active',
    })

    // Create roles for each tenant
    const roleNames = ['super_admin', 'admin', 'manager', 'staff', 'customer']

    for (const tenant of [tenantA, tenantB, tenantC]) {
      for (const roleName of roleNames) {
        await Role.create({
          name: roleName,
          displayName: roleName.charAt(0).toUpperCase() + roleName.slice(1),
          tenantId: tenant.id,
          isDefault: roleName === 'customer',
        })
      }
    }

    // Create a test user
    testUser = await User.create({
      email: 'testuser@isolation.com',
      password: 'password123',
      status: 'active',
    })

    await testUser.related('profile').create({
      firstName: 'Test',
      lastName: 'User',
    })

    // Create admin users for each tenant
    adminUserA = await User.create({
      email: 'admin@tenant-a.com',
      password: 'password123',
      status: 'active',
    })

    await adminUserA.related('profile').create({
      firstName: 'Admin',
      lastName: 'A',
    })

    adminUserB = await User.create({
      email: 'admin@tenant-b.com',
      password: 'password123',
      status: 'active',
    })

    await adminUserB.related('profile').create({
      firstName: 'Admin',
      lastName: 'B',
    })

    // Assign admin roles to each tenant
    const adminRoleA = await Role.query()
      .where('name', 'admin')
      .where('tenant_id', tenantA.id)
      .firstOrFail()

    const adminRoleB = await Role.query()
      .where('name', 'admin')
      .where('tenant_id', tenantB.id)
      .firstOrFail()

    await adminUserA.related('roles').attach({
      [adminRoleA.id]: { tenant_id: tenantA.id },
    })

    await adminUserB.related('roles').attach({
      [adminRoleB.id]: { tenant_id: tenantB.id },
    })

    // Get tokens
    const clientA = new ApiClient()
    const loginResponseA = await clientA
      .post('/api/auth/login')
      .headers({ 'X-Tenant-Slug': tenantA.slug })
      .json({
        email: adminUserA.email,
        password: 'password123',
      })

    adminTokenA = loginResponseA.body().data.token.accessToken

    const clientB = new ApiClient()
    const loginResponseB = await clientB
      .post('/api/auth/login')
      .headers({ 'X-Tenant-Slug': tenantB.slug })
      .json({
        email: adminUserB.email,
        password: 'password123',
      })

    adminTokenB = loginResponseB.body().data.token.accessToken

    // Create a user that exists in multiple tenants
    crossTenantUser = await User.create({
      email: 'cross@tenant.com',
      password: 'password123',
      status: 'active',
    })

    await crossTenantUser.related('profile').create({
      firstName: 'Cross',
      lastName: 'Tenant',
    })
  })

  // ================================================================================================
  // 1. ROLE ISOLATION TESTS
  // ================================================================================================

  test('should isolate roles by tenant', async ({ assert }) => {
    // Get roles for tenant A
    const rolesA = await Role.query().where('tenant_id', tenantA.id)
    assert.lengthOf(rolesA, 5)

    // Get roles for tenant B
    const rolesB = await Role.query().where('tenant_id', tenantB.id)
    assert.lengthOf(rolesB, 5)

    // Verify role IDs are different (each tenant has its own roles)
    const roleIdsA = rolesA.map((role) => role.id).sort()
    const roleIdsB = rolesB.map((role) => role.id).sort()

    // Should have no overlap in role IDs
    const overlap = roleIdsA.filter((id) => roleIdsB.includes(id))
    assert.lengthOf(overlap, 0)
  })

  test('should only list roles for current tenant', async ({ client, assert }) => {
    // Get roles for tenant A
    const responseA = await client.get('/api/roles').headers({
      'Authorization': `Bearer ${adminTokenA}`,
      'X-Tenant-Slug': tenantA.slug,
    })

    responseA.assertStatus(200)
    const rolesA = responseA.body().data
    assert.lengthOf(rolesA, 5)

    // All roles should belong to tenant A
    rolesA.forEach((role: any) => {
      assert.equal(role.tenantId, tenantA.id)
    })

    // Get roles for tenant B
    const responseB = await client.get('/api/roles').headers({
      'Authorization': `Bearer ${adminTokenB}`,
      'X-Tenant-Slug': tenantB.slug,
    })

    responseB.assertStatus(200)
    const rolesB = responseB.body().data
    assert.lengthOf(rolesB, 5)

    // All roles should belong to tenant B
    rolesB.forEach((role: any) => {
      assert.equal(role.tenantId, tenantB.id)
    })

    // Role IDs should be different
    const roleIdsA = rolesA.map((role: any) => role.id).sort()
    const roleIdsB = rolesB.map((role: any) => role.id).sort()
    assert.notDeepEqual(roleIdsA, roleIdsB)
  })

  test('should not access roles from different tenant', async ({ client, assert }) => {
    // Try to access tenant B with tenant A token
    const response = await client.get('/api/roles').headers({
      'Authorization': `Bearer ${adminTokenA}`,
      'X-Tenant-Slug': tenantB.slug, // Wrong tenant
    })

    response.assertStatus(403)
    assert.equal(response.body().success, false)
  })

  // ================================================================================================
  // 2. ROLE ASSIGNMENT ISOLATION TESTS
  // ================================================================================================

  test('should only assign roles within same tenant', async ({ client, assert }) => {
    // Admin A should be able to assign roles in tenant A
    const responseA = await client
      .post('/api/users/1/roles')
      .headers({
        'Authorization': `Bearer ${adminTokenA}`,
        'X-Tenant-Slug': tenantA.slug,
      })
      .json({
        userId: testUser.id,
        roleName: 'manager',
      })

    responseA.assertStatus(200)
    assert.equal(responseA.body().success, true)

    // Verify role was assigned in tenant A
    const userRolesA = await rbacService.getUserRoles(testUser, tenantA.id)
    assert.lengthOf(userRolesA, 1)
    assert.equal(userRolesA[0].name, 'manager')
    assert.equal(userRolesA[0].tenantId, tenantA.id)

    // Verify no role was assigned in tenant B
    const userRolesB = await rbacService.getUserRoles(testUser, tenantB.id)
    assert.lengthOf(userRolesB, 0)
  })

  test('should not assign roles across tenants', async ({ client, assert }) => {
    // Admin A should not be able to assign roles using admin B's token
    const response = await client
      .post('/api/users/1/roles')
      .headers({
        'Authorization': `Bearer ${adminTokenA}`,
        'X-Tenant-Slug': tenantB.slug, // Wrong tenant
      })
      .json({
        userId: testUser.id,
        roleName: 'customer',
      })

    response.assertStatus(403)
    assert.equal(response.body().success, false)
  })

  test('should handle same user in multiple tenants independently', async ({ client, assert }) => {
    // Assign manager role in tenant A
    await client
      .post('/api/users/1/roles')
      .headers({
        'Authorization': `Bearer ${adminTokenA}`,
        'X-Tenant-Slug': tenantA.slug,
      })
      .json({
        userId: crossTenantUser.id,
        roleName: 'manager',
      })

    // Assign customer role in tenant B
    await client
      .post('/api/users/1/roles')
      .headers({
        'Authorization': `Bearer ${adminTokenB}`,
        'X-Tenant-Slug': tenantB.slug,
      })
      .json({
        userId: crossTenantUser.id,
        roleName: 'customer',
      })

    // Verify roles in tenant A
    const rolesA = await rbacService.getUserRoles(crossTenantUser, tenantA.id)
    assert.lengthOf(rolesA, 1)
    assert.equal(rolesA[0].name, 'manager')

    // Verify roles in tenant B
    const rolesB = await rbacService.getUserRoles(crossTenantUser, tenantB.id)
    assert.lengthOf(rolesB, 1)
    assert.equal(rolesB[0].name, 'customer')

    // Verify no roles in tenant C
    const rolesC = await rbacService.getUserRoles(crossTenantUser, tenantC.id)
    assert.lengthOf(rolesC, 0)
  })

  // ================================================================================================
  // 3. ROLE REMOVAL ISOLATION TESTS
  // ================================================================================================

  test('should only remove roles from same tenant', async ({ client, assert }) => {
    // First assign roles in both tenants
    await client
      .post('/api/users/1/roles')
      .headers({
        'Authorization': `Bearer ${adminTokenA}`,
        'X-Tenant-Slug': tenantA.slug,
      })
      .json({
        userId: crossTenantUser.id,
        roleName: 'staff',
      })

    await client
      .post('/api/users/1/roles')
      .headers({
        'Authorization': `Bearer ${adminTokenB}`,
        'X-Tenant-Slug': tenantB.slug,
      })
      .json({
        userId: crossTenantUser.id,
        roleName: 'staff',
      })

    // Remove role from tenant A only
    const response = await client
      .post('/api/roles/remove')
      .headers({
        'Authorization': `Bearer ${adminTokenA}`,
        'X-Tenant-Slug': tenantA.slug,
      })
      .json({
        userId: crossTenantUser.id,
        roleName: 'staff',
      })

    response.assertStatus(200)
    assert.equal(response.body().success, true)

    // Verify role was removed from tenant A
    const rolesA = await rbacService.getUserRoles(crossTenantUser, tenantA.id)
    const staffRolesA = rolesA.filter((role) => role.name === 'staff')
    assert.lengthOf(staffRolesA, 0)

    // Verify role still exists in tenant B
    const rolesB = await rbacService.getUserRoles(crossTenantUser, tenantB.id)
    const staffRolesB = rolesB.filter((role) => role.name === 'staff')
    assert.lengthOf(staffRolesB, 1)
  })

  // ================================================================================================
  // 4. PERMISSION CHECK ISOLATION TESTS
  // ================================================================================================

  test('should check permissions only within tenant context', async ({ assert }) => {
    // Assign admin role in tenant A only
    const adminRoleA = await Role.query()
      .where('name', 'admin')
      .where('tenant_id', tenantA.id)
      .firstOrFail()

    await crossTenantUser.related('roles').attach({
      [adminRoleA.id]: { tenant_id: tenantA.id },
    })

    // Should have admin access in tenant A
    assert.isTrue(await rbacService.canAccess(crossTenantUser, 'customer', tenantA.id))
    assert.isTrue(await rbacService.canAccess(crossTenantUser, 'manager', tenantA.id))
    assert.isTrue(await rbacService.canAccess(crossTenantUser, 'admin', tenantA.id))

    // Should NOT have admin access in tenant B (no roles there)
    assert.isFalse(await rbacService.canAccess(crossTenantUser, 'customer', tenantB.id))
    assert.isFalse(await rbacService.canAccess(crossTenantUser, 'manager', tenantB.id))
    assert.isFalse(await rbacService.canAccess(crossTenantUser, 'admin', tenantB.id))

    // Should NOT have admin access in tenant C (no roles there)
    assert.isFalse(await rbacService.canAccess(crossTenantUser, 'customer', tenantC.id))
    assert.isFalse(await rbacService.canAccess(crossTenantUser, 'manager', tenantC.id))
    assert.isFalse(await rbacService.canAccess(crossTenantUser, 'admin', tenantC.id))
  })

  test('should handle different permissions per tenant', async ({ assert }) => {
    // Assign different roles in different tenants
    const adminRoleA = await Role.query()
      .where('name', 'admin')
      .where('tenant_id', tenantA.id)
      .firstOrFail()

    const customerRoleB = await Role.query()
      .where('name', 'customer')
      .where('tenant_id', tenantB.id)
      .firstOrFail()

    const managerRoleC = await Role.query()
      .where('name', 'manager')
      .where('tenant_id', tenantC.id)
      .firstOrFail()

    await crossTenantUser.related('roles').attach({
      [adminRoleA.id]: { tenant_id: tenantA.id },
      [customerRoleB.id]: { tenant_id: tenantB.id },
      [managerRoleC.id]: { tenant_id: tenantC.id },
    })

    // Check permissions in tenant A (admin level)
    assert.isTrue(await rbacService.canAccess(crossTenantUser, 'customer', tenantA.id))
    assert.isTrue(await rbacService.canAccess(crossTenantUser, 'manager', tenantA.id))
    assert.isTrue(await rbacService.canAccess(crossTenantUser, 'admin', tenantA.id))
    assert.isFalse(await rbacService.canAccess(crossTenantUser, 'super_admin', tenantA.id))

    // Check permissions in tenant B (customer level)
    assert.isTrue(await rbacService.canAccess(crossTenantUser, 'customer', tenantB.id))
    assert.isFalse(await rbacService.canAccess(crossTenantUser, 'staff', tenantB.id))
    assert.isFalse(await rbacService.canAccess(crossTenantUser, 'manager', tenantB.id))
    assert.isFalse(await rbacService.canAccess(crossTenantUser, 'admin', tenantB.id))

    // Check permissions in tenant C (manager level)
    assert.isTrue(await rbacService.canAccess(crossTenantUser, 'customer', tenantC.id))
    assert.isTrue(await rbacService.canAccess(crossTenantUser, 'staff', tenantC.id))
    assert.isTrue(await rbacService.canAccess(crossTenantUser, 'manager', tenantC.id))
    assert.isFalse(await rbacService.canAccess(crossTenantUser, 'admin', tenantC.id))
  })

  // ================================================================================================
  // 5. DEFAULT ROLE ISOLATION TESTS
  // ================================================================================================

  test('should assign default roles per tenant', async ({ assert }) => {
    const newUser = await User.create({
      email: 'defaulttest@tenant.com',
      password: 'password123',
      status: 'active',
    })

    // Assign default role in tenant A
    await rbacService.assignDefaultRole(newUser, tenantA.id)

    // Assign default role in tenant B
    await rbacService.assignDefaultRole(newUser, tenantB.id)

    // Check roles in tenant A
    const rolesA = await rbacService.getUserRoles(newUser, tenantA.id)
    assert.lengthOf(rolesA, 1)
    assert.equal(rolesA[0].name, 'customer')
    assert.equal(rolesA[0].tenantId, tenantA.id)

    // Check roles in tenant B
    const rolesB = await rbacService.getUserRoles(newUser, tenantB.id)
    assert.lengthOf(rolesB, 1)
    assert.equal(rolesB[0].name, 'customer')
    assert.equal(rolesB[0].tenantId, tenantB.id)

    // Verify role IDs are different (tenant isolation)
    assert.notEqual(rolesA[0].id, rolesB[0].id)
  })

  // ================================================================================================
  // 6. CROSS-TENANT ATTACK PREVENTION TESTS
  // ================================================================================================

  test('should prevent accessing other tenant data with valid token', async ({
    client,
    assert,
  }) => {
    // Try to use tenant A admin token to access tenant B data
    const response = await client.get('/api/roles').headers({
      'Authorization': `Bearer ${adminTokenA}`, // Valid token for tenant A
      'X-Tenant-Slug': tenantB.slug, // But trying to access tenant B
    })

    response.assertStatus(403)
    assert.equal(response.body().success, false)
  })

  test('should prevent role assignment across tenants', async ({ client, assert }) => {
    // Try to assign role in tenant B using tenant A admin
    const response = await client
      .post('/api/users/1/roles')
      .headers({
        'Authorization': `Bearer ${adminTokenA}`,
        'X-Tenant-Slug': tenantB.slug,
      })
      .json({
        userId: testUser.id,
        roleName: 'admin',
      })

    response.assertStatus(403)
    assert.equal(response.body().success, false)

    // Verify no role was assigned in tenant B
    const rolesB = await rbacService.getUserRoles(testUser, tenantB.id)
    const adminRoles = rolesB.filter((role) => role.name === 'admin')
    assert.lengthOf(adminRoles, 0)
  })

  test('should prevent role removal across tenants', async ({ client, assert }) => {
    // First assign a role in tenant B
    await client
      .post('/api/users/1/roles')
      .headers({
        'Authorization': `Bearer ${adminTokenB}`,
        'X-Tenant-Slug': tenantB.slug,
      })
      .json({
        userId: testUser.id,
        roleName: 'manager',
      })

    // Try to remove role from tenant B using tenant A admin
    const response = await client
      .post('/api/roles/remove')
      .headers({
        'Authorization': `Bearer ${adminTokenA}`,
        'X-Tenant-Slug': tenantB.slug,
      })
      .json({
        userId: testUser.id,
        roleName: 'manager',
      })

    response.assertStatus(403)
    assert.equal(response.body().success, false)

    // Verify role still exists in tenant B
    const rolesB = await rbacService.getUserRoles(testUser, tenantB.id)
    const managerRoles = rolesB.filter((role) => role.name === 'manager')
    assert.lengthOf(managerRoles, 1)
  })

  // ================================================================================================
  // 7. ROLE FINDING ISOLATION TESTS
  // ================================================================================================

  test('should find roles only within tenant', async ({ assert }) => {
    // Find manager role in tenant A
    const managerRoleA = await Role.findByName('manager', tenantA.id)
    assert.isNotNull(managerRoleA)
    assert.equal(managerRoleA!.name, 'manager')
    assert.equal(managerRoleA!.tenantId, tenantA.id)

    // Find manager role in tenant B
    const managerRoleB = await Role.findByName('manager', tenantB.id)
    assert.isNotNull(managerRoleB)
    assert.equal(managerRoleB!.name, 'manager')
    assert.equal(managerRoleB!.tenantId, tenantB.id)

    // Should be different role instances
    assert.notEqual(managerRoleA!.id, managerRoleB!.id)

    // Try to find non-existent role
    const nonExistentRole = await Role.findByName('non_existent', tenantA.id)
    assert.isNull(nonExistentRole)
  })

  test('should get default roles per tenant', async ({ assert }) => {
    const defaultRoleA = await Role.getDefaultRole(tenantA.id)
    assert.isNotNull(defaultRoleA)
    assert.equal(defaultRoleA!.name, 'customer')
    assert.equal(defaultRoleA!.tenantId, tenantA.id)
    assert.isTrue(defaultRoleA!.isDefault)

    const defaultRoleB = await Role.getDefaultRole(tenantB.id)
    assert.isNotNull(defaultRoleB)
    assert.equal(defaultRoleB!.name, 'customer')
    assert.equal(defaultRoleB!.tenantId, tenantB.id)
    assert.isTrue(defaultRoleB!.isDefault)

    // Should be different role instances
    assert.notEqual(defaultRoleA!.id, defaultRoleB!.id)
  })
})
