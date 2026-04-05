export const AI_CLEANUP_PLAN_SCHEMA = {
  name: 'mind_palace_cleanup_plan',
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      summary: {
        type: 'string',
      },
      actions: {
        type: 'array',
        items: {
          anyOf: [
            {
              type: 'object',
              additionalProperties: false,
              properties: {
                type: { type: 'string', const: 'rename_context' },
                contextId: { type: 'string' },
                newName: { type: 'string' },
                reason: { type: 'string' },
              },
              required: ['type', 'contextId', 'newName', 'reason'],
            },
            {
              type: 'object',
              additionalProperties: false,
              properties: {
                type: { type: 'string', const: 'move_notes' },
                noteIds: {
                  type: 'array',
                  items: { type: 'string' },
                },
                targetContextId: { type: 'string' },
                reason: { type: 'string' },
              },
              required: ['type', 'noteIds', 'targetContextId', 'reason'],
            },
            {
              type: 'object',
              additionalProperties: false,
              properties: {
                type: { type: 'string', const: 'merge_contexts' },
                sourceContextId: { type: 'string' },
                targetContextId: { type: 'string' },
                reason: { type: 'string' },
              },
              required: ['type', 'sourceContextId', 'targetContextId', 'reason'],
            },
            {
              type: 'object',
              additionalProperties: false,
              properties: {
                type: { type: 'string', const: 'create_context_and_move_notes' },
                noteIds: {
                  type: 'array',
                  items: { type: 'string' },
                },
                category: {
                  type: 'string',
                  enum: ['URGENT', 'HAVE', 'NICE'],
                },
                contextName: { type: 'string' },
                reason: { type: 'string' },
              },
              required: ['type', 'noteIds', 'category', 'contextName', 'reason'],
            },
            {
              type: 'object',
              additionalProperties: false,
              properties: {
                type: { type: 'string', const: 'delete_empty_context' },
                contextId: { type: 'string' },
                reason: { type: 'string' },
              },
              required: ['type', 'contextId', 'reason'],
            },
          ],
        },
      },
    },
    required: ['summary', 'actions'],
  },
} as const
