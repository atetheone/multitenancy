import User from '#modules/user/models/user'
import Tenant from '#modules/tenant/models/tenant'
import Role from '#modules/rbac/models/role'
import { DateTime } from 'luxon'

export interface TestUser {
  user: User
  email: string
  password: string
}

export interface TestTenant {
  tenant: Tenant
  users: {
    admin: TestUser
    user: TestUser
  }
}

/**
 * Create a test user with profile and optional tenant association
 * For tokens, use client.post('/api/auth/login') directly in tests
 */
export async function createTestUser(
  email: string,
  options: {
    firstName?: string
    lastName?: string
    password?: string
    status?: 'active' | 'inactive' | 'suspended'
    tenantId?: number
  } = {}
): Promise<TestUser> {
  const {
    firstName = 'Test',
    lastName = 'User',
    password = 'password123',
    status = 'active',
    tenantId,
  } = options

  const user = await User.create({
    email,
    password,
    status,
    lastLoginAt: DateTime.now(),
  })

  await user.related('profile').create({
    firstName,
    lastName,
  })

  if (tenantId) {
    await user.related('tenants').attach([tenantId])
  }

  return { user, email, password }
}

/**
 * Create a test tenant with default users (admin and regular user)
 */
export async function createTestTenant(
  name: string,
  slug?: string,
  options: {
    createUsers?: boolean
    createRoles?: boolean
  } = {}
): Promise<TestTenant> {
  const { createUsers = true, createRoles = true } = options

  const tenant = await Tenant.create({
    name,
    slug: slug || name.toLowerCase().replace(/\s+/g, '-'),
    status: 'active',
  })

  let adminUser: TestUser
  let regularUser: TestUser

  if (createUsers) {
    // Create admin user
    adminUser = await createTestUser(`admin@${tenant.slug}.com`, {
      firstName: 'Admin',
      lastName: 'User',
      tenantId: tenant.id,
    })

    // Create regular user
    regularUser = await createTestUser(`user@${tenant.slug}.com`, {
      firstName: 'Regular',
      lastName: 'User',
      tenantId: tenant.id,
    })

    if (createRoles) {
      // Create default roles if they don't exist
      await createDefaultRoles(tenant.id)

      // Assign admin role
      await assignRoleToUser(adminUser.user, 'admin', tenant.id)

      // Assign user role
      await assignRoleToUser(regularUser.user, 'user', tenant.id)
    }
  } else {
    // Create empty test users to maintain interface
    adminUser = { user: {} as User, email: '', password: '' }
    regularUser = { user: {} as User, email: '', password: '' }
  }

  return {
    tenant,
    users: {
      admin: adminUser,
      user: regularUser,
    },
  }
}

/**
 * Create default roles for a tenant
 */
export async function createDefaultRoles(tenantId: number): Promise<void> {
  const defaultRoles = [
    {
      name: 'admin',
      displayName: 'Administrator',
      description: 'Full access to all resources',
    },
    {
      name: 'user',
      displayName: 'Regular User',
      description: 'Limited access to user features',
    },
    {
      name: 'moderator',
      displayName: 'Moderator',
      description: 'Moderate content and users',
    },
  ]

  for (const roleData of defaultRoles) {
    await Role.firstOrCreate(
      { name: roleData.name, tenantId },
      {
        ...roleData,
        tenantId,
      }
    )
  }
}

/**
 * Assign a role to a user
 */
export async function assignRoleToUser(
  user: User,
  roleName: string,
  tenantId: number
): Promise<void> {
  const role = await Role.query().where('name', roleName).where('tenant_id', tenantId).firstOrFail()

  await user.related('roles').attach([role.id])
}

/**
 * Create authentication headers for API testing
 */
export function createAuthHeaders(
  token: string,
  tenantSlug: string,
  additionalHeaders: Record<string, string> = {}
): Record<string, string> {
  return {
    'Authorization': `Bearer ${token}`,
    'X-Tenant-Slug': tenantSlug,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...additionalHeaders,
  }
}

/**
 * Helper to login and get token for tests
 * Use this in your test setup
 */
export async function loginAndGetToken(
  client: any,
  email: string,
  password: string,
  tenantSlug: string
): Promise<string> {
  const response = await client
    .post('/api/auth/login')
    .json({ email, password })
    .header('X-Tenant-Slug', tenantSlug)

  if (response.status() !== 200) {
    throw new Error(`Login failed: ${response.text()}`)
  }

  return response.body().token.accessToken
}

/**
 * Create a complete test setup with tenant and users
 * Returns credentials for login instead of tokens
 */
export async function createTestSetup(
  tenantName: string,
  tenantSlug?: string
): Promise<{
  tenant: Tenant
  admin: TestUser
  user: TestUser
}> {
  const testTenant = await createTestTenant(tenantName, tenantSlug)

  return {
    tenant: testTenant.tenant,
    admin: testTenant.users.admin,
    user: testTenant.users.user,
  }
}

/**
 * Helper to clean up test data
 */
export async function cleanupTestData(): Promise<void> {
  // This would typically be handled by testUtils.db().truncate()
  // but can be extended for specific cleanup needs
}
