import vine from '@vinejs/vine'

export const tenantValidator = {
  create: vine.compile(
    vine.object({
      name: vine.string().minLength(1).maxLength(255),
      // TODO: Add validation rules for create
    })
  ),

  update: vine.compile(
    vine.object({
      name: vine.string().minLength(1).maxLength(255).optional(),
      // TODO: Add validation rules for update
    })
  ),
}
