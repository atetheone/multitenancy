import User from '#modules/user/models/user'
import Role from '#modules/rbac/models/role'
import Permission from '#modules/rbac/models/permission'
import { Exception } from '@adonisjs/core/exceptions'
import { inject } from '@adonisjs/core'

@inject()
export default class PermissionService {
  // Get all permissions for a tenant
  async getPermissionsByTenant(tenantId: number): Promise<Permission[]> {
    return await Permission.getByTenant(tenantId)
  }

  // Get permissions by resource
  async getPermissionsByResource(resource: string, tenantId: number): Promise<Permission[]> {
    return await Permission.getByResource(resource, tenantId)
  }

  // Create a new permission
  async createPermission(data: {
    resource: string
    action: string
    tenantId: number
    description?: string
  }): Promise<Permission> {
    const existing = await Permission.findByResourceAction(
      data.resource,
      data.action,
      data.tenantId
    )
    if (existing) {
      throw new Exception(`Permission ${data.resource}:${data.action} already exists`, {
        status: 409,
      })
    }

    return await Permission.createPermission(
      data.resource,
      data.action,
      data.tenantId,
      data.description
    )
  }

  // Create permissions for a resource
  async createResourcePermissions(
    resource: string,
    actions: string[],
    tenantId: number
  ): Promise<Permission[]> {
    // Check for existing permissions
    const existing = await Permission.query()
      .where('resource', resource)
      .where('tenant_id', tenantId)
      .whereIn('action', actions)

    if (existing.length > 0) {
      const existingActions = existing.map((p) => p.action)
      throw new Exception(
        `Permissions already exist for ${resource}: ${existingActions.join(', ')}`,
        { status: 409 }
      )
    }

    return await Permission.createResourcePermissions(resource, actions, tenantId)
  }

  // Update permission
  async updatePermission(
    id: number,
    tenantId: number,
    data: { description?: string }
  ): Promise<Permission> {
    const permission = await Permission.query()
      .where('id', id)
      .where('tenant_id', tenantId)
      .firstOrFail()

    permission.merge(data)
    await permission.save()
    return permission
  }

  // Delete permission
  async deletePermission(id: number, tenantId: number): Promise<void> {
    const permission = await Permission.query()
      .where('id', id)
      .where('tenant_id', tenantId)
      .firstOrFail()

    await permission.delete()
  }

  // Assign permissions to role
  async assignPermissionsToRole(
    roleId: number,
    permissionIds: number[],
    tenantId: number
  ): Promise<void> {
    const role = await Role.query().where('id', roleId).where('tenant_id', tenantId).firstOrFail()

    // Validate that all permissions exist in the tenant
    const permissions = await Permission.query()
      .whereIn('id', permissionIds)
      .where('tenant_id', tenantId)

    if (permissions.length !== permissionIds.length) {
      throw new Exception('Some permissions do not exist in the specified tenant', { status: 404 })
    }

    // Remove existing permissions and assign new ones
    await role.related('permissions').detach()
    await role.related('permissions').attach(permissionIds)
  }

  // Add permissions to role (without removing existing ones)
  async addPermissionsToRole(
    roleId: number,
    permissionIds: number[],
    tenantId: number
  ): Promise<void> {
    const role = await Role.query().where('id', roleId).where('tenant_id', tenantId).firstOrFail()

    // Validate that all permissions exist in the tenant
    const permissions = await Permission.query()
      .whereIn('id', permissionIds)
      .where('tenant_id', tenantId)

    if (permissions.length !== permissionIds.length) {
      throw new Exception('Some permissions do not exist in the specified tenant', { status: 404 })
    }

    // Add permissions to role
    await role.related('permissions').attach(permissionIds)
  }

  // Remove permissions from role
  async removePermissionsFromRole(
    roleId: number,
    permissionIds: number[],
    tenantId: number
  ): Promise<void> {
    const role = await Role.query().where('id', roleId).where('tenant_id', tenantId).firstOrFail()

    await role.related('permissions').detach(permissionIds)
  }

  // Get all permissions for a role
  async getRolePermissions(roleId: number, tenantId: number): Promise<Permission[]> {
    const role = await Role.query()
      .where('id', roleId)
      .where('tenant_id', tenantId)
      .preload('permissions')
      .firstOrFail()

    return role.permissions
  }

  // Get all permissions for a user (through their roles)
  async getUserPermissions(user: User, tenantId: number): Promise<Permission[]> {
    await user.load('roles', (query) => {
      query.where('tenant_id', tenantId).preload('permissions')
    })

    const allPermissions: Permission[] = []
    for (const role of user.roles) {
      allPermissions.push(...role.permissions)
    }

    // Remove duplicates
    const uniquePermissions = allPermissions.filter(
      (permission, index, self) => index === self.findIndex((p) => p.id === permission.id)
    )

    return uniquePermissions
  }

  // Check if user has specific permission
  async hasPermission(user: User, permissionName: string, tenantId: number): Promise<boolean> {
    const userPermissions = await this.getUserPermissions(user, tenantId)
    return userPermissions.some(
      (permission) => permission.name === permissionName || permission.matches(permissionName)
    )
  }

  // Check if user has any of the specified permissions
  async hasAnyPermission(
    user: User,
    permissionNames: string[],
    tenantId: number
  ): Promise<boolean> {
    const userPermissions = await this.getUserPermissions(user, tenantId)

    return permissionNames.some((permissionName) =>
      userPermissions.some(
        (permission) => permission.name === permissionName || permission.matches(permissionName)
      )
    )
  }

  // Check if user has all specified permissions
  async hasAllPermissions(
    user: User,
    permissionNames: string[],
    tenantId: number
  ): Promise<boolean> {
    const userPermissions = await this.getUserPermissions(user, tenantId)

    return permissionNames.every((permissionName) =>
      userPermissions.some(
        (permission) => permission.name === permissionName || permission.matches(permissionName)
      )
    )
  }

  // Check if user can perform action on resource
  async canAccessResource(
    user: User,
    resource: string,
    action: string,
    tenantId: number
  ): Promise<boolean> {
    const permissionName = `${action}:${resource}`
    return await this.hasPermission(user, permissionName, tenantId)
  }

  // Create default e-commerce permissions for a tenant
  async createEcommercePermissions(tenantId: number): Promise<Permission[]> {
    const resources = [
      'user',
      'role',
      'permission',
      'tenant',
      'product',
      'category',
      'order',
      'cart',
      'payment',
      'delivery',
      'analytics',
      'inventory',
      'customer',
      'report',
    ]

    const actions = ['create', 'read', 'update', 'delete', 'manage']
    const allPermissions: Permission[] = []

    for (const resource of resources) {
      try {
        const permissions = await this.createResourcePermissions(resource, actions, tenantId)
        allPermissions.push(...permissions)
      } catch (error) {
        // Skip if permissions already exist
        if (error.status !== 409) {
          throw error
        }
      }
    }

    return allPermissions
  }

  // Get permissions grouped by resource
  async getPermissionsGroupedByResource(tenantId: number): Promise<Record<string, Permission[]>> {
    const permissions = await this.getPermissionsByTenant(tenantId)
    const grouped: Record<string, Permission[]> = {}

    for (const permission of permissions) {
      if (!grouped[permission.resource]) {
        grouped[permission.resource] = []
      }
      grouped[permission.resource].push(permission)
    }

    return grouped
  }
}
