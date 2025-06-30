import { middleware } from '#start/kernel'
import router from '@adonisjs/core/services/router'
const AuthController = () => import('../controllers/auth_controller.js')

export default function authRoutes() {
  router
    .group(() => {
      // Public auth routes
      router.post('/login', [AuthController, 'login'])
      router.post('/register', [AuthController, 'register'])
      router.post('/refresh', [AuthController, 'refresh'])

      // Protected auth routes
      router
        .group(() => {
          router.get('/me', [AuthController, 'me'])
          router.post('/logout', [AuthController, 'logout'])
          router.post('/validate-token', [AuthController, 'validateToken'])
        })
        .use(middleware.auth())
    })
    .prefix('/api/auth')
}
