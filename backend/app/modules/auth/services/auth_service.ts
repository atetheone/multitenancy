import User from '#modules/user/models/user'
import { DateTime } from 'luxon'
import { Exception } from '@adonisjs/core/exceptions'
import { LoginDto, RegisterDto, AuthResponseDto, UserResponseDto } from '../dtos/auth_dto.js'
import { inject } from '@adonisjs/core'
import { HttpContext } from '@adonisjs/core/http'
import RoleService from '#modules/rbac/services/role_service'

@inject()
export default class AuthService {
  constructor(
    protected ctx: HttpContext,
    protected roleService: RoleService
  ) {}

  get user() {
    return this.ctx.auth.getUserOrFail()
  }

  async authenticate(credentials: LoginDto): Promise<AuthResponseDto> {
    try {
      const user = await User.verifyCredentials(credentials.email, credentials.password)

      await this.validateUserStatus(user)

      // Generate JWT token
      const token = (await this.ctx.auth.use('jwt').generate(user)) as {
        token: string
        expiresIn: number
      }

      // Create refresh token
      const refreshToken = await User.refreshTokens.create(user)

      await this.updateLoginInfo(user)

      return {
        user: user.serialize() as UserResponseDto,
        token: {
          accessToken: token.token,
          refreshToken: refreshToken.value!.release(),
          expiresIn: token.expiresIn || 3600,
        },
      }
    } catch (error) {
      // If it's a credentials error, throw 401
      if (error.code === 'E_INVALID_CREDENTIALS' || error.status === 400) {
        throw new Exception('Invalid credentials', {
          status: 401,
          code: 'E_INVALID_CREDENTIALS',
        })
      }
      throw error
    }
  }

  async register(data: RegisterDto): Promise<AuthResponseDto> {
    const existingUser = await User.findBy('email', data.email)
    if (existingUser) {
      throw new Exception('Email already exists', {
        status: 409,
        code: 'E_EMAIL_EXISTS',
      })
    }

    const user = await User.create({
      email: data.email,
      password: data.password,
      status: 'active',
    })

    await user.related('profile').create({
      firstName: data.firstName,
      lastName: data.lastName,
    })

    // Associate user with current tenant
    const tenant = this.ctx.request.tenant
    if (tenant) {
      await user.related('tenants').attach([tenant.id])
    }

    // Assign default role if available
    await this.roleService.assignDefaultRole(user, this.ctx.request.tenantId!) // Use events  later

    // Send verification email if enabled

    // Generate JWT token
    const tokenResult = (await this.ctx.auth.use('jwt').generate(user)) as {
      token: string
      expiresIn: number
    }

    const token = tokenResult as { token: string; expiresIn: number }

    // Create refresh token
    const refreshToken = await User.refreshTokens.create(user)

    return {
      user: user.serialize() as UserResponseDto,
      token: {
        accessToken: token.token,
        refreshToken: refreshToken.value!.release(),
        expiresIn: token.expiresIn,
      },
    }
  }

  async logout(): Promise<void> {
    // For JWT, we just need to let the client handle token removal
    // Server-side logout would require blacklisting tokens
    // For now, we'll just return success as JWT is stateless
    return Promise.resolve()
  }

  async getCurrentUser(): Promise<UserResponseDto> {
    const user = await this.user
    await user.load('profile')
    return user.serialize() as UserResponseDto
  }

  private async validateUserStatus(user: User): Promise<void> {
    if (user.status !== 'active') {
      throw new Exception('Account is not active', {
        status: 403,
        code: 'E_ACCOUNT_INACTIVE',
      })
    }
  }

  private async updateLoginInfo(user: User): Promise<void> {
    user.lastLoginAt = DateTime.now()
    await user.save()
  }

  async generateToken(user: User): Promise<string> {
    // Generate JWT token
    return this.ctx.auth
      .use('jwt')
      .generate(user)
      .then((result) => {
        if ('token' in result) {
          return result.token
        }
        throw new Exception('Failed to generate token', {
          status: 500,
          code: 'E_TOKEN_GENERATION_FAILED',
        })
      })
  }
}
