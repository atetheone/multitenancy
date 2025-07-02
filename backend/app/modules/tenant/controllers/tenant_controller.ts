import type { HttpContext } from '@adonisjs/core/http'
import TenantService from '../services/tenant_service.js'
import { tenantValidator } from '../validators/tenant_validator.js'

export default class TenantController {
  private tenantService = new TenantService()

  async index({ request, response }: HttpContext) {
    try {
      const page = request.input('page', 1)
      const limit = request.input('limit', 10)

      const tenants = await this.tenantService.paginate(page, limit)

      return response.json({
        success: true,
        message: 'Liste des tenants récupérée avec succès',
        data: tenants.toJSON().data,
        meta: {
          total: tenants.total,
          perPage: tenants.perPage,
          currentPage: tenants.currentPage,
          lastPage: tenants.lastPage,
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
      const tenant = await this.tenantService.findById(params.id)

      if (!tenant) {
        return response.status(404).json({
          success: false,
          message: 'Tenant non trouvé',
        })
      }

      return response.json({
        success: true,
        message: 'Tenant récupéré avec succès',
        data: tenant,
      })
    } catch (error) {
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération',
        error: error.message,
      })
    }
  }

  async store({ request, response }: HttpContext) {
    const data = await request.validateUsing(tenantValidator.create)
    const tenant = await this.tenantService.create(data)

    return response.status(201).json({
      success: true,
      message: 'Tenant créé avec succès',
      data: tenant,
    })
  }

  async update({ params, request, response }: HttpContext) {
    try {
      const data = await request.validateUsing(tenantValidator.update)
      const tenant = await this.tenantService.update(params.id, data)

      return response.json({
        success: true,
        message: 'Tenant mis à jour avec succès',
        data: tenant,
      })
    } catch (error) {
      return response.status(400).json({
        success: false,
        message: 'Erreur lors de la mise à jour',
        errors: error.messages || [error.message],
      })
    }
  }

  async destroy({ params, response }: HttpContext) {
    try {
      await this.tenantService.delete(params.id)

      return response.status(204).json({
        success: true,
        message: 'Tenant supprimé avec succès',
      })
    } catch (error) {
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la suppression',
        error: error.message,
      })
    }
  }
}
