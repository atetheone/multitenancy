export interface CreateUserDto {
  lastName: string
  firstName: string
  email: string
  password: string
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
