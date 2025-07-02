import { Exception } from '@adonisjs/core/exceptions'
import { CreateTenantDto, UpdateTenantDto } from '../dtos/tenant_dto.js'
import Tenant from '../models/tenant.js'

export default class TenantService {
  async findById(id: number): Promise<Tenant | null> {
    return await Tenant.find(id)
  }

  async paginate(page: number = 1, limit: number = 10) {
    return await Tenant.query().paginate(page, limit)
  }

  async create(dto: CreateTenantDto): Promise<Tenant> {
    const slug = dto.slug || (await this.generateSlug(dto.name))

    // Check if slug already exists
    const existingTenant = await this.findBySlug(slug)
    if (existingTenant) {
      throw new Exception('Slug already exists', {
        status: 409,
        code: 'E_SLUG_EXISTS',
      })
    }

    const tenantDto = {
      name: dto.name,
      slug: slug,
      domain: dto.domain || null,
      description: dto.description || null,
      logo: dto.logo || null,
      settings: dto.settings || {},
      status: dto.status || 'active',
    }
    return await Tenant.create(tenantDto)
  }

  async update(id: number, dto: UpdateTenantDto): Promise<Tenant> {
    const tenant = await Tenant.findOrFail(id)
    tenant.merge(dto)
    await tenant.save()
    return tenant
  }

  async delete(id: number): Promise<void> {
    const tenant = await Tenant.findOrFail(id)
    await tenant.delete()
  }

  async findBy(field: string, value: any): Promise<Tenant | null> {
    return await Tenant.findBy(field, value)
  }

  async findBySlug(slug: string): Promise<Tenant | null> {
    return await Tenant.findBy('slug', slug)
  }

  async generateSlug(name: string): Promise<string> {
    const baseSlug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
    let slug = baseSlug
    let counter = 1

    while (await this.findBySlug(slug)) {
      slug = `${baseSlug}-${counter}`
      counter++
    }

    return slug
  }

  async findManyBy(field: string, value: any): Promise<Tenant[]> {
    return await Tenant.query().where(field, value)
  }
}
