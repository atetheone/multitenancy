// ================================================================================================
// RBAC TENANT ISOLATION TESTS - Updated for Unified Module
// ================================================================================================

import { test } from '@japa/runner'
import User from '#modules/user/models/user'
import Role from '#modules/rbac/models/role'
import Permission from '#modules/rbac/models/permission'
import Tenant from '#modules/tenant/models/tenant'
import RoleService from '#modules/rbac/services/role_service'
import PermissionService from '#modules/rbac/services/permission_service'
import testUtils from '@adonisjs/core/services/test_utils'

test.group('RBAC - Tenant Isolation', (group) => {
  let roleService: RoleService
  let permissionService: PermissionService
  let tenantA: Tenant
  let tenantB: Tenant
  let adminUserA: User
  let adminUserB: User
  let adminTokenA: string
  let adminTokenB: string

  group.each.setup(() => testUtils.db().truncate())

  group.setup(async () => {
    permissionService = new PermissionService()
    roleService = new RoleService(permissionService)

    // Create two separate tenants
    tenantA = await Tenant.create({
      name: 'Tenant A Store',
      slug: 'tenant-a',
      status: 'active',
    })

    tenantB = await Tenant.create({
      name: 'Tenant B Store',
      slug: 'tenant-b',
      status: 'active',
    })

    // Create default roles and permissions for both tenants
    await roleService.createDefaultRoles(tenantA.id)
    await roleService.createDefaultRoles(tenantB.id)

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

    await adminUserA.related('tenants').attach([tenantA.id])
    await roleService.assignRole(adminUserA, 'admin', tenantA.id)

    adminUserB = await User.create({
      email: 'admin@tenant-b.com',
      password: 'password123',
      status: 'active',
    })

    await adminUserB.related('profile').create({
      firstName: 'Admin',
      lastName: 'B',
    })

    await adminUserB.related('tenants').attach([tenantB.id])
    await roleService.assignRole(adminUserB, 'admin', tenantB.id)

    // Generate tokens
    const app = await import('@adonisjs/core/services/app')
    const ctx = app.default.container.make('HttpContext')
    
    const tokenObjA = await ctx.auth.use('jwt').generate(adminUserA)
    const tokenObjB = await ctx.auth.use('jwt').generate(adminUserB)
    
    adminTokenA = tokenObjA.token
    adminTokenB = tokenObjB.token
  })

  test('should isolate roles between tenants', async ({ assert }) => {
    const rolesA = await Role.query().where('tenant_id', tenantA.id)
    const rolesB = await Role.query().where('tenant_id', tenantB.id)

    // Both tenants should have same number of default roles
    assert.equal(rolesA.length, rolesB.length)

    // But role IDs should be different
    const roleIdsA = rolesA.map(r => r.id)
    const roleIdsB = rolesB.map(r => r.id)
    
    const intersection = roleIdsA.filter(id => roleIdsB.includes(id))
    assert.lengthOf(intersection, 0, 'Role IDs should not overlap between tenants')

    // Role names should be the same but for different tenants
    const roleNamesA = rolesA.map(r => r.name).sort()
    const roleNamesB = rolesB.map(r => r.name).sort()
    assert.deepEqual(roleNamesA, roleNamesB, 'Role names should be consistent across tenants')
  })

  test('should isolate permissions between tenants', async ({ assert }) => {
    const permissionsA = await Permission.query().where('tenant_id', tenantA.id)
    const permissionsB = await Permission.query().where('tenant_id', tenantB.id)

    // Both tenants should have same number of default permissions
    assert.approximately(permissionsA.length, permissionsB.length, 5)

    // But permission IDs should be different
    const permissionIdsA = permissionsA.map(p => p.id)
    const permissionIdsB = permissionsB.map(p => p.id)
    
    const intersection = permissionIdsA.filter(id => permissionIdsB.includes(id))
    assert.lengthOf(intersection, 0, 'Permission IDs should not overlap between tenants')

    // Permission names should be the same but for different tenants
    const permissionNamesA = permissionsA.map(p => p.name).sort()
    const permissionNamesB = permissionsB.map(p => p.name).sort()
    assert.deepEqual(permissionNamesA, permissionNamesB, 'Permission names should be consistent across tenants')
  })

  test('should prevent cross-tenant role access via API', async ({ client }) => {
    // Admin A should only see roles from Tenant A
    const responseA = await client
      .get('/api/rbac/roles')
      .header('Authorization', `Bearer ${adminTokenA}`)
      .header('X-Tenant-Slug', tenantA.slug)

    responseA.assertStatus(200)
    const rolesA = responseA.body().data

    // Admin B should only see roles from Tenant B
    const responseB = await client
      .get('/api/rbac/roles')
      .header('Authorization', `Bearer ${adminTokenB}`)
      .header('X-Tenant-Slug', tenantB.slug)

    responseB.assertStatus(200)
    const rolesB = responseB.body().data

    // Should have same number of roles but different IDs
    assert.equal(rolesA.length, rolesB.length)
    
    const roleIdsA = rolesA.map((r: any) => r.id)
    const roleIdsB = rolesB.map((r: any) => r.id)
    
    const intersection = roleIdsA.filter((id: number) => roleIdsB.includes(id))
    assert.lengthOf(intersection, 0, 'API should not return cross-tenant roles')
  })

  test('should prevent cross-tenant permission access via API', async ({ client }) => {
    // Admin A should only see permissions from Tenant A
    const responseA = await client
      .get('/api/rbac/permissions')
      .header('Authorization', `Bearer ${adminTokenA}`)
      .header('X-Tenant-Slug', tenantA.slug)

    responseA.assertStatus(200)
    const permissionsA = responseA.body().data

    // Admin B should only see permissions from Tenant B
    const responseB = await client
      .get('/api/rbac/permissions')
      .header('Authorization', `Bearer ${adminTokenB}`)
      .header('X-Tenant-Slug', tenantB.slug)

    responseB.assertStatus(200)
    const permissionsB = responseB.body().data

    // Should have similar number of permissions but different IDs
    assert.approximately(permissionsA.length, permissionsB.length, 5)
    
    const permissionIdsA = permissionsA.map((p: any) => p.id)
    const permissionIdsB = permissionsB.map((p: any) => p.id)
    
    const intersection = permissionIdsA.filter((id: number) => permissionIdsB.includes(id))
    assert.lengthOf(intersection, 0, 'API should not return cross-tenant permissions')
  })

  test('should prevent cross-tenant user role assignment', async ({ client, assert }) => {
    // Create a user in Tenant A
    const userA = await User.create({
      email: 'user@tenant-a.com',
      password: 'password123',
      status: 'active',
    })

    await userA.related('tenants').attach([tenantA.id])

    // Get a role from Tenant B
    const roleBFromB = await Role.findByName('manager', tenantB.id)
    assert.isNotNull(roleBFromB)

    // Admin A should not be able to assign Tenant B's role to Tenant A's user
    const response = await client
      .post(`/api/rbac/users/${userA.id}/roles`)
      .header('Authorization', `Bearer ${adminTokenA}`)
      .header('X-Tenant-Slug', tenantA.slug)
      .json({
        roleIds: [roleBFromB!.id],
        tenantId: tenantA.id, // Trying to assign cross-tenant role
      })

    response.assertStatus(404) // Should fail because role doesn't exist in Tenant A
  })

  test('should handle multi-tenant user correctly', async ({ assert }) => {
    // Create a user that belongs to both tenants
    const multiTenantUser = await User.create({
      email: 'multi@both-tenants.com',
      password: 'password123',
      status: 'active',
    })

    await multiTenantUser.related('tenants').attach([tenantA.id, tenantB.id])

    // Assign different roles in each tenant
    await roleService.assignRole(multiTenantUser, 'manager', tenantA.id)
    await roleService.assignRole(multiTenantUser, 'staff', tenantB.id)

    // Check roles in Tenant A
    const rolesInA = await roleService.getUserRoles(multiTenantUser, tenantA.id)
    assert.lengthOf(rolesInA, 1)
    assert.equal(rolesInA[0].name, 'manager')

    // Check roles in Tenant B
    const rolesInB = await roleService.getUserRoles(multiTenantUser, tenantB.id)
    assert.lengthOf(rolesInB, 1)
    assert.equal(rolesInB[0].name, 'staff')

    // Verify permissions are different in each tenant
    const permissionsInA = await permissionService.getUserPermissions(multiTenantUser, tenantA.id)
    const permissionsInB = await permissionService.getUserPermissions(multiTenantUser, tenantB.id)

    // Should have different permission sets based on different roles
    const permissionNamesA = permissionsInA.map(p => p.name).sort()
    const permissionNamesB = permissionsInB.map(p => p.name).sort()
    
    // Manager and staff should have different permission sets
    assert.notDeepEqual(permissionNamesA, permissionNamesB)
  })

  test('should validate service-level tenant isolation', async ({ assert }) => {
    // Service methods should only return data for the specified tenant
    const rolesA = await roleService.getRolesByTenant(tenantA.id)
    const rolesB = await roleService.getRolesByTenant(tenantB.id)

    // Verify all roles belong to correct tenant
    rolesA.forEach(role => {
      assert.equal(role.tenantId, tenantA.id, `Role ${role.name} should belong to Tenant A`)
    })

    rolesB.forEach(role => {
      assert.equal(role.tenantId, tenantB.id, `Role ${role.name} should belong to Tenant B`)
    })

    // Same for permissions
    const permissionsA = await permissionService.getPermissionsByTenant(tenantA.id)
    const permissionsB = await permissionService.getPermissionsByTenant(tenantB.id)

    permissionsA.forEach(permission => {
      assert.equal(permission.tenantId, tenantA.id, `Permission ${permission.name} should belong to Tenant A`)
    })

    permissionsB.forEach(permission => {
      assert.equal(permission.tenantId, tenantB.id, `Permission ${permission.name} should belong to Tenant B`)
    })
  })
})