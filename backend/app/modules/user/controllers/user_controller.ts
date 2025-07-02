import type { HttpContext } from '@adonisjs/core/http'
import UserService from '../services/user_service.js'
import { userValidator } from '../validators/user_validator.js'
import { inject } from '@adonisjs/core'
import { Logger } from '@adonisjs/core/logger'
import User from '#modules/user/models/user'

@inject()
export default class UserController {
  constructor(
    private userService: UserService,
    private logger: Logger
  ) {}

  async index({ request, response }: HttpContext) {
    try {
      const page = request.input('page', 1)
      const limit = request.input('limit', 10)

      const users = await this.userService.paginate(page, limit)

      return response.json({
        success: true,
        data: users.toJSON().data,
        meta: {
          total: users.total,
          perPage: users.perPage,
          currentPage: users.currentPage,
          lastPage: users.lastPage,
        },
      })
    } catch (error) {
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des données',
        error: error.message,
      })
    }
  }

  async show({ params, response }: HttpContext) {
    try {
      const user = await this.userService.findById(params.id)

      if (!user) {
        return response.status(404).json({
          success: false,
          message: 'User non trouvé',
        })
      }

      return response.json({
        success: true,
        data: user,
      })
    } catch (error) {
      this.logger.error(`Error fetching user with ID ${params.id}: ${error.message}`, {
        userId: params.id,
      })
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération',
        error: error.message,
      })
    }
  }

  async store({ request, response }: HttpContext) {
    try {
      const data = await request.validateUsing(userValidator.create)
      const user = await this.userService.create(data)

      return response.status(201).json({
        success: true,
        message: 'User créé avec succès',
        data: user,
      })
    } catch (error) {
      this.logger.error(`Error creating user: ${error.message}`, { error })
      return response.status(error.status || 400).json({
        success: false,
        message: 'Erreur lors de la création',
        errors: error.messages || [error.message],
      })
    }
  }

  async update({ params, request, response }: HttpContext) {
    try {
      const data = await request.validateUsing(userValidator.update)
      const user = await this.userService.update(params.id, data)

      return response.json({
        success: true,
        message: 'User mis à jour avec succès',
        data: user,
      })
    } catch (error) {
      this.logger.error(`Error updating user with ID ${params.id}: ${error.message}`, {
        userId: params.id,
        error,
      })
      return response.status(400).json({
        success: false,
        message: 'Erreur lors de la mise à jour',
        errors: error.messages || [error.message],
      })
    }
  }

  async destroy({ params, response }: HttpContext) {
    try {
      await this.userService.delete(params.id)

      return response.json({
        success: true,
        message: 'User supprimé avec succès',
      })
    } catch (error) {
      this.logger.error(`Error deleting user with ID ${params.id}: ${error.message}`, {
        userId: params.id,
        error,
      })
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la suppression',
        error: error.message,
      })
    }
  }

  async updateProfile({ params, request, response, auth }: HttpContext) {
    try {
      const data = await request.validateUsing(userValidator.updateProfile)
      const userId = (auth?.user as User)?.id || params.id
      const user = await this.userService.updateProfile(userId, data)

      this.logger.info(`Profile updated for user ID: ${params.id}`, { userId: params.id })
      return response.json({
        success: true,
        message: 'Profil mis à jour avec succès',
        data: user,
      })
    } catch (error) {
      this.logger.error(`Error updating profile for user ID ${params.id}: ${error.message}`, {
        userId: params.id,
        error,
      })
      return response.status(400).json({
        success: false,
        message: 'Erreur lors de la mise à jour du profil',
        errors: error.messages || [error.message],
      })
    }
  }

  async getProfile({ response, auth }: HttpContext) {
    try {
      const userId = (auth.user as User).id
      const user = await this.userService.getProfile(userId)

      if (!user) {
        return response.status(404).json({
          success: false,
          message: 'Profil non trouvé',
        })
      }

      return response.json({
        success: true,
        data: user,
      })
    } catch (error) {
      this.logger.error(`Error fetching current user profile: ${error.message}`, { error })
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération du profil',
        error: error.message,
      })
    }
  }

  async changePassword({ request, response, auth }: HttpContext) {
    try {
      const userId = (auth.user as User).id
      const { currentPassword, newPassword } = await request.validateUsing(
        userValidator.changePassword
      )
      await this.userService.changePassword(userId, currentPassword, newPassword)

      return response.json({
        success: true,
        message: 'Mot de passe changé avec succès',
      })
    } catch (error) {
      this.logger.error(`Error changing password: ${error.message}`, { error })
      return response.status(400).json({
        success: false,
        message: 'Erreur lors du changement de mot de passe',
        errors: error.messages || [error.message],
      })
    }
  }
}
