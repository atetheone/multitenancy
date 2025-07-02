export interface CreateTenantDto {
  name: string
  slug?: string
  domain?: string
  description?: string
  logo?: string
  settings?: Record<string, any>
  status?: 'active' | 'inactive' | 'suspended'
}

export interface UpdateTenantDto extends Partial<CreateTenantDto> {}
