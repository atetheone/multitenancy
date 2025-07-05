import type { HttpContext } from '@adonisjs/core/http'
import PermissionService from '#modules/rbac/services/permission_service'
import { inject } from '@adonisjs/core'
import { permissionValidator } from '../validators/permission_validator.js'

@inject()
export default class PermissionController {
  constructor(private permissionService: PermissionService) {}

  // List permissions for current tenant
  async index({ response, request }: HttpContext) {
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
  async grouped({ response, request }: HttpContext) {
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

  // Create a single permission
  async create({ request, response }: HttpContext) {
    try {
      const data = await request.validateUsing(permissionValidator.create)
      const tenantId = request.tenantId!

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
      const status = error.status || 400
      return response.status(status).json({
        success: false,
        message: error.message,
      })
    }
  }

  // Create multiple permissions for a resource
  async createBulk({ request, response }: HttpContext) {
    try {
      const data = await request.validateUsing(permissionValidator.createBulk)
      const tenantId = request.tenantId!

      const permissions = await this.permissionService.createResourcePermissions(
        data.resource,
        data.actions,
        tenantId
      )

      return response.status(201).json({
        success: true,
        message: `${permissions.length} permissions created successfully`,
        data: permissions,
      })
    } catch (error) {
      const status = error.status || 400
      return response.status(status).json({
        success: false,
        message: error.message,
      })
    }
  }

  // Update permission
  async update({ request, response }: HttpContext) {
    try {
      const permissionId = request.param('id')
      const data = await request.validateUsing(permissionValidator.update)
      const tenantId = request.tenantId!

      const permission = await this.permissionService.updatePermission(permissionId, tenantId, data)

      return response.json({
        success: true,
        message: 'Permission updated successfully',
        data: permission,
      })
    } catch (error) {
      const status = error.status || 400
      return response.status(status).json({
        success: false,
        message: error.message,
      })
    }
  }

  // Delete permission
  async destroy({ request, response }: HttpContext) {
    try {
      const permissionId = request.param('id')
      const tenantId = request.tenantId!

      await this.permissionService.deletePermission(permissionId, tenantId)

      return response.json({
        success: true,
        message: 'Permission deleted successfully',
      })
    } catch (error) {
      const status = error.status || 400
      return response.status(status).json({
        success: false,
        message: error.message,
      })
    }
  }

  // Assign permissions to role
  async assignToRole({ request, response }: HttpContext) {
    try {
      const roleId = request.param('roleId')
      const data = await request.validateUsing(permissionValidator.assignToRole)
      const tenantId = request.tenantId!

      await this.permissionService.assignPermissionsToRole(roleId, data.permissionIds, tenantId)

      return response.json({
        success: true,
        message: 'Permissions assigned to role successfully',
      })
    } catch (error) {
      const status = error.status || 400
      return response.status(status).json({
        success: false,
        message: error.message,
      })
    }
  }

  // Add permissions to role (without removing existing)
  async addToRole({ request, response }: HttpContext) {
    try {
      const roleId = request.param('roleId')
      const data = await request.validateUsing(permissionValidator.assignToRole)
      const tenantId = request.tenantId!

      await this.permissionService.addPermissionsToRole(roleId, data.permissionIds, tenantId)

      return response.json({
        success: true,
        message: 'Permissions added to role successfully',
      })
    } catch (error) {
      const status = error.status || 400
      return response.status(status).json({
        success: false,
        message: error.message,
      })
    }
  }

  // Remove permissions from role
  async removeFromRole({ request, response }: HttpContext) {
    try {
      const roleId = request.param('roleId')
      const data = await request.validateUsing(permissionValidator.assignToRole)
      const tenantId = request.tenantId!

      await this.permissionService.removePermissionsFromRole(roleId, data.permissionIds, tenantId)

      return response.json({
        success: true,
        message: 'Permissions removed from role successfully',
      })
    } catch (error) {
      const status = error.status || 400
      return response.status(status).json({
        success: false,
        message: error.message,
      })
    }
  }

  // Get permissions for a role
  async getRolePermissions({ request, response }: HttpContext) {
    try {
      const roleId = request.param('roleId')
      const tenantId = request.tenantId!

      const permissions = await this.permissionService.getRolePermissions(roleId, tenantId)

      return response.json({
        success: true,
        data: permissions,
      })
    } catch (error) {
      const status = error.status || 400
      return response.status(status).json({
        success: false,
        message: error.message,
      })
    }
  }

  // Get user's permissions
  async getUserPermissions({ request, response, auth }: HttpContext) {
    try {
      const tenantId = request.tenantId!
      const user = await auth.getUserOrFail()

      const permissions = await this.permissionService.getUserPermissions(user, tenantId)

      return response.json({
        success: true,
        data: permissions,
      })
    } catch (error) {
      const status = error.status || 400
      return response.status(status).json({
        success: false,
        message: error.message,
      })
    }
  }

  // Create default e-commerce permissions
  async createDefaults({ request, response }: HttpContext) {
    try {
      const tenantId = request.tenantId!

      const permissions = await this.permissionService.createEcommercePermissions(tenantId)

      return response.status(201).json({
        success: true,
        message: `${permissions.length} default e-commerce permissions created`,
        data: permissions,
      })
    } catch (error) {
      return response.status(500).json({
        success: false,
        message: 'Failed to create default permissions',
      })
    }
  }
}
