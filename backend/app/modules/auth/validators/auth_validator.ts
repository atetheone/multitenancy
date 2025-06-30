import vine from '@vinejs/vine'

export const loginValidator = vine.compile(
  vine.object({
    email: vine.string().email(),
    password: vine.string().minLength(6),
  })
)

export const registerValidator = vine.compile(
  vine.object({
    email: vine.string().email(),
    password: vine.string().minLength(6),
    firstName: vine.string().minLength(1).maxLength(255),
    lastName: vine.string().minLength(1).maxLength(255),
  })
)

export const refreshTokenValidator = vine.compile(
  vine.object({
    refreshToken: vine.string(),
  })
)
