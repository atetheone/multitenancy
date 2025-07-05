import User from '#modules/user/models/user'
import Role from '#modules/rbac/models/role'
import Permission from '#modules/rbac/models/permission'
import PermissionService from '#modules/rbac/services/permission_service'
import { Exception } from '@adonisjs/core/exceptions'
import { inject } from '@adonisjs/core'

@inject()
export default class RbacService {
  constructor(private permissionService: PermissionService) {}

  // Get all roles for a tenant
  async getRolesByTenant(tenantId: number): Promise<Role[]> {
    return await Role.query().where('tenant_id', tenantId).orderBy('name')
  }

  // Create a new role
  async createRole(data: {
    name: string
    displayName?: string
    tenantId: number
    isDefault?: boolean
  }): Promise<Role> {
    return await Role.create({
      name: data.name,
      displayName: data.displayName || data.name,
      tenantId: data.tenantId,
      isDefault: data.isDefault || false,
    })
  }

  // Find user by ID
  async findUser(userId: number): Promise<User> {
    return await User.findOrFail(userId)
  }

  // Create basic roles for a tenant with proper permissions
  async createDefaultRoles(tenantId: number) {
    // First create default permissions
    try {
      await this.permissionService.createEcommercePermissions(tenantId)
    } catch (error) {
      // Permissions might already exist, continue
    }

    const roles = [
      { name: 'super_admin', displayName: 'Super Administrator', isDefault: false },
      { name: 'admin', displayName: 'Administrator', isDefault: false },
      { name: 'manager', displayName: 'Manager', isDefault: false },
      { name: 'staff', displayName: 'Staff', isDefault: false },
      { name: 'customer', displayName: 'Customer', isDefault: true },
    ]

    const createdRoles = []
    for (const roleData of roles) {
      const role = await Role.updateOrCreate(
        { name: roleData.name, tenantId },
        { ...roleData, tenantId }
      )
      createdRoles.push(role)
    }

    // Assign permissions to roles
    await this.assignDefaultPermissions(tenantId, createdRoles)

    return createdRoles
  }

  // Assign default permissions to roles
  private async assignDefaultPermissions(tenantId: number, roles: Role[]) {
    const permissions = await Permission.getByTenant(tenantId)

    for (const role of roles) {
      let permissionIds: number[] = []

      switch (role.name) {
        case 'super_admin':
          // Super admin gets all permissions
          permissionIds = permissions.map((p) => p.id)
          break

        case 'admin':
          // Admin gets all permissions except super admin ones
          permissionIds = permissions
            .filter((p) => !(p.action === 'manage' && p.resource === '*'))
            .map((p) => p.id)
          break

        case 'manager':
          // Manager gets read/update permissions and some management permissions
          permissionIds = permissions
            .filter(
              (p) =>
                ['read', 'update'].includes(p.action) ||
                (p.action === 'manage' && ['product', 'order', 'inventory'].includes(p.resource))
            )
            .map((p) => p.id)
          break

        case 'staff':
          // Staff gets read permissions and limited create/update
          permissionIds = permissions
            .filter(
              (p) =>
                p.action === 'read' ||
                (p.action === 'create' && ['order', 'cart'].includes(p.resource)) ||
                (p.action === 'update' && ['order', 'inventory'].includes(p.resource))
            )
            .map((p) => p.id)
          break

        case 'customer':
          // Customer gets limited read permissions and own data management
          permissionIds = permissions
            .filter(
              (p) =>
                (p.action === 'read' && ['product', 'category'].includes(p.resource)) ||
                (p.action === 'create' && ['cart', 'order'].includes(p.resource)) ||
                (p.action === 'update' && ['cart'].includes(p.resource))
            )
            .map((p) => p.id)
          break
      }

      if (permissionIds.length > 0) {
        try {
          await this.permissionService.assignPermissionsToRole(role.id, permissionIds, tenantId)
        } catch (error) {
          // Continue if permissions already assigned
        }
      }
    }
  }

  // Assign default role to new users
  async assignDefaultRole(user: User, tenantId: number) {
    const defaultRole = await Role.getDefaultRole(tenantId)
    if (defaultRole) {
      await this.assignRole(user, defaultRole.name, tenantId)
    }
  }

  async assignRole(user: User, roleName: string, tenantId: number) {
    // Check if role exists in the tenant
    const role = await Role.findByName(roleName, tenantId)
    if (!role) {
      throw new Exception(`Role "${roleName}" not found in tenant ${tenantId}`, { status: 404 })
    }

    // Assign role to user
    const existingRole = await user
      .related('roles')
      .query()
      .where('name', roleName)
      .where('tenant_id', tenantId)
      .first()

    if (!existingRole) {
      await user.related('roles').attach({
        [role.id]: {
          tenant_id: tenantId,
        },
      })
    }
  }

  async assignRoles(user: User, roleIds: number[], tenantId: number) {
    // Validate that all roles exist in the specified tenant
    const roles = await Role.query().whereIn('id', roleIds).where('tenant_id', tenantId)

    if (roles.length !== roleIds.length) {
      throw new Exception('Some roles do not exist in the specified tenant', { status: 404 })
    }

    // Remove existing roles for this user in this tenant
    await user.related('roles').query().where('tenant_id', tenantId).delete()

    // Assign new roles
    const attachData: Record<number, { tenant_id: number }> = {}
    roleIds.forEach((roleId) => {
      attachData[roleId] = { tenant_id: tenantId }
    })

    await user.related('roles').attach(attachData)
  }

  async canManageTenant(
    user: User,
    currentTenantId: number,
    targetTenantId: number
  ): Promise<boolean> {
    // Super admin can manage any tenant
    const isSuperAdmin = await this.permissionService.hasPermission(
      user,
      'manage:*',
      currentTenantId
    )
    if (isSuperAdmin) {
      return true
    }

    // Admin can only manage their own tenant
    if (currentTenantId === targetTenantId) {
      return await this.permissionService.hasPermission(user, 'manage:tenant', currentTenantId)
    }

    return false
  }

  async removeRole(user: User, roleName: string, tenantId: number) {
    // Check if role exists in the tenant
    const role = await Role.findByName(roleName, tenantId)
    if (!role) {
      throw new Exception(`Role "${roleName}" not found in tenant ${tenantId}`, { status: 404 })
    }

    // Remove role from user in the specified tenant
    await user
      .related('roles')
      .query()
      .where('role_id', role.id)
      .where('tenant_id', tenantId)
      .delete()
  }

  // Permission-based access check (replaces role hierarchy)
  async canAccess(user: User, requiredPermission: string, tenantId: number): Promise<boolean> {
    return await this.permissionService.hasPermission(user, requiredPermission, tenantId)
  }

  // Check if user can access resource with specific action
  async canAccessResource(
    user: User,
    resource: string,
    action: string,
    tenantId: number
  ): Promise<boolean> {
    return await this.permissionService.canAccessResource(user, resource, action, tenantId)
  }

  // Legacy role-based check (deprecated - use permission-based instead)
  async hasRole(user: User, requiredRole: string, tenantId: number): Promise<boolean> {
    const userRoles = await this.getUserRoles(user, tenantId)
    return userRoles.some((role) => role.name === requiredRole)
  }

  // Get user permissions (delegated to PermissionService)
  async getUserPermissions(user: User, tenantId: number) {
    return await this.permissionService.getUserPermissions(user, tenantId)
  }

  async getUserRoles(user: User, tenantId: number): Promise<Role[]> {
    // Load roles for the user in the specified tenant
    await user.load('roles', (query) => {
      query.where('tenant_id', tenantId)
    })
    return user.roles
  }
}
