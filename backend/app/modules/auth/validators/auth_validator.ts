import vine from '@vinejs/vine'

/**
 * Validator for user login
 */
export const loginValidator = vine.compile(
  vine.object({
    email: vine.string().email().normalizeEmail().maxLength(100).trim(),
    password: vine.string().minLength(6).maxLength(255),
  })
)

/**
 * Validator for user registration
 */
export const registerValidator = vine.compile(
  vine.object({
    email: vine.string().email().normalizeEmail().maxLength(100).trim(),
    password: vine
      .string()
      .minLength(6)
      .maxLength(255)
      .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).*$/), // At least one lowercase, uppercase, and digit
    firstName: vine.string().trim().minLength(2).maxLength(50),
    lastName: vine.string().trim().minLength(2).maxLength(50),
  })
)

/**
 * Validator for refresh token
 */
export const refreshTokenValidator = vine.compile(
  vine.object({
    refreshToken: vine.string().trim().minLength(1),
  })
)

/**
 * Validator for token validation
 */
export const validateTokenValidator = vine.compile(
  vine.object({
    token: vine.string().trim().minLength(1),
  })
)

/**
 * Validator for password change
 */
export const changePasswordValidator = vine.compile(
  vine.object({
    currentPassword: vine.string().minLength(6).maxLength(255),
    newPassword: vine
      .string()
      .minLength(6)
      .maxLength(255)
      .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).*$/)
      .confirmed(), // Requires new_password_confirmation field
  })
)

/**
 * Validator for forgot password
 */
export const forgotPasswordValidator = vine.compile(
  vine.object({
    email: vine.string().email().normalizeEmail().maxLength(100).trim(),
  })
)

/**
 * Validator for reset password
 */
export const resetPasswordValidator = vine.compile(
  vine.object({
    token: vine.string().trim().minLength(1),
    email: vine.string().email().normalizeEmail().maxLength(100).trim(),
    password: vine
      .string()
      .minLength(6)
      .maxLength(255)
      .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).*$/)
      .confirmed(),
  })
)
