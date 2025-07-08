// DTOs for Role module

export interface CreateRoleDto {
  name: string
  displayName?: string
  tenantId?: number
  isDefault?: boolean
}

export interface UpdateRoleDto {
  displayName?: string
  isDefault?: boolean
}

export interface AssignRoleDto {
  roleIds: number[]
  tenantId: number
}

export interface RoleResponseDto {
  id: number
  name: string
  displayName: string
  tenantId: number
  isDefault: boolean
  createdAt: string
  updatedAt: string
  permissions?: PermissionSummaryDto[]
  userCount?: number
}

export interface PermissionSummaryDto {
  id: number
  name: string
  resource: string
  action: string
  description: string | null
}

export interface RoleWithPermissionsDto extends RoleResponseDto {
  permissions: PermissionSummaryDto[]
}

export interface RoleListResponseDto {
  data: RoleResponseDto[]
  meta?: {
    total: number
    perPage: number
    currentPage: number
    lastPage: number
  }
}

export interface RoleQueryDto {
  page?: number
  limit?: number
  search?: string
  includePermissions?: boolean
  includeUserCount?: boolean
}
