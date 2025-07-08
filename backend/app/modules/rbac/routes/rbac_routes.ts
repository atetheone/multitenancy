import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
const RbacController = () => import('../controllers/rbac_controller.js')

export default function rbacRoutes() {
  // ================================================================================================
  // READ-ONLY ROUTES (For all authenticated users with basic permissions)
  // ================================================================================================

  router
    .group(() => {
      // Role endpoints
      router.get('/roles', [RbacController, 'listRoles'])

      // Permission endpoints
      router.get('/permissions', [RbacController, 'listPermissions'])
      router.get('/permissions/grouped', [RbacController, 'getGroupedPermissions'])

      // Role-Permission relationships
      router.get('/roles/:roleId/permissions', [RbacController, 'getRolePermissions'])

      // User utility endpoints
      router.get('/users/:userId/permissions', [RbacController, 'getUserPermissions'])
      router.post('/users/:userId/check-permission', [RbacController, 'checkUserPermission'])
    })
    .prefix('/api/rbac')
    .use([
      middleware.auth(),
      middleware.tenant(),
      middleware.permission(['read:permission', 'read:role', 'read:*']), // Basic read access
    ])

  // ================================================================================================
  // ROLE MANAGEMENT ROUTES (Admin/Manager access)
  // ================================================================================================

  router
    .group(() => {
      // Role CRUD
      router.post('/roles', [RbacController, 'createRole'])

      // Role assignment
      router.post('/users/:userId/roles', [RbacController, 'assignRoles'])
      router.delete('/users/:userId/roles', [RbacController, 'removeRole'])
    })
    .prefix('/api/rbac')
    .use([
      middleware.auth(),
      middleware.tenant(),
      middleware.permission(['manage:role', 'manage:*']), // Admin access for role management
    ])

  // ================================================================================================
  // PERMISSION MANAGEMENT ROUTES (Admin-only access)
  // ================================================================================================

  router
    .group(() => {
      // Permission CRUD
      router.post('/permissions', [RbacController, 'createPermission'])
      router.post('/permissions/bulk', [RbacController, 'createResourcePermissions'])
      router.put('/permissions/:id', [RbacController, 'updatePermission'])
      router.delete('/permissions/:id', [RbacController, 'deletePermission'])

      // Role-Permission Management
      router.post('/roles/:roleId/permissions', [RbacController, 'assignPermissionsToRole'])
      router.post('/roles/:roleId/permissions/add', [RbacController, 'addPermissionsToRole'])
      router.delete('/roles/:roleId/permissions', [RbacController, 'removePermissionsFromRole'])
    })
    .prefix('/api/rbac')
    .use([
      middleware.auth(),
      middleware.tenant(),
      middleware.permission(['manage:permission', 'manage:*']), // Admin-only permission management
    ])
}
