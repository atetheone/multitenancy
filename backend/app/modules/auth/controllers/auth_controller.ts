import type { HttpContext } from '@adonisjs/core/http'
import AuthService from '../services/auth_service.js'
import {
  loginValidator,
  registerValidator,
  refreshTokenValidator,
} from '../validators/auth_validator.js'
import { inject } from '@adonisjs/core'

@inject()
export default class AuthController {
  constructor(private authService: AuthService) {}

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
      return response.status(400).json({
        success: false,
        message: 'Registration failed',
        errors: error.messages || [error.message],
      })
    }
  }

  async login({ request, response }: HttpContext) {
    try {
      const data = await request.validateUsing(loginValidator)
      const result = await this.authService.authenticate(data)

      return response.json({
        success: true,
        message: 'Login successful',
        data: result,
      })
    } catch (error) {
      // Check if it's an inactive account error to return proper status
      if (error.code === 'E_ACCOUNT_INACTIVE') {
        return response.status(403).json({
          success: false,
          message: 'Account is not active',
          error: error.message,
        })
      }

      return response.status(401).json({
        success: false,
        message: 'Login failed',
        error: error.message,
      })
    }
  }

  async logout({ response }: HttpContext) {
    try {
      await this.authService.logout()

      return response.json({
        success: true,
        message: 'Logout successful',
      })
    } catch (error) {
      return response.status(500).json({
        success: false,
        message: 'Logout failed',
        error: error.message,
      })
    }
  }

  async refresh({ request, response }: HttpContext) {
    try {
      const { refreshToken } = await request.validateUsing(refreshTokenValidator)
      const result = await this.authService.refreshToken(refreshToken)

      return response.json({
        success: true,
        message: 'Token refreshed successfully',
        data: result,
      })
    } catch (error) {
      return response.status(401).json({
        success: false,
        message: 'Token refresh failed',
        error: error.message,
      })
    }
  }

  async me({ response }: HttpContext) {
    try {
      const user = await this.authService.getCurrentUser()

      return response.json({
        success: true,
        data: user,
      })
    } catch (error) {
      return response.status(401).json({
        success: false,
        message: 'Unauthorized',
        error: error.message,
      })
    }
  }

  async validateToken({ response }: HttpContext) {
    try {
      const user = await this.authService.getCurrentUser()

      return response.json({
        success: true,
        message: 'Token is valid',
        data: {
          valid: true,
          user: user,
        },
      })
    } catch (error) {
      return response.status(401).json({
        success: false,
        message: 'Token is invalid',
        data: {
          valid: false,
        },
      })
    }
  }
}
