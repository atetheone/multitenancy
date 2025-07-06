/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/
import AutoSwagger from 'adonis-autoswagger'
import swagger from '#config/swagger'
import router from '@adonisjs/core/services/router'
import authRoutes from '#modules/auth/routes/auth_routes'
import userRoutes from '#modules/user/routes/user_routes'
import tenantRoutes from '#modules/tenant/routes/tenant_routes'
import rbacRoutes from '#modules/rbac/routes/rbac_routes'

router.get('swagger', async () => {
  return AutoSwagger.default.docs(router.toJSON(), swagger)
})

router.get('docs', async () => {
  return AutoSwagger.default.ui('/swagger', swagger)
})

// Health check
router.get('/api/health', async () => {
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'ecommerce-backend',
  }
})

// API root
router.get('/', async () => {
  return {
    message: 'E-commerce Backend API',
    version: '1.0.0',
    documentation: '/docs',
  }
})

// Register module routes
authRoutes()
userRoutes()
tenantRoutes()
rbacRoutes()
