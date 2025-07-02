import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import User from '#modules/user/models/user'
import Tenant from '#modules/tenant/models/tenant'

test.group('Authentication', (group) => {
  group.each.setup(() => testUtils.db().truncate())

  test('should authenticate user with valid credentials and tenant context', async ({
    client,
    assert,
  }) => {
    // Create tenant and user
    const tenant = await Tenant.create({
      name: 'Test Store',
      slug: 'test-store',
      status: 'active',
      settings: {},
    })

    const user = await User.create({
      email: 'auth@example.com',
      password: 'password123',
      status: 'active',
      currentTenantId: tenant.id,
    })

    await user.related('profile').create({
      firstName: 'Auth',
      lastName: 'User',
    })

    // Associate user with tenant
    await user.related('tenants').attach([tenant.id])

    const credentials = {
      email: 'auth@example.com',
      password: 'password123',
    }

    const response = await client
      .post('/api/auth/login')
      .json(credentials)
      .header('Content-Type', 'application/json')
      .header('X-Tenant-Slug', tenant.slug)

    response.assertStatus(200)

    const body = response.body()
    assert.exists(body.data.user)
    assert.exists(body.data.token)
    assert.equal(body.data.user.email, credentials.email)
    assert.isString(body.data.token.token)
    assert.equal(body.data.token.expiresIn, '1h')
  })

  test('should reject invalid credentials', async ({ client }) => {
    const tenant = await Tenant.create({
      name: 'Test Store',
      slug: 'test-store',
      status: 'active',
      settings: {},
    })

    const credentials = {
      email: 'nonexistent@example.com',
      password: 'wrongpassword',
    }

    const response = await client
      .post('/api/auth/login')
      .json(credentials)
      .header('Content-Type', 'application/json')
      .header('X-Tenant-Slug', tenant.slug)

    response.assertStatus(401)
  })

  test('should reject login without tenant context', async ({ client }) => {
    const user = await User.create({
      email: 'notenant@example.com',
      password: 'password123',
      status: 'active',
    })

    const credentials = {
      email: 'notenant@example.com',
      password: 'password123',
    }

    const response = await client
      .post('/api/auth/login')
      .json(credentials)
      .header('Content-Type', 'application/json')
    // No X-Tenant-Slug header

    response.assertStatus(400) // Should require tenant context
  })

  test('should reject login for inactive user', async ({ client }) => {
    const tenant = await Tenant.create({
      name: 'Test Store',
      slug: 'test-store',
      status: 'active',
      settings: {},
    })

    const user = await User.create({
      email: 'inactive@example.com',
      password: 'password123',
      status: 'inactive', // User is inactive
      currentTenantId: tenant.id,
    })

    await user.related('tenants').attach([tenant.id])

    const credentials = {
      email: 'inactive@example.com',
      password: 'password123',
    }

    const response = await client
      .post('/api/auth/login')
      .json(credentials)
      .header('Content-Type', 'application/json')
      .header('X-Tenant-Slug', tenant.slug)

    response.assertStatus(403) // Forbidden - account inactive
  })

  test('should get current user with valid token', async ({ client, assert }) => {
    const tenant = await Tenant.create({
      name: 'Test Store',
      slug: 'test-store',
      status: 'active',
      settings: {},
    })

    const user = await User.create({
      email: 'current@example.com',
      password: 'password123',
      status: 'active',
      currentTenantId: tenant.id,
    })

    await user.related('profile').create({
      firstName: 'Current',
      lastName: 'User',
    })

    await user.related('tenants').attach([tenant.id])

    // Login to get token
    const loginResponse = await client
      .post('/api/auth/login')
      .json({
        email: 'current@example.com',
        password: 'password123',
      })
      .header('Content-Type', 'application/json')
      .header('X-Tenant-Slug', tenant.slug)

    const { token } = loginResponse.body().data

    // Use token to get current user
    const meResponse = await client
      .get('/api/auth/me')
      .header('Authorization', `Bearer ${token.token}`)
      .header('Content-Type', 'application/json')
      .header('X-Tenant-Slug', tenant.slug)

    meResponse.assertStatus(200)

    const userData = meResponse.body()
    assert.equal(userData.data.email, 'current@example.com')
  })

  test('should reject access with invalid token', async ({ client }) => {
    const tenant = await Tenant.create({
      name: 'Test Store',
      slug: 'test-store',
      status: 'active',
      settings: {},
    })

    const response = await client
      .get('/api/auth/me')
      .header('Authorization', 'Bearer invalid-token')
      .header('Content-Type', 'application/json')
      .header('X-Tenant-Slug', tenant.slug)

    response.assertStatus(401)
  })

  test('should logout user successfully', async ({ client }) => {
    const tenant = await Tenant.create({
      name: 'Test Store',
      slug: 'test-store',
      status: 'active',
      settings: {},
    })

    const user = await User.create({
      email: 'logout@example.com',
      password: 'password123',
      status: 'active',
      currentTenantId: tenant.id,
    })

    await user.related('tenants').attach([tenant.id])

    // Login first
    const loginResponse = await client
      .post('/api/auth/login')
      .json({
        email: 'logout@example.com',
        password: 'password123',
      })
      .header('Content-Type', 'application/json')
      .header('X-Tenant-Slug', tenant.slug)

    const { token } = loginResponse.body().data

    // Logout
    const logoutResponse = await client
      .post('/api/auth/logout')
      .header('Authorization', `Bearer ${token.token}`)
      .header('Content-Type', 'application/json')
      .header('X-Tenant-Slug', tenant.slug)

    logoutResponse.assertStatus(200)
  })

  test('should register new user with tenant association', async ({ client, assert }) => {
    const tenant = await Tenant.create({
      name: 'Test Store',
      slug: 'test-store',
      status: 'active',
      settings: {},
    })

    const registrationData = {
      email: 'register@example.com',
      password: 'password123',
      firstName: 'New',
      lastName: 'User',
    }

    const response = await client
      .post('/api/auth/register')
      .json(registrationData)
      .header('Content-Type', 'application/json')
      .header('X-Tenant-Slug', tenant.slug)

    response.assertStatus(201)

    const body = response.body()
    assert.isTrue(body.success)
    assert.exists(body.data.user)
    assert.equal(body.data.user.email, registrationData.email)

    // Verify user was created and associated with tenant
    const user = await User.findBy('email', registrationData.email)
    assert.isNotNull(user)

    await user?.load('tenants')
    assert.equal(user?.tenants.length, 1)
    assert.equal(user?.tenants[0].id, tenant.id)
  })
})
