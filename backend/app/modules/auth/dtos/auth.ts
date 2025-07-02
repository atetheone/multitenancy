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
export interface TokenDto {
  accessToken: string
  refreshToken: string
  expiresIn: number
  tokenType?: string
}

export interface RefreshTokenDto {
  refreshToken: string
}

export interface RefreshTokenDto {
  refreshToken: string
}

export interface ValidateTokenDto {
  token: string
}

export interface RevokeTokenDto {
  refreshToken: string
}

// Response DTOs
export interface TokenValidationResponseDto {
  valid: boolean
  user?: UserResponseDto
  expiresAt?: string
}

export interface UserResponseDto {
  id: number
  email: string
  status: 'active' | 'inactive' | 'suspended'
  lastLoginAt: string | null
  createdAt: string
  updatedAt: string
  profile?: {
    id: number
    firstName: string | null
    lastName: string | null
    phone: string | null
    profilePictureUrl: string | null
  }
}
