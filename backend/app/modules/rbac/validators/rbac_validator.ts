import vine from '@vinejs/vine'

export const rbacValidator = {
  create: vine.compile(
    vine.object({
      name: vine.string().minLength(1).maxLength(50),
      displayName: vine.string().minLength(1).maxLength(100).optional(),
      tenantId: vine.number().positive().optional(),
    })
  ),

  update: vine.compile(
    vine.object({
      displayName: vine.string().minLength(1).maxLength(100).optional(),
      isDefault: vine.boolean().optional(),
    })
  ),

  assignRoles: vine.compile(
    vine.object({
      roleIds: vine.array(vine.number().positive()).minLength(1),
      tenantId: vine.number().positive(),
    })
  ),
}
