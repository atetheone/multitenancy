import { Exception } from '@adonisjs/core/exceptions'
import { DateTime } from 'luxon'
import { CreateUserDto, UpdateUserDto, UpdateUserProfileDto } from '../dtos/user.js'
import User from '../models/user.js'
import { inject } from '@adonisjs/core'
import { HttpContext } from '@adonisjs/core/http'

@inject()
export default class UserService {
  constructor(protected ctx: HttpContext) {}
  async findById(id: number): Promise<User | null> {
    return await User.find(id)
  }

  async paginate(page: number = 1, limit: number = 10) {
    return await User.query().paginate(page, limit)
  }

  async create(data: any): Promise<User> {
    const tenant = this.ctx.request.tenant
    
    // Check if user already exists
    const existingUser = await User.findBy('email', data.email)
    if (existingUser) {
      if (tenant) {
        // Check if user is already associated with this tenant
        await existingUser.load('tenants')
        const isAssociated = existingUser.tenants.some(t => t.id === tenant.id)
        
        if (isAssociated) {
          throw new Exception('Email already exists', {
            status: 409,
            code: 'E_EMAIL_EXISTS',
          })
        } else {
          // Associate existing user with new tenant
          await existingUser.related('tenants').attach([tenant.id])
          await existingUser.load('profile')
          return existingUser
        }
      } else {
        throw new Exception('Email already exists', {
          status: 409,
          code: 'E_EMAIL_EXISTS',
        })
      }
    }

    // Create new user
    const user = await User.create({
      email: data.email,
      password: data.password,
      status: 'active',
    })

    // Create profile if firstName/lastName provided
    if (data.firstName || data.lastName) {
      await user.related('profile').create({
        firstName: data.firstName,
        lastName: data.lastName,
      })
    }

    // Associate with tenant if available
    if (tenant) {
      await user.related('tenants').attach([tenant.id])
    }

    // Load profile for response
    await user.load('profile')
    return user
  }

  async update(id: number, Dto: UpdateUserDto): Promise<User> {
    const user = await User.findOrFail(id)
    user.merge(Dto)
    await user.save()
    return user
  }

  async delete(id: number): Promise<void> {
    const user = await User.findOrFail(id)
    await user.delete()
  }

  async findBy(field: string, value: any): Promise<User | null> {
    return await User.findBy(field, value)
  }

  async findManyBy(field: string, value: any): Promise<User[]> {
    return await User.query().where(field, value)
  }

  async updateProfile(userId: number, profileDto: UpdateUserProfileDto): Promise<User> {
    const user = await User.findOrFail(userId)

    const profile = await user.related('profile').query().firstOrFail()

    profile
      .merge({
        firstName: profileDto.firstName,
        lastName: profileDto.lastName,
        phone: profileDto.phone,
        dateOfBirth: profileDto.dateOfBirth ? DateTime.fromJSDate(profileDto.dateOfBirth) : null,
        profilePictureUrl: profileDto.profilePictureUrl,
      })
      .save()

    return user
  }

  async changePassword(
    userId: number,
    currentPassword: string,
    newPassword: string
  ): Promise<User> {
    // 1. Validate current password
    const user = await User.findOrFail(userId)

    if (!user) {
      throw new Exception('User not found', {
        code: 'E_USER_NOT_FOUND',
        status: 404,
      })
    }

    await User.verifyCredentials(user.email, currentPassword)

    // 2. Check if the new password is different from the current password
    if (currentPassword === newPassword) {
      throw new Exception('New password must be different from the current password', {
        code: 'E_PASSWORD_SAME',
        status: 400,
      })
    }

    // 4. Update the user's password (hashing auto handled)
    await user
      .merge({
        password: newPassword,
      })
      .save()

    return user
  }

  async getProfile(userId: number): Promise<User> {
    return await User.query().where('id', userId).preload('profile').firstOrFail()
  }
}
