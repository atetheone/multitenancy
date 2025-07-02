import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import User from '#modules/user/models/user'
import Tenant from '#modules/tenant/models/tenant'

test.group('User-Tenant Integration', (group) => {
  group.each.setup(() => testUtils.db().truncate())

  // Helper function to create authenticated user
  async function createAuthenticatedUser(client: any, tenant: any) {
    const adminUser = await User.create({
      email: 'admin@example.com',
      password: 'password123',
      status: 'active',
    })

    await adminUser.related('profile').create({
      firstName: 'Admin',
      lastName: 'User',
    })

    await adminUser.related('tenants').attach([tenant.id])

    const loginResponse = await client
      .post('/api/auth/login')
      .json({
        email: 'admin@example.com',
        password: 'password123',
      })
      .header('Content-Type', 'application/json')
      .header('X-Tenant-Slug', tenant.slug)

    return loginResponse.body().data.token
  }

  test('should create user within tenant context', async ({ client, assert }) => {
    // First create a tenant
    const tenant = await Tenant.create({
      name: 'Test Store',
      slug: 'test-store',
      status: 'active',
      settings: {},
    })

    // Authenticate as admin
    const token = await createAuthenticatedUser(client, tenant)

    const userData = {
      email: 'test@example.com',
      password: 'password123',
      firstName: 'John',
      lastName: 'Doe',
    }

    const response = await client
      .post('/api/users')
      .json(userData)
      .header('Content-Type', 'application/json')
      .header('Authorization', `Bearer ${token.token}`)
      .header('X-Tenant-Slug', tenant.slug)

    response.assertStatus(201)
    response.assertBodyContains({
      data: {
        email: userData.email,
      },
    })

    // Verify user was created
    const user = await User.findBy('email', userData.email)
    assert.isNotNull(user)

    // Verify user profile was created
    await user?.load('profile')
    assert.equal(user?.profile?.firstName, userData.firstName)
    assert.equal(user?.profile?.lastName, userData.lastName)
  })

  test('should associate user with tenant on creation', async ({ client, assert }) => {
    // Create a tenant
    const tenant = await Tenant.create({
      name: 'Test Store',
      slug: 'test-store',
      status: 'active',
      settings: {},
    })

    // Authenticate as admin
    const token = await createAuthenticatedUser(client, tenant)

    const userData = {
      email: 'tenant-user@example.com',
      password: 'password123',
      firstName: 'Jane',
      lastName: 'Smith',
    }

    const response = await client
      .post('/api/users')
      .json(userData)
      .header('Content-Type', 'application/json')
      .header('Authorization', `Bearer ${token.token}`)
      .header('X-Tenant-Slug', tenant.slug)

    response.assertStatus(201)

    const user = await User.findBy('email', userData.email)
    assert.isNotNull(user)

    // Load user's tenants
    await user?.load('tenants')
    assert.equal(user?.tenants.length, 1)
    assert.equal(user?.tenants[0].id, tenant.id)
  })

  test('should reject user creation without tenant context', async ({ client }) => {
    // Create a tenant and get auth token
    const tenant = await Tenant.create({
      name: 'Test Store',
      slug: 'test-store',
      status: 'active',
      settings: {},
    })

    const token = await createAuthenticatedUser(client, tenant)

    const userData = {
      email: 'no-tenant@example.com',
      password: 'password123',
      firstName: 'No',
      lastName: 'Tenant',
    }

    const response = await client
      .post('/api/users')
      .json(userData)
      .header('Content-Type', 'application/json')
      .header('Authorization', `Bearer ${token.token}`)
    // No X-Tenant-Slug header

    response.assertStatus(400) // Should reject without tenant context
  })

  test('should prevent duplicate user email within same tenant', async ({ client }) => {
    const tenant = await Tenant.create({
      name: 'Test Store',
      slug: 'test-store',
      status: 'active',
      settings: {},
    })

    // Authenticate as admin
    const token = await createAuthenticatedUser(client, tenant)

    const userData = {
      email: 'duplicate@example.com',
      password: 'password123',
      firstName: 'First',
      lastName: 'User',
    }

    // Create first user
    await client
      .post('/api/users')
      .json(userData)
      .header('Content-Type', 'application/json')
      .header('Authorization', `Bearer ${token.token}`)
      .header('X-Tenant-Slug', tenant.slug)

    // Try to create duplicate
    const duplicateResponse = await client
      .post('/api/users')
      .json({
        ...userData,
        firstName: 'Second',
        lastName: 'User',
      })
      .header('Content-Type', 'application/json')
      .header('Authorization', `Bearer ${token.token}`)
      .header('X-Tenant-Slug', tenant.slug)

    console.log('Duplicate response body:', duplicateResponse.body())
    duplicateResponse.assertStatus(409) // Conflict - email already exists
  })

  test('should allow same email across different tenants', async ({ client, assert }) => {
    // Create two different tenants
    const tenant1 = await Tenant.create({
      name: 'Store 1',
      slug: 'store-1',
      status: 'active',
      settings: {},
    })

    const tenant2 = await Tenant.create({
      name: 'Store 2',
      slug: 'store-2',
      status: 'active',
      settings: {},
    })

    // Authenticate as admin for tenant1
    const token1 = await createAuthenticatedUser(client, tenant1)

    // Authenticate as admin for tenant2
    const token2 = await createAuthenticatedUser(client, tenant2)

    const userData = {
      email: 'shared@example.com',
      password: 'password123',
      firstName: 'Shared',
      lastName: 'User',
    }

    // Create user in first tenant
    const response1 = await client
      .post('/api/users')
      .json(userData)
      .header('Content-Type', 'application/json')
      .header('Authorization', `Bearer ${token1.token}`)
      .header('X-Tenant-Slug', tenant1.slug)

    response1.assertStatus(201)

    // Create user with same email in second tenant
    const response2 = await client
      .post('/api/users')
      .json(userData)
      .header('Content-Type', 'application/json')
      .header('Authorization', `Bearer ${token2.token}`)
      .header('X-Tenant-Slug', tenant2.slug)

    response2.assertStatus(201)

    // Verify both users exist
    const users = await User.query().where('email', userData.email)
    assert.equal(users.length, 1) // Global unique constraint still applies

    // But user should be associated with both tenants
    await users[0].load('tenants')
    assert.equal(users[0].tenants.length, 2)
  })
})
