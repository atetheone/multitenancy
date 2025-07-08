# AdonisJS 6 Framework Documentation

AdonisJS 6 is a fullstack MVC framework for Node.js that focuses on ergonomics and speed. It provides a clean and stable API to build web applications and microservices.

## Core Architecture

### Application Lifecycle

AdonisJS applications follow a structured lifecycle managed by the **Ignitor**:

1. **Creation** - App instance is created with environment (web/console/test/repl)
2. **Initialization** - RC file is loaded, providers are registered
3. **Booting** - Providers are booted, services are configured
4. **Starting** - Application starts, providers run their start hooks
5. **Ready** - Application is ready to handle requests
6. **Termination** - Graceful shutdown with cleanup

### Environments

AdonisJS supports multiple environments:

- **web** - HTTP server environment
- **console** - CLI commands environment  
- **test** - Testing environment
- **repl** - REPL environment

## Project Structure

```
├── app/
│   ├── controllers/     # HTTP controllers
│   ├── middleware/      # HTTP middleware
│   ├── models/          # Database models
│   ├── services/        # Business logic services
│   ├── exceptions/      # Custom exceptions
│   ├── validators/      # Validation schemas
│   └── events/          # Event classes
├── commands/            # Ace commands
├── config/              # Configuration files
├── providers/           # Service providers
├── resources/
│   └── views/           # Edge templates
├── start/               # Preload files
├── tests/               # Test files
├── bin/                 # Entry points
└── adonisrc.ts         # RC configuration
```

## Configuration

### RC File (adonisrc.ts)

The RC file is the main configuration file that defines:

```typescript
import { defineConfig } from '@adonisjs/core/app'

export default defineConfig({
  // TypeScript configuration
  typescript: true,
  
  // Application directories
  directories: {
    config: 'config',
    public: 'public',
    contracts: 'contracts',
    providers: 'providers',
    database: 'database',
    migrations: 'database/migrations',
    seeds: 'database/seeders',
    resources: 'resources',
    views: 'resources/views',
    start: 'start',
    tmp: 'tmp',
    tests: 'tests',
    commands: 'commands'
  },
  
  // Service providers
  providers: [
    () => import('@adonisjs/core/providers/app_provider'),
    () => import('@adonisjs/core/providers/hash_provider'),
    // ... other providers
  ],
  
  // Preload files
  preloads: [
    () => import('#start/routes'),
    () => import('#start/kernel')
  ],
  
  // Ace commands
  commands: [
    () => import('@adonisjs/core/commands')
  ],
  
  // Test suites
  tests: {
    suites: [
      {
        name: 'unit',
        files: ['tests/unit/**/*.spec(.js|.ts)']
      }
    ]
  }
})
```

## HTTP Layer

### Controllers

Controllers handle HTTP requests and contain your application logic:

```typescript
import type { HttpContext } from '@adonisjs/core/http'

export default class UsersController {
  // List all users
  async index({ response }: HttpContext) {
    return response.ok([])
  }
  
  // Show single user
  async show({ params, response }: HttpContext) {
    const user = await User.find(params.id)
    return response.ok(user)
  }
  
  // Create new user
  async store({ request, response }: HttpContext) {
    const data = request.all()
    const user = await User.create(data)
    return response.created(user)
  }
  
  // Update user
  async update({ params, request, response }: HttpContext) {
    const user = await User.findOrFail(params.id)
    user.merge(request.all())
    await user.save()
    return response.ok(user)
  }
  
  // Delete user
  async destroy({ params, response }: HttpContext) {
    const user = await User.findOrFail(params.id)
    await user.delete()
    return response.noContent()
  }
}
```

### Routing

Define routes in `start/routes.ts`:

```typescript
import router from '@adonisjs/core/services/router'

// Basic routes
router.get('/', async () => {
  return { hello: 'world' }
})

// Controller routes
router.resource('users', '#controllers/users_controller')

// Route groups
router.group(() => {
  router.get('/dashboard', '#controllers/dashboard_controller.show')
  router.resource('posts', '#controllers/posts_controller')
}).prefix('/admin').middleware('auth')

// Named routes
router.get('/profile', '#controllers/profile_controller.show').as('profile')

// Route parameters
router.get('/users/:id', '#controllers/users_controller.show')
router.get('/posts/:slug?', '#controllers/posts_controller.show')

// Domain-specific routes
router.group(() => {
  router.get('/', '#controllers/blog_controller.index')
}).domain('blog.example.com')
```

