import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

/**
 * EmailVerifiedMiddleware is used to ensure that the user has verified their email
 * before accessing certain routes. It checks if the user is authenticated and
 * has a verified email address.
 */
export default class EmailVerifiedMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    // Check if the user is authenticated
    const user = await ctx.auth.getUserOrFail()

    // Check if the user's email is verified
    if (!user.emailVerifiedAt) {
      return ctx.response.status(403).json({
        success: false,
        message: 'Email not verified',
        code: 'E_EMAIL_NOT_VERIFIED',
      })
    }
    await next()
  }
}
