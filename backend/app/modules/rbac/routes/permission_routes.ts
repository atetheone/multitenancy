import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
const PermissionController = () => import('../controllers/permission_controller.js')

export default function permissionRoutes() {
  // Public permission routes (read-only for authorized users)
  router
    .group(() => {
      // List permissions (can be filtered by resource)
      router.get('/permissions', [PermissionController, 'index'])

      // Get permissions grouped by resource
      router.get('/permissions/grouped', [PermissionController, 'grouped'])

      // Get role permissions
      router.get('/roles/:roleId/permissions', [PermissionController, 'getRolePermissions'])

      // User permissions (get current user's permissions)
      router.get('/users/me/permissions', [PermissionController, 'getUserPermissions'])
    })
    .prefix('/api')
    .use([
      middleware.auth(),
      middleware.tenant(),
      middleware.permission(['read:permission', 'read:role', 'read:*']), // Basic read access
    ])

  // Admin-only routes for permission management
  router
    .group(() => {
      // Create single permission
      router.post('/permissions', [PermissionController, 'create'])

      // Create multiple permissions for a resource
      router.post('/permissions/bulk', [PermissionController, 'createBulk'])

      // Update permission
      router.put('/permissions/:id', [PermissionController, 'update'])

      // Delete permission
      router.delete('/permissions/:id', [PermissionController, 'destroy'])

      // Create default e-commerce permissions
      router.post('/permissions/defaults', [PermissionController, 'createDefaults'])

      // Role-Permission Management
      router.post('/roles/:roleId/permissions', [PermissionController, 'assignToRole'])
      router.post('/roles/:roleId/permissions/add', [PermissionController, 'addToRole'])
      router.delete('/roles/:roleId/permissions', [PermissionController, 'removeFromRole'])
    })
    .prefix('/api')
    .use([
      middleware.auth(),
      middleware.tenant(),
      middleware.permission(['manage:permission', 'manage:*']), // Only admins can modify permissions
    ])
}
