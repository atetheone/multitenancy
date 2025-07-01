import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import Tenant from '#modules/tenant/models/tenant'

test.group('Tenant Management', (group) => {
  group.each.setup(() => testUtils.db().truncate())

  test('should create a new tenant successfully', async ({ client, assert }) => {
    const tenantData = {
      name: 'Test Store',
      slug: 'test-store',
      description: 'A test e-commerce store',
      status: 'active',
    }

    const response = await client
      .post('/api/tenants')
      .json(tenantData)
      .header('Content-Type', 'application/json')

    response.assertStatus(201)
    response.assertBodyContains({
      name: tenantData.name,
      slug: tenantData.slug,
      description: tenantData.description,
      status: tenantData.status,
    })

    // Verify tenant was saved to database
    const tenant = await Tenant.findBy('slug', tenantData.slug)
    assert.isNotNull(tenant)
    assert.equal(tenant?.name, tenantData.name)
  })

  test('should not create tenant with duplicate slug', async ({ client }) => {
    // Create first tenant
    await Tenant.create({
      name: 'First Store',
      slug: 'test-store',
      status: 'active',
      settings: {},
    })

    const duplicateData = {
      name: 'Second Store',
      slug: 'test-store', // Same slug
      status: 'active',
    }

    const response = await client
      .post('/api/tenants')
      .json(duplicateData)
      .header('Content-Type', 'application/json')

    response.assertStatus(422)
  })

  test('should get tenant by ID', async ({ client, assert }) => {
    const tenant = await Tenant.create({
      name: 'Test Store',
      slug: 'test-store',
      status: 'active',
      settings: {},
    })

    const response = await client
      .get(`/api/tenants/${tenant.id}`)
      .header('Content-Type', 'application/json')

    response.assertStatus(200)
    response.assertBodyContains({
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
    })
  })

  test('should list tenants with pagination', async ({ client, assert }) => {
    // Create multiple tenants
    await Tenant.createMany([
      { name: 'Store 1', slug: 'store-1', status: 'active', settings: {} },
      { name: 'Store 2', slug: 'store-2', status: 'active', settings: {} },
      { name: 'Store 3', slug: 'store-3', status: 'active', settings: {} },
    ])

    const response = await client
      .get('/api/tenants?page=1&limit=2')
      .header('Content-Type', 'application/json')

    response.assertStatus(200)

    const body = response.body()
    assert.equal(body.data.length, 2)
    assert.exists(body.meta)
    assert.equal(body.meta.total, 3)
  })

  test('should update tenant successfully', async ({ client, assert }) => {
    const tenant = await Tenant.create({
      name: 'Original Store',
      slug: 'original-store',
      status: 'active',
      settings: {},
    })

    const updateData = {
      name: 'Updated Store',
      description: 'Updated description',
    }

    const response = await client
      .put(`/api/tenants/${tenant.id}`)
      .json(updateData)
      .header('Content-Type', 'application/json')

    response.assertStatus(200)
    response.assertBodyContains({
      id: tenant.id,
      name: updateData.name,
      description: updateData.description,
    })

    // Verify database update
    await tenant.refresh()
    assert.equal(tenant.name, updateData.name)
    assert.equal(tenant.description, updateData.description)
  })

  test('should delete tenant successfully', async ({ client, assert }) => {
    const tenant = await Tenant.create({
      name: 'To Delete Store',
      slug: 'to-delete-store',
      status: 'active',
      settings: {},
    })

    const response = await client
      .delete(`/api/tenants/${tenant.id}`)
      .header('Content-Type', 'application/json')

    response.assertStatus(204)

    // Verify tenant was deleted
    const deletedTenant = await Tenant.find(tenant.id)
    assert.isNull(deletedTenant)
  })

  test('should return 404 for non-existent tenant', async ({ client }) => {
    const response = await client
      .get('/api/tenants/999999')
      .header('Content-Type', 'application/json')

    response.assertStatus(404)
  })
})
