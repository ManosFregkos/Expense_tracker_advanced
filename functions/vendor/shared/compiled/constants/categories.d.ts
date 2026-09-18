import type { Category } from '../domain/types.js';
type CategorySeed = Pick<Category, 'id' | 'name' | 'type' | 'icon'> & {
    parentId?: string;
};
export declare const DEFAULT_CATEGORY_SEEDS: readonly CategorySeed[];
export {};
//# sourceMappingURL=categories.d.ts.map