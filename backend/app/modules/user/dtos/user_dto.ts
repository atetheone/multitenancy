export interface CreateUserDto {
  email: string
  password: string
  fullName?: string
  status?: 'active' | 'inactive' | 'suspended'
}

export interface UpdateUserDto extends Partial<CreateUserDto> {}

export interface CreateUserProfileDto {
  firstName?: string
  lastName?: string
  phone?: string
  dateOfBirth?: Date
  profilePictureUrl?: string
}

export interface UpdateUserProfileDto extends Partial<CreateUserProfileDto> {}
