import vine from '@vinejs/vine'

export const permissionValidator = {
  create: vine.compile(
    vine.object({
      resource: vine.string().minLength(1).maxLength(50),
      action: vine.string().minLength(1).maxLength(50),
      description: vine.string().minLength(1).maxLength(255).optional(),
    })
  ),

  update: vine.compile(
    vine.object({
      description: vine.string().minLength(1).maxLength(255).optional(),
    })
  ),

  assignToRole: vine.compile(
    vine.object({
      permissionIds: vine.array(vine.number().positive()).minLength(1),
    })
  ),

  createBulk: vine.compile(
    vine.object({
      resource: vine.string().minLength(1).maxLength(50),
      actions: vine.array(vine.string().minLength(1).maxLength(50)).minLength(1),
    })
  ),
}
