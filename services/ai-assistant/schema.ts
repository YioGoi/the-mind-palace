export const AI_ASSISTANT_ACTION_SCHEMA = {
  name: 'mind_palace_actions',
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      actions: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            type: { type: 'string', const: 'create_note' },
            title: { type: 'string' },
            category: {
              type: 'string',
              enum: ['URGENT', 'HAVE', 'NICE'],
            },
            body: {
              type: ['string', 'null'],
            },
            dueDate: {
              type: ['string', 'null'],
            },
            reminders: {
              type: 'array',
              items: { type: 'string' },
            },
            context: {
              type: ['object', 'null'],
              additionalProperties: false,
              properties: {
                mode: {
                  type: 'string',
                  enum: ['existing', 'new'],
                },
                contextId: {
                  type: ['string', 'null'],
                },
                contextName: {
                  type: ['string', 'null'],
                },
              },
              required: ['mode', 'contextId', 'contextName'],
            },
          },
          required: ['type', 'title', 'category', 'body', 'dueDate', 'reminders', 'context'],
        },
      },
      summary: {
        type: 'string',
      },
    },
    required: ['actions', 'summary'],
  },
} as const
