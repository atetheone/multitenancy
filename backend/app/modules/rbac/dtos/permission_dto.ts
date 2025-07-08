// DTOs for Permission module

export interface CreatePermissionDto {
  resource: string
  action: string
  description?: string
}

export interface UpdatePermissionDto {
  description?: string
}

export interface CreateBulkPermissionDto {
  resource: string
  actions: string[]
}

export interface AssignPermissionsDto {
  permissionIds: number[]
}

export interface PermissionResponseDto {
  id: number
  name: string
  resource: string
  action: string
  description: string | null
  tenantId: number
  createdAt: string
  updatedAt: string
}

export interface GroupedPermissionsResponseDto {
  [resource: string]: PermissionResponseDto[]
}

export interface RolePermissionsResponseDto {
  roleId: number
  roleName: string
  permissions: PermissionResponseDto[]
}

export interface UserPermissionsResponseDto {
  userId: number
  permissions: PermissionResponseDto[]
  roles: {
    id: number
    name: string
    displayName: string
  }[]
}

export interface PermissionListResponseDto {
  data: PermissionResponseDto[]
  meta?: {
    total: number
    perPage: number
    currentPage: number
    lastPage: number
  }
}

export interface PermissionQueryDto {
  resource?: string
  action?: string
  page?: number
  limit?: number
  search?: string
}