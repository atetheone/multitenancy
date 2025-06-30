import '@adonisjs/core'
import Tenant from '#modules/tenant/models/tenant'

declare module '@adonisjs/core/http' {
  interface Request {
    tenant?: Tenant
  }
}
