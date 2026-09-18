import { z } from 'zod';
import { idSchema, shortTextSchema } from './common.js';
export const createCategorySchema = z.object({
    householdId: idSchema,
    name: shortTextSchema,
    parentCategoryId: idSchema.optional(),
    type: z.enum(['EXPENSE', 'INCOME']),
    icon: z.string().trim().max(40).optional(),
});
export const updateCategorySchema = createCategorySchema
    .omit({ type: true, parentCategoryId: true })
    .extend({ categoryId: idSchema, isArchived: z.boolean().optional() });
