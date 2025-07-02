import { defineConfig } from '@adonisjs/auth'
import { sessionGuard, sessionUserProvider } from '@adonisjs/auth/session'
import { jwtGuard } from '@maximemrf/adonisjs-jwt/jwt_config'
import { JwtGuardUser, BaseJwtContent } from '@maximemrf/adonisjs-jwt/types'
import { tokensUserProvider } from '@adonisjs/auth/access_tokens'
import User from '#modules/user/models/user'

interface JwtContent extends BaseJwtContent {
  email: string
  tenantId?: number
  // roles?: string[]
  // permissions?: string[]
}

const authConfig = defineConfig({
  // define the default authenticator to jwt
  default: 'jwt',
  guards: {
    jwt: jwtGuard({
      tokenExpiresIn: 3600, // 1 hour in seconds
      useCookies: false,

      provider: sessionUserProvider({
        model: () => import('#modules/user/models/user'),
      }),
      // if you want to use refresh tokens, you have to set the refreshTokenUserProvider
      refreshTokenUserProvider: tokensUserProvider({
        tokens: 'refreshTokens',
        model: () => import('#modules/user/models/user'),
      }),
      // content is a function that takes the user and returns the content of the token, it can be optional, by default it returns only the user id
      content: <T>(user: JwtGuardUser<T>): JwtContent => {
        const userModel = user.getOriginal() as User
        return {
          userId: user.getId(),
          email: userModel.email,
          // roles: userModel.roles?.map((role: any) => role.name) || [],
          // permissions: userModel.permissions?.map((perm: any) => perm.name) || [],
        }
      },
    }),
    session: sessionGuard({
      useRememberMeTokens: false,
      provider: sessionUserProvider({
        model: () => import('#modules/user/models/user'),
      }),
    }),
  },
})

export default authConfig