### Middleware

Middleware provides a way to filter HTTP requests:

```typescript
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

export default class AuthMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    // Authentication logic
    const token = ctx.request.header('authorization')
    
    if (!token) {
      return ctx.response.unauthorized({ error: 'Token required' })
    }
    
    // Verify token and set user
    ctx.auth.user = await verifyToken(token)
    
    // Continue to next middleware/controller
    return await next()
  }
}
```

Register middleware in `start/kernel.ts`:

```typescript
import server from '@adonisjs/core/services/server'

// Global middleware
server.use([
  () => import('#middleware/container_bindings_middleware'),
  () => import('@adonisjs/core/bodyparser_middleware')
])

// Named middleware
export const middleware = router.named({
  auth: () => import('#middleware/auth_middleware'),
  guest: () => import('#middleware/guest_middleware')
})
```

### Request Validation

Validate requests using VineJS:

```typescript
import vine from '@vinejs/vine'

// Define validator
const createUserValidator = vine.compile(
  vine.object({
    email: vine.string().email(),
    password: vine.string().minLength(8),
    full_name: vine.string().trim()
  })
)

// Use in controller
export default class UsersController {
  async store({ request }: HttpContext) {
    // Validate request data
    const data = await request.validateUsing(createUserValidator)
    
    // Create user with validated data
    const user = await User.create(data)
    return user
  }
}
```

## Command Line Interface (Ace)

### Built-in Commands

AdonisJS provides many built-in commands:

```bash
# Development
node ace serve --watch          # Start dev server with hot reload
node ace build                  # Build for production

# Code generation
node ace make:controller User   # Create controller
node ace make:middleware Auth   # Create middleware
node ace make:model User        # Create model
node ace make:migration users   # Create migration
node ace make:command greet     # Create custom command

# Database
node ace migration:run          # Run migrations
node ace migration:rollback     # Rollback migrations
node ace db:seed               # Run seeders

# Other utilities
node ace list:routes           # List all routes
node ace repl                  # Start REPL
node ace generate:key          # Generate app key
```

### Custom Commands

Create custom Ace commands:

```typescript
import { BaseCommand } from '@adonisjs/core/ace'
import { args, flags } from '@adonisjs/core/ace'

export default class Greet extends BaseCommand {
  static commandName = 'greet'
  static description = 'Greet a user'
  
  @args.string({ description: 'Name of the person to greet' })
  declare name: string
  
  @flags.boolean({ description: 'Display in uppercase' })
  declare loud?: boolean
  
  async run() {
    let message = `Hello ${this.name}!`
    
    if (this.loud) {
      message = message.toUpperCase()
    }
    
    this.logger.info(message)
  }
}
```

## Service Providers

Service providers are the backbone of AdonisJS applications. They register and configure services:

```typescript
import type { ApplicationService } from '@adonisjs/core/types'

export default class AppProvider {
  constructor(protected app: ApplicationService) {}
  
  register() {
    // Register bindings to the container
    this.app.container.bind('my-service', () => {
      return new MyService()
    })
  }
  
  async boot() {
    // Configure services after all providers are registered
    const myService = await this.app.container.make('my-service')
    myService.configure()
  }
  
  async start() {
    // Called when application starts
  }
  
  async ready() {
    // Called when application is ready
  }
  
  async shutdown() {
    // Cleanup logic
  }
}
```

## Configuration System

### Environment Variables

Configure environment variables in `start/env.ts`:

```typescript
import { Env } from '@adonisjs/core/env'

export default await Env.create(new URL('../', import.meta.url), {
  NODE_ENV: Env.schema.enum(['development', 'production', 'test'] as const),
  PORT: Env.schema.number(),
  APP_KEY: Env.schema.string(),
  HOST: Env.schema.string({ format: 'host' }),
  LOG_LEVEL: Env.schema.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']),
  
  // Database
  DB_HOST: Env.schema.string({ format: 'host' }),
  DB_PORT: Env.schema.number(),
  DB_USER: Env.schema.string(),
  DB_PASSWORD: Env.schema.string.optional(),
  DB_DATABASE: Env.schema.string(),
})
```

### Config Files

Create typed configuration files:

```typescript
// config/app.ts
import { defineConfig } from '@adonisjs/core/app'

export default defineConfig({
  appKey: env.get('APP_KEY'),
  http: {
    allowMethodSpoofing: false,
    subdomainOffset: 2,
    generateRequestId: true,
    trustProxy: false,
    etag: false
  }
})
```

## Database & Models

### Models

Define Lucid models:

```typescript
import { DateTime } from 'luxon'
import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'

export default class User extends BaseModel {
  @column({ isPrimary: true })
  declare id: number
  
  @column()
  declare email: string
  
  @column({ serializeAs: null })
  declare password: string
  
  @column()
  declare fullName: string
  
  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime
  
  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
  
  @hasMany(() => Post)
  declare posts: HasMany<typeof Post>
}
```

### Migrations

Create database migrations:

```typescript
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'users'
  
  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('email').unique()
      table.string('password')
      table.string('full_name')
      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }
  
  async down() {
    this.schema.dropTable(this.tableName)
  }
}
```

## Events System

### Event Classes

Define event classes:

```typescript
import { BaseEvent } from '@adonisjs/core/events'

export default class UserRegistered extends BaseEvent {
  constructor(public user: User) {
    super()
  }
}
```

### Event Listeners

Create event listeners:

```typescript
export default class SendWelcomeEmail {
  async handle(event: UserRegistered) {
    // Send welcome email
    await Mail.send((message) => {
      message
        .to(event.user.email)
        .subject('Welcome!')
        .htmlView('emails/welcome', { user: event.user })
    })
  }
}
```

### Emitting Events

Emit events from your application:

```typescript
import emitter from '@adonisjs/core/services/emitter'

export default class UsersController {
  async store({ request }: HttpContext) {
    const user = await User.create(request.all())
    
    // Emit event
    await emitter.emit(new UserRegistered(user))
    
    return user
  }
}
```

## Testing

### Test Structure

Organize tests by suites:

```typescript
// tests/unit/user.spec.ts
import { test } from '@japa/runner'

test.group('User', () => {
  test('should create user', async ({ assert }) => {
    const user = await User.create({
      email: 'john@example.com',
      password: 'secret',
      fullName: 'John Doe'
    })
    
    assert.exists(user.id)
    assert.equal(user.email, 'john@example.com')
  })
})
```

### HTTP Tests

Test HTTP endpoints:

```typescript
import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'

test.group('Users API', (group) => {
  group.each.setup(async () => {
    await testUtils.httpServer().start()
  })
  
  test('GET /users should return users list', async ({ client }) => {
    const response = await client.get('/users')
    
    response.assertStatus(200)
    response.assertBodyContains([])
  })
})
```

## Security

### Hashing

Hash passwords and sensitive data:

```typescript
import hash from '@adonisjs/core/services/hash'

// Hash password
const hashedPassword = await hash.make('plain-password')

// Verify password
const isValid = await hash.verify(hashedPassword, 'plain-password')
```

### Encryption

Encrypt/decrypt data:

```typescript
import encryption from '@adonisjs/core/services/encryption'

// Encrypt data
const encrypted = encryption.encrypt('sensitive-data')

// Decrypt data
const decrypted = encryption.decrypt(encrypted)
```

## Deployment

### Production Build

Build your application for production:

```bash
# Build application
node ace build

# Start production server
cd build
npm ci --omit="dev"
node bin/server.js
```

### Environment Setup

Configure production environment:

```bash
# Environment variables
NODE_ENV=production
PORT=3333
APP_KEY=your-secure-app-key
HOST=0.0.0.0

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=secret
DB_DATABASE=myapp
```

## Development Workflow

### Starting Development

```bash
# Install dependencies
npm install

# Generate app key
node ace generate:key

# Run migrations
node ace migration:run

# Start development server
node ace serve --watch
```

### Code Generation

```bash
# Generate MVC components
node ace make:controller Posts
node ace make:model Post
node ace make:migration create_posts_table

# Generate other components
node ace make:middleware Auth
node ace make:service EmailService
node ace make:validator CreatePost
node ace make:command SendEmails
```

This documentation covers the core concepts and patterns of AdonisJS 6. The framework emphasizes convention over configuration, type safety, and developer experience while providing the flexibility to build both small applications and large-scale systems.
