import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { Exception } from '@adonisjs/core/exceptions'
import User from '#modules/user/models/user'

export default class RoleMiddleware {
  /**
   * Simple role check
   * Usage: .middleware(['auth', 'role:admin'])
   */
  async handle(ctx: HttpContext, next: NextFn, roles: string[]) {
    const { auth, response } = ctx

    try {
      const user = (await auth.getUserOrFail()) as User
      const tenantId = ctx.request.tenantId

      if (!tenantId) {
        throw new Exception('Tenant context required', { status: 400 })
      }

      // Check if user has any of the required roles
      let hasRequiredRole = false
      for (const roleName of roles) {
        if (await this.hasRole(user, roleName, tenantId)) {
          hasRequiredRole = true
          break
        }
      }

      if (!hasRequiredRole) {
        throw new Exception('Access denied', { status: 403 })
      }

      await next()
    } catch (error) {
      return response.status(error.status || 403).json({
        success: false,
        message: error.message,
      })
    }
  }

  async hasRole(user: User, roleName: string, tenantId: number): Promise<boolean> {
    // Check if user has the specified role in the given tenant
    const role = await user
      .related('roles')
      .query()
      .where('name', roleName)
      .where('tenant_id', tenantId)
      .first()
    return !!role
  }
}
