// DTOs for Auth module

export interface LoginDto {
  email: string
  password: string
}

export interface RegisterDto {
  email: string
  password: string
  firstName: string
  lastName: string
}

export interface AuthResponseDto {
  user: UserResponseDto
  token: TokenDto
}

export interface UserResponseDto {
  id: number
  email: string
  status: 'active' | 'inactive' | 'suspended'
  lastLoginAt: string | null
  createdAt: string
  updatedAt: string
}

export interface TokenDto {
  token: string
  refreshToken?: string
  expiresIn: number
}

export interface RefreshTokenDto {
  refreshToken: string
}
