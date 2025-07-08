import User from '#modules/user/models/user'
import AuthService from '#modules/auth/services/auth_service'
import app from '@adonisjs/core/services/app'

/**
 * Generate JWT token for testing purposes using AuthService
 */
export const generateToken = async (user: User): Promise<string> => {
  const ctx = await app.container.make('HttpContext')
  const authService = await app.container.make(AuthService, [ctx])

  return await authService.generateToken(user)
}

/**
 * Generate JWT token with expiration info using AuthService
 */
export const generateTokenWithExpiry = async (
  user: User
): Promise<{
  token: string
  expiresIn: number
}> => {
  const token = await generateToken(user)

  return {
    token,
    expiresIn: 3600, // Default expiration from JWT config
  }
}
