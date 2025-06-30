import Tenant from '../models/tenant.js'

export interface CreateTenantData {
  // TODO: Define interface based on your model
  name: string
}

export interface UpdateTenantData {
  // TODO: Define interface based on your model
  name?: string
}

export default class TenantService {
  async findById(id: number): Promise<Tenant | null> {
    return await Tenant.find(id)
  }

  async paginate(page: number = 1, limit: number = 10) {
    return await Tenant.query().paginate(page, limit)
  }

  async create(data: CreateTenantData): Promise<Tenant> {
    return await Tenant.create(data)
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

  async findManyBy(field: string, value: any): Promise<Tenant[]> {
    return await Tenant.query().where(field, value)
  }
}
