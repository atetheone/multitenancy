import Tenant from '../models/tenant.js'

export interface CreateTenantData {
  name: string
  slug: string
  domain?: string
  description?: string
  logo?: string
  settings?: Record<string, any>
  status?: 'active' | 'inactive' | 'suspended'
}

export interface UpdateTenantData {
  name?: string
  slug?: string
  domain?: string
  description?: string
  logo?: string
  settings?: Record<string, any>
  status?: 'active' | 'inactive' | 'suspended'
}

export default class TenantService {
  async findById(id: number): Promise<Tenant | null> {
    return await Tenant.find(id)
  }

  async paginate(page: number = 1, limit: number = 10) {
    return await Tenant.query().paginate(page, limit)
  }

  async create(data: CreateTenantData): Promise<Tenant> {
    const slug = data.slug || (await this.generateSlug(data.name))

    const tenantData = {
      name: data.name,
      slug: slug,
      domain: data.domain || null,
      description: data.description || null,
      logo: data.logo || null,
      settings: data.settings || {},
      status: data.status || 'active',
    }
    return await Tenant.create(tenantData)
  }

  async update(id: number, data: UpdateTenantData): Promise<Tenant> {
    const tenant = await Tenant.findOrFail(id)
    tenant.merge(data)
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
