import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
const RoleController = () => import('../controllers/role_controller.js')

export default function rbacRoutes() {
  router
    .group(() => {
      // List roles (admin only)
      router.get('/roles', [RoleController, 'index'])
      router.post('/roles', [RoleController, 'create'])

      // Assign/remove roles (admin only)
      router.post('/users/:userId/roles', [RoleController, 'assignRoles'])
      router.delete('/users/:userId/roles', [RoleController, 'removeRole'])
    })
    .prefix('/api')
    .use([
      middleware.auth(),
      middleware.tenant(),
      middleware.permission(['manage:role', 'manage:*']), // Only admins can manage roles
    ])
}
