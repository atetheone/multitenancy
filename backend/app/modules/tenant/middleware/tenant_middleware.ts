import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { Exception } from '@adonisjs/core/exceptions'
import Tenant from '#modules/tenant/models/tenant'

export default class TenantMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    let tenant = null

    // 1. Try to get tenant from X-Tenant-Slug header
    const tenantSlug = ctx.request.header('X-Tenant-Slug')

    if (tenantSlug) {
      tenant = await Tenant.findBy('slug', tenantSlug)
    }

    // 2. Try to get from subdomain if no header (e.g., apple-store.myplatform.com)
    if (!tenant) {
      const host = ctx.request.header('host')
      if (host && host.includes('.')) {
        const subdomain = host.split('.')[0]
        tenant = await Tenant.findBy('slug', subdomain)
      }
    }

    // 3. Try to get from custom domain (e.g., shop.apple.com)
    if (!tenant) {
      const host = ctx.request.header('host')
      if (host) {
        tenant = await Tenant.findBy('domain', host)
      }
    }

    if (!tenant) {
      throw new Exception('Tenant not found', {
        status: 404,
        code: 'E_TENANT_NOT_FOUND',
      })
    }

    if (tenant.status !== 'active') {
      throw new Exception('Tenant is not active', {
        status: 403,
        code: 'E_TENANT_INACTIVE',
      })
    }

    // Attach tenant to request context
    ctx.request.tenant = tenant

    await next()
  }
}
