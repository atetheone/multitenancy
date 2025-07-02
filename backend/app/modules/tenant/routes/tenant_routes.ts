import { middleware } from '#start/kernel'
import router from '@adonisjs/core/services/router'
const TenantController = () => import('../controllers/tenant_controller.js')

export default function tenantRoutes() {
  router
    .group(() => {
      router.get('/', [TenantController, 'index'])
      router.get('/:id', [TenantController, 'show'])
      router.post('/', [TenantController, 'store'])
      router.put('/:id', [TenantController, 'update'])
      router.delete('/:id', [TenantController, 'destroy'])
    })
    .prefix('/api/tenants')
    // No tenant middleware - these are platform/admin level operations
}
