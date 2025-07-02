import type { HttpContext } from '@adonisjs/core/http'
import AuthService from '../services/auth_service.js'
import { loginValidator, registerValidator } from '../validators/auth_validator.js'
import { inject } from '@adonisjs/core'

@inject()
export default class AuthController {
  constructor(private authService: AuthService) {}

  /**
   * Register a new user
   * POST /api/auth/register
   */
  async register({ request, response }: HttpContext) {
    try {
      const data = await request.validateUsing(registerValidator)
      const result = await this.authService.register(data)

      return response.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: result,
      })
    } catch (error) {
      return response.status(error.status || 400).json({
        success: false,
        message: 'Registration failed',
        error: error.message,
        code: error.code,
        errors: error.messages || undefined,
      })
    }
  }

  /**
   * Login user
   * POST /api/auth/login
   */
  async login({ request, response }: HttpContext) {
    try {
      // Simple, working auth flow:
      // 1. Login → Get access token + refresh token
      // 2. Use access token for API calls
      // 3. When access token expires → Use refresh token to get new one
      // 4. Logout → Delete refresh token
      const data = await request.validateUsing(loginValidator)
      const result = await this.authService.authenticate(data)

      return response.json({
        success: true,
        message: 'Login successful',
        data: result,
      })
    } catch (error) {
      return response.status(error.status || 401).json({
        success: false,
        message: 'Login failed',
        error: error.message,
        code: error.code,
      })
    }
  }

  /**
   * Logout user
   * POST /api/auth/logout
   */
  async logout({ response }: HttpContext) {
    try {
      await this.authService.logout()

      return response.json({
        success: true,
        message: 'Logout successful',
      })
    } catch (error) {
      return response.status(error.status || 500).json({
        success: false,
        message: 'Logout failed',
        error: error.message,
        code: error.code,
      })
    }
  }

  /**
   * Refresh access token
   * POST /api/auth/refresh
   */
  async refresh({ auth, response }: HttpContext) {
    try {
      // Reads refresh token from Authorization header automatically
      const user = await auth.use('jwt').authenticateWithRefreshToken()
      const newRefreshToken = user.currentToken
      const newToken = (await auth.use('jwt').generate(user)) as {
        token: string
        expiresIn: number
      }

      return response.json({
        success: true,
        data: {
          accessToken: newToken.token || newToken,
          refreshToken: newRefreshToken,
          expiresIn: newToken.expiresIn || 3600,
        },
      })
    } catch (error) {
      return response.status(error.status | 401).json({
        success: false,
        message: 'Token refresh failed',
        error: error.message,
        code: error.code,
      })
    }
  }

  /**
   * Get current authenticated user
   * GET /api/auth/me
   */
  async me({ response }: HttpContext) {
    try {
      const user = await this.authService.getCurrentUser()

      return response.json({
        success: true,
        data: user,
      })
    } catch (error) {
      return response.status(error.status || 401).json({
        success: false,
        message: 'Unauthorized',
        error: error.message,
        code: error.code,
      })
    }
  }
}
