import { z } from 'zod';
export declare const createCategorySchema: z.ZodObject<{
    householdId: z.ZodString;
    name: z.ZodString;
    parentCategoryId: z.ZodOptional<z.ZodString>;
    type: z.ZodEnum<{
        EXPENSE: "EXPENSE";
        INCOME: "INCOME";
    }>;
    icon: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const updateCategorySchema: z.ZodObject<{
    householdId: z.ZodString;
    name: z.ZodString;
    icon: z.ZodOptional<z.ZodString>;
    categoryId: z.ZodString;
    isArchived: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
//# sourceMappingURL=category.d.ts.map