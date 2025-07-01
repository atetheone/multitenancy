import vine from '@vinejs/vine'

export const tenantValidator = {
  create: vine.compile(
    vine.object({
      name: vine.string().minLength(1).maxLength(100),
      slug: vine.string().minLength(1).maxLength(100).optional(),
      domain: vine.string().maxLength(255).optional(),
      description: vine.string().optional(),
      logo: vine.string().maxLength(255).optional(),
      settings: vine.object({}).optional(),
      status: vine.enum(['active', 'inactive', 'suspended']).optional()
    })
  ),

  update: vine.compile(
    vine.object({
      name: vine.string().minLength(1).maxLength(100).optional(),
      slug: vine.string().minLength(1).maxLength(100).optional(),
      domain: vine.string().maxLength(255).optional(),
      description: vine.string().optional(),
      logo: vine.string().maxLength(255).optional(),
      settings: vine.object({}).optional(),
      status: vine.enum(['active', 'inactive', 'suspended']).optional()
    })
  ),
}
