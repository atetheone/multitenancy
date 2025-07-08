import type { HttpContext } from '@adonisjs/core/http'
import RoleService from '#modules/rbac/services/role_service'
import PermissionService from '#modules/rbac/services/permission_service'
import { roleValidator } from '../validators/role_validator.js'
import { permissionValidator } from '../validators/permission_validator.js'
import { inject } from '@adonisjs/core'

@inject()
export default class RbacController {
  constructor(
    private roleService: RoleService,
    private permissionService: PermissionService
  ) {}

  // ================================================================================================
  // ROLE MANAGEMENT
  // ================================================================================================

  // List roles for current tenant
  async listRoles({ response, request }: HttpContext) {
    try {
      const tenantId = request.tenantId!
      const roles = await this.roleService.getRolesByTenant(tenantId)

      return response.json({
        success: true,
        data: roles,
      })
    } catch (error) {
      return response.status(500).json({
        success: false,
        message: 'Failed to fetch roles',
      })
    }
  }

  // Create a new role
  async createRole({ request, response, auth }: HttpContext) {
    try {
      const { name, displayName, tenantId } = await request.validateUsing(roleValidator.create)
      const currentUser = await auth.getUserOrFail()
      const currentTenantId = request.tenantId!

      // Check if user can create roles in the specified tenant
      const targetTenantId = tenantId || currentTenantId
      const canManageTenant = await this.roleService.canManageTenant(
        currentUser,
        currentTenantId,
        targetTenantId
      )
      if (!canManageTenant) {
        return response.status(403).json({
          success: false,
          message: 'You do not have permission to create roles in this tenant',
        })
      }

      const role = await this.roleService.createRole({
        name,
        displayName,
        tenantId: targetTenantId,
        isDefault: false,
      })

      return response.status(201).json({
        success: true,
        message: 'Role created successfully',
        data: role,
      })
    } catch (error) {
      return response.status(400).json({
        success: false,
        message: error.message,
      })
    }
  }

  // Assign roles to user
  async assignRoles({ request, response, auth }: HttpContext) {
    try {
      const userId = request.param('userId')
      if (!userId) {
        return response.status(400).json({
          success: false,
          message: 'User ID is required',
        })
      }

      const { roleIds, tenantId } = await request.validateUsing(roleValidator.assignRoles)
      const currentUser = await auth.getUserOrFail()
      const currentTenantId = request.tenantId!

      // Check if user can assign roles to the specified tenant
      const canAssignToTenant = await this.roleService.canManageTenant(
        currentUser,
        currentTenantId,
        tenantId
      )
      if (!canAssignToTenant) {
        return response.status(403).json({
          success: false,
          message: 'You do not have permission to assign roles in this tenant',
        })
      }

      const user = await this.roleService.findUser(userId)
      await this.roleService.assignRoles(user, roleIds, tenantId)

      return response.json({
        success: true,
        message: 'Roles assigned successfully',
      })
    } catch (error) {
      return response.status(400).json({
        success: false,
        message: error.message,
      })
    }
  }

  // Remove role from user
  async removeRole({ request, response }: HttpContext) {
    try {
      const tenantId = request.tenantId!
      const userId = request.param('userId')
      const { roleName } = request.only(['roleName'])

      const user = await this.roleService.findUser(userId)
      await this.roleService.removeRole(user, roleName, tenantId)

      return response.json({
        success: true,
        message: 'Role removed successfully',
      })
    } catch (error) {
      return response.status(400).json({
        success: false,
        message: error.message,
      })
    }
  }

  // ================================================================================================
  // PERMISSION MANAGEMENT
  // ================================================================================================

  // List permissions for current tenant
  async listPermissions({ response, request }: HttpContext) {
    try {
      const tenantId = request.tenantId!
      const resource = request.input('resource')

      let permissions
      if (resource) {
        permissions = await this.permissionService.getPermissionsByResource(resource, tenantId)
      } else {
        permissions = await this.permissionService.getPermissionsByTenant(tenantId)
      }

      return response.json({
        success: true,
        data: permissions,
      })
    } catch (error) {
      return response.status(500).json({
        success: false,
        message: 'Failed to fetch permissions',
      })
    }
  }

  // Get permissions grouped by resource
  async getGroupedPermissions({ response, request }: HttpContext) {
    try {
      const tenantId = request.tenantId!
      const grouped = await this.permissionService.getPermissionsGroupedByResource(tenantId)

      return response.json({
        success: true,
        data: grouped,
      })
    } catch (error) {
      return response.status(500).json({
        success: false,
        message: 'Failed to fetch grouped permissions',
      })
    }
  }

  // Create a new permission
  async createPermission({ request, response }: HttpContext) {
    try {
      const tenantId = request.tenantId!
      const data = await request.validateUsing(permissionValidator.create)

      const permission = await this.permissionService.createPermission({
        ...data,
        tenantId,
      })

      return response.status(201).json({
        success: true,
        message: 'Permission created successfully',
        data: permission,
      })
    } catch (error) {
      return response.status(400).json({
        success: false,
        message: error.message,
      })
    }
  }

