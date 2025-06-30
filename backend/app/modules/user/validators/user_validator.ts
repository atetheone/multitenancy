import vine from '@vinejs/vine'

export const userValidator = {
  create: vine.compile(
    vine.object({
      email: vine.string().email(),
      password: vine.string().minLength(6),
      fullName: vine.string().minLength(2).maxLength(255).optional(),
      status: vine.enum(['active', 'inactive', 'suspended']).optional(),
    })
  ),

  update: vine.compile(
    vine.object({
      email: vine.string().email().optional(),
      fullName: vine.string().minLength(2).maxLength(255).optional(),
      status: vine.enum(['active', 'inactive', 'suspended']).optional(),
    })
  ),

  updateProfile: vine.compile(
    vine.object({
      firstName: vine.string().minLength(1).maxLength(255).optional(),
      lastName: vine.string().minLength(1).maxLength(255).optional(),
      phone: vine.string().maxLength(20).optional(),
      dateOfBirth: vine.date().optional(),
      profilePictureUrl: vine.string().url().optional(),
    })
  ),

  changePassword: vine.compile(
    vine.object({
      currentPassword: vine.string().minLength(6).maxLength(255),
      newPassword: vine.string().minLength(6).maxLength(255),
    })
  ),
}
