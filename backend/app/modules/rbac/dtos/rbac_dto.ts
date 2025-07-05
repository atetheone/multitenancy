// DTOs for Rbac module

export interface CreateRbacDto {
  // TODO: Add properties for creating rbac
  name: string
}

export interface UpdateRbacDto extends Partial<CreateRbacDto> {
  // TODO: Add additional update-specific properties if needed
}

export interface RbacResponseDto {
  id: number
  name: string
  createdAt: string
  updatedAt: string
  // TODO: Add response properties
}

export interface RbacListResponseDto {
  data: RbacResponseDto[]
  meta: {
    total: number
    perPage: number
    currentPage: number
    lastPage: number
  }
}

export interface RbacQueryDto {
  page?: number
  limit?: number
  search?: string
  // TODO: Add query parameters for filtering/sorting
}