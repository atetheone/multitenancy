import { middleware } from '#start/kernel'
import router from '@adonisjs/core/services/router'
const UserController = () => import('../controllers/user_controller.js')

export default function userRoutes() {
  router
    .group(() => {
      // User management (admin/protected)
      router.get('/', [UserController, 'index'])
      router.get('/:id', [UserController, 'show'])
      router.post('/', [UserController, 'store'])
      router.put('/:id', [UserController, 'update'])
      router.delete('/:id', [UserController, 'destroy'])

      // Profile management (self-service)
      router.get('/me/profile', [UserController, 'getProfile'])
      router.put('/me/profile', [UserController, 'updateProfile'])
      router.put('/me/change-password', [UserController, 'changePassword'])

      // User specific profile management
      router.put('/:id/profile', [UserController, 'updateProfile'])
    })
    .prefix('/api/users')
    .use(middleware.auth())
}
