import User from '#modules/user/models/user'
import { DateTime } from 'luxon'
import { Exception } from '@adonisjs/core/exceptions'
import { LoginDto, RegisterDto, AuthResponseDto, UserResponseDto, TokenDto } from '../dtos/auth.js'
import { inject } from '@adonisjs/core'
import { HttpContext } from '@adonisjs/core/http'

@inject()
export default class AuthService {
  constructor(protected ctx: HttpContext) {}

  get user() {
    return this.ctx.auth.getUserOrFail()
  }

  async authenticate(credentials: LoginDto): Promise<AuthResponseDto> {
    const user = await User.verifyCredentials(credentials.email, credentials.password)

    await this.validateUserStatus(user)

    const token = await this.generateToken(user)

    await this.updateLoginInfo(user)

    return {
      user: user.serialize() as UserResponseDto,
      token,
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

    // For now, return without auth token generation for registration
    return {
      user: user.serialize() as UserResponseDto,
      token: {
        token: 'temp-token',
        expiresIn: 3600,
      },
    }
  }

  async logout(): Promise<void> {
    // With JWT, logout is handled client-side by discarding the token
    // For enhanced security, you could implement token blacklisting here
    // For now, we just return success - token invalidation happens client-side
    return
  }

  async refreshToken(expiredToken: string): Promise<TokenDto> {
    // Implementation depends on the refresh token strategy
    console.log('Refresh token:', expiredToken)
    throw new Exception('Refresh token implementation needed', {
      status: 501,
      code: 'E_NOT_IMPLEMENTED',
    })
  }

  async getCurrentUser(): Promise<UserResponseDto> {
    return this.user.serialize() as UserResponseDto
  }

  private async validateUserStatus(user: User): Promise<void> {
    if (user.status !== 'active') {
      throw new Exception('Account is not active', {
        status: 403,
        code: 'E_ACCOUNT_INACTIVE',
      })
    }
  }

  private async generateToken(user: User): Promise<TokenDto> {
    const token = (await this.ctx.auth.use('jwt').generate(user)) as TokenDto

    return {
      token: token.token,
      expiresIn: token.expiresIn,
    }
  }

  private async updateLoginInfo(user: User): Promise<void> {
    user.lastLoginAt = DateTime.now()
    await user.save()
  }
}