  // Create permissions for a resource
  async createResourcePermissions({ request, response }: HttpContext) {
    try {
      const tenantId = request.tenantId!
      const data = await request.validateUsing(permissionValidator.createBulk)

      const permissions = await this.permissionService.createResourcePermissions(
        data.resource,
        data.actions,
        tenantId
      )

      return response.status(201).json({
        success: true,
        message: 'Resource permissions created successfully',
        data: permissions,
      })
    } catch (error) {
      return response.status(400).json({
        success: false,
        message: error.message,
      })
    }
  }

  // Update permission
  async updatePermission({ request, response }: HttpContext) {
    try {
      const tenantId = request.tenantId!
      const permissionId = request.param('id')
      const data = await request.validateUsing(permissionValidator.update)

      const permission = await this.permissionService.updatePermission(permissionId, tenantId, data)

      return response.json({
        success: true,
        message: 'Permission updated successfully',
        data: permission,
      })
    } catch (error) {
      return response.status(400).json({
        success: false,
        message: error.message,
      })
    }
  }

  // Delete permission
  async deletePermission({ request, response }: HttpContext) {
    try {
      const tenantId = request.tenantId!
      const permissionId = request.param('id')

      await this.permissionService.deletePermission(permissionId, tenantId)

      return response.json({
        success: true,
        message: 'Permission deleted successfully',
      })
    } catch (error) {
      return response.status(400).json({
        success: false,
        message: error.message,
      })
    }
  }

  // ================================================================================================
  // ROLE-PERMISSION MANAGEMENT
  // ================================================================================================

  // Get permissions for a role
  async getRolePermissions({ request, response }: HttpContext) {
    try {
      const tenantId = request.tenantId!
      const roleId = request.param('roleId')

      const permissions = await this.permissionService.getRolePermissions(roleId, tenantId)

      return response.json({
        success: true,
        data: permissions,
      })
    } catch (error) {
      return response.status(400).json({
        success: false,
        message: error.message,
      })
    }
  }

  // Assign permissions to role
  async assignPermissionsToRole({ request, response }: HttpContext) {
    try {
      const tenantId = request.tenantId!
      const roleId = request.param('roleId')
      const data = await request.validateUsing(permissionValidator.assignToRole)

      await this.permissionService.assignPermissionsToRole(roleId, data.permissionIds, tenantId)

      return response.json({
        success: true,
        message: 'Permissions assigned to role successfully',
      })
    } catch (error) {
      return response.status(400).json({
        success: false,
        message: error.message,
      })
    }
  }

  // Add permissions to role (without removing existing)
  async addPermissionsToRole({ request, response }: HttpContext) {
    try {
      const tenantId = request.tenantId!
      const roleId = request.param('roleId')
      const data = await request.validateUsing(permissionValidator.assignToRole)

      await this.permissionService.addPermissionsToRole(roleId, data.permissionIds, tenantId)

      return response.json({
        success: true,
        message: 'Permissions added to role successfully',
      })
    } catch (error) {
      return response.status(400).json({
        success: false,
        message: error.message,
      })
    }
  }

  // Remove permissions from role
  async removePermissionsFromRole({ request, response }: HttpContext) {
    try {
      const tenantId = request.tenantId!
      const roleId = request.param('roleId')
      const data = await request.validateUsing(permissionValidator.assignToRole)

      await this.permissionService.removePermissionsFromRole(roleId, data.permissionIds, tenantId)

      return response.json({
        success: true,
        message: 'Permissions removed from role successfully',
      })
    } catch (error) {
      return response.status(400).json({
        success: false,
        message: error.message,
      })
    }
  }

  // ================================================================================================
  // USER PERMISSIONS (UTILITY ENDPOINTS)
  // ================================================================================================

  // Get user permissions
  async getUserPermissions({ request, response }: HttpContext) {
    try {
      const tenantId = request.tenantId!
      const userId = request.param('userId')

      const user = await this.roleService.findUser(userId)
      const permissions = await this.permissionService.getUserPermissions(user, tenantId)

      return response.json({
        success: true,
        data: permissions,
      })
    } catch (error) {
      return response.status(400).json({
        success: false,
        message: error.message,
      })
    }
  }

  // Check if user has permission
  async checkUserPermission({ request, response }: HttpContext) {
    try {
      const tenantId = request.tenantId!
      const userId = request.param('userId')
      const { permission } = request.only(['permission'])

      const user = await this.roleService.findUser(userId)
      const hasPermission = await this.permissionService.hasPermission(user, permission, tenantId)

      return response.json({
        success: true,
        data: { hasPermission },
      })
    } catch (error) {
      return response.status(400).json({
        success: false,
        message: error.message,
      })
    }
  }
}
