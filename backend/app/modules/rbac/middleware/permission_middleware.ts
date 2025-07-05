import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { Exception } from '@adonisjs/core/exceptions'
import { inject } from '@adonisjs/core'
import User from '#modules/user/models/user'
import PermissionService from '#modules/rbac/services/permission_service'

@inject()
export default class PermissionMiddleware {
  constructor(private permissionService: PermissionService) {}

  /**
   * Permission-based access control middleware
   * Usage: .middleware(['auth', 'tenant', 'permission:read:product'])
   * Usage: .middleware(['auth', 'tenant', 'permission:*:product'])
   * Usage: .middleware(['auth', 'tenant', 'permission:manage:*'])
   */
  async handle(ctx: HttpContext, next: NextFn, permissions: string[]) {
    const { auth, response, request } = ctx

    try {
      const user = (await auth.getUserOrFail()) as User
      const tenantId = request.tenantId

      if (!tenantId) {
        throw new Exception('Tenant context required', { status: 400 })
      }

      // Check if user has any of the required permissions
      const hasPermission = await this.permissionService.hasAnyPermission(
        user,
        permissions,
        tenantId
      )

      if (!hasPermission) {
        // Check for wildcard permissions
        const hasWildcardPermission = await this.checkWildcardPermissions(
          user,
          permissions,
          tenantId
        )

        if (!hasWildcardPermission) {
          throw new Exception(`Access denied. Required permissions: ${permissions.join(' or ')}`, {
            status: 403,
          })
        }
      }

      await next()
    } catch (error) {
      return response.status(error.status || 403).json({
        success: false,
        message: error.message,
      })
    }
  }

  /**
   * Check for wildcard permissions like '*:product' or 'read:*'
   */
  private async checkWildcardPermissions(
    user: User,
    requiredPermissions: string[],
    tenantId: number
  ): Promise<boolean> {
    const userPermissions = await this.permissionService.getUserPermissions(user, tenantId)

    return requiredPermissions.some((requiredPermission) => {
      return userPermissions.some((userPermission) => {
        // Check if user permission matches the required permission pattern
        return userPermission.matches(requiredPermission)
      })
    })
  }

  /**
   * Simplified resource access check
   * Usage: .middleware(['auth', 'tenant', 'can:read:product'])
   */
  async can(ctx: HttpContext, next: NextFn, [actionResource]: [string]) {
    const { auth, response, request } = ctx

    try {
      const user = (await auth.getUserOrFail()) as User
      const tenantId = request.tenantId

      if (!tenantId) {
        throw new Exception('Tenant context required', { status: 400 })
      }

      const [action, resource] = actionResource.split(':')

      if (!action || !resource) {
        throw new Exception('Invalid permission format. Use action:resource', { status: 400 })
      }

      const canAccess = await this.permissionService.canAccessResource(
        user,
        resource,
        action,
        tenantId
      )

      if (!canAccess) {
        throw new Exception(`Access denied. Cannot ${action} ${resource}`, { status: 403 })
      }

      await next()
    } catch (error) {
      return response.status(error.status || 403).json({
        success: false,
        message: error.message,
      })
    }
  }

  /**
   * Admin access check (requires manage:user or manage:* permissions)
   * Usage: .middleware(['auth', 'tenant', 'admin'])
   */
  async admin(ctx: HttpContext, next: NextFn) {
    const { auth, response, request } = ctx

    try {
      const user = (await auth.getUserOrFail()) as User
      const tenantId = request.tenantId

      if (!tenantId) {
        throw new Exception('Tenant context required', { status: 400 })
      }

      const adminPermissions = ['manage:user', 'manage:*', 'manage:tenant']

      const isAdmin = await this.permissionService.hasAnyPermission(
        user,
        adminPermissions,
        tenantId
      )

      if (!isAdmin) {
        throw new Exception('Admin access required', { status: 403 })
      }

      await next()
    } catch (error) {
      return response.status(error.status || 403).json({
        success: false,
        message: error.message,
      })
    }
  }

  /**
   * Super admin access check (requires manage:* permission)
   * Usage: .middleware(['auth', 'tenant', 'superAdmin'])
   */
  async superAdmin(ctx: HttpContext, next: NextFn) {
    const { auth, response, request } = ctx

    try {
      const user = (await auth.getUserOrFail()) as User
      const tenantId = request.tenantId

      if (!tenantId) {
        throw new Exception('Tenant context required', { status: 400 })
      }

      const isSuperAdmin = await this.permissionService.hasPermission(user, 'manage:*', tenantId)

      if (!isSuperAdmin) {
        throw new Exception('Super admin access required', { status: 403 })
      }

      await next()
    } catch (error) {
      return response.status(error.status || 403).json({
        success: false,
        message: error.message,
      })
    }
  }

  /**
   * Owner or admin access check
   * Allows access if user owns the resource or has admin permissions
   */
  async ownerOrAdmin(ctx: HttpContext, next: NextFn) {
    const { auth, response, request } = ctx

    try {
      const user = (await auth.getUserOrFail()) as User
      const tenantId = request.tenantId
      const resourceUserId = request.param('userId') || request.input('userId')

      if (!tenantId) {
        throw new Exception('Tenant context required', { status: 400 })
      }

      // Check if user is accessing their own resource
      const isOwner = user.id.toString() === resourceUserId?.toString()

      if (isOwner) {
        await next()
        return
      }

      // Check if user has admin permissions
      const adminPermissions = ['manage:user', 'manage:*']
      const isAdmin = await this.permissionService.hasAnyPermission(
        user,
        adminPermissions,
        tenantId
      )

      if (!isAdmin) {
        throw new Exception('Access denied. Owner or admin access required', { status: 403 })
      }

      await next()
    } catch (error) {
      return response.status(error.status || 403).json({
        success: false,
        message: error.message,
      })
    }
  }
}
