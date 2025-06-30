import { defineConfig } from '@adonisjs/auth'
import { sessionGuard, sessionUserProvider } from '@adonisjs/auth/session'
import type { InferAuthenticators, InferAuthEvents, Authenticators } from '@adonisjs/auth/types'
import { tokensUserProvider } from '@adonisjs/auth/access_tokens'
import { jwtGuard } from '@maximemrf/adonisjs-jwt/jwt_config'
import { JwtGuardUser, BaseJwtContent } from '@maximemrf/adonisjs-jwt/types'
import { User } from '#models/user'
import env from "#start/env"

// Define the JWT guard configuration
interface JwtContent extends BaseJwtContent {
  email: string
}
// interface JwtContent extends BaseJwtContent {
//   email: string
//   tenantId: number
//   roles: Array<{
//     name: string
//     permissions: Array<string>
//   }>
// }

const authConfig = defineConfig({
  default: 'jwt',
  guards: {
    web: sessionGuard({
      useRememberMeTokens: false,
      provider: sessionUserProvider({
        model: () => import('#models/user')
      }),
    }),
    jwt: jwtGuard({
      provider: tokensUserProvider({
        model: () => import('#models/user')
      }),
      tokenExpiresIn: '1h',
      useCookies: false,
      content: (user: JwtGuardUser<User>) : JwtContent => ({
        userId: user.getId(),
        email: (user.getOriginal() as User).email,
      }),
    })
  },
})

export default authConfig

/**
 * Inferring types from the configured auth
 * guards.
 */
declare module '@adonisjs/auth/types' {
  export interface Authenticators extends InferAuthenticators<typeof authConfig> {}
}
declare module '@adonisjs/core/types' {
  interface EventsList extends InferAuthEvents<Authenticators> {}
}