import type { HttpContext } from '@adonisjs/core/http'
import RbacService from '#modules/rbac/services/rbac_service'
import { rbacValidator } from '../validators/rbac_validator.js'
import { inject } from '@adonisjs/core'

@inject()
export default class RoleController {
  constructor(private rbacService: RbacService) {}

  // List roles for current tenant
  async index({ response, request }: HttpContext) {
    try {
      const tenantId = request.tenantId!
      const roles = await this.rbacService.getRolesByTenant(tenantId)

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
  async create({ request, response, auth }: HttpContext) {
    try {
      const { name, displayName, tenantId } = await request.validateUsing(rbacValidator.create)
      const currentUser = await auth.getUserOrFail()
      const currentTenantId = request.tenantId!

      // Check if user can create roles in the specified tenant
      const targetTenantId = tenantId || currentTenantId
      const canManageTenant = await this.rbacService.canManageTenant(
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

      const role = await this.rbacService.createRole({
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

      const { roleIds, tenantId } = await request.validateUsing(rbacValidator.assignRoles)
      const currentUser = await auth.getUserOrFail()
      const currentTenantId = request.tenantId!

      // Check if user can assign roles to the specified tenant
      const canAssignToTenant = await this.rbacService.canManageTenant(
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

      const user = await this.rbacService.findUser(userId)
      await this.rbacService.assignRoles(user, roleIds, tenantId)

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

      const user = await this.rbacService.findUser(userId)
      await this.rbacService.removeRole(user, roleName, tenantId)

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
}
