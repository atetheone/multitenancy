import { Authenticators, InferAuthEvents } from '@adonisjs/auth/types'
import authConfig from '#config/auth'

declare module '@adonisjs/auth/types' {
  export interface Authenticators extends InferAuthenticators<typeof authConfig> {}
}
declare module '@adonisjs/core/types' {
  interface EventsList extends InferAuthEvents<Authenticators> {}
}
