import { z } from 'zod';
export declare const kidsDifficultySchema: z.ZodUnion<readonly [z.ZodLiteral<1>, z.ZodLiteral<2>, z.ZodLiteral<3>, z.ZodLiteral<4>]>;
export declare const learningCardSchema: z.ZodObject<{
    id: z.ZodString;
    deckId: z.ZodString;
    title: z.ZodString;
    narration: z.ZodString;
    assetId: z.ZodString;
    category: z.ZodString;
    subcategory: z.ZodOptional<z.ZodString>;
    tags: z.ZodArray<z.ZodString>;
    attributes: z.ZodOptional<z.ZodObject<{
        color: z.ZodOptional<z.ZodString>;
        size: z.ZodOptional<z.ZodString>;
        shape: z.ZodOptional<z.ZodString>;
        habitat: z.ZodOptional<z.ZodString>;
        location: z.ZodOptional<z.ZodString>;
        type: z.ZodOptional<z.ZodString>;
        count: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
    difficulty: z.ZodUnion<readonly [z.ZodLiteral<1>, z.ZodLiteral<2>, z.ZodLiteral<3>, z.ZodLiteral<4>]>;
    enabled: z.ZodBoolean;
    origin: z.ZodEnum<{
        CUSTOM: "CUSTOM";
        SYSTEM: "SYSTEM";
    }>;
}, z.core.$strip>;
export declare const learningDeckSchema: z.ZodObject<{
    id: z.ZodString;
    title: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    narrationTitle: z.ZodOptional<z.ZodString>;
    category: z.ZodString;
    ageBand: z.ZodOptional<z.ZodString>;
    supportedModes: z.ZodArray<z.ZodEnum<{
        LEARN_AND_CHOOSE: "LEARN_AND_CHOOSE";
        SAME_OR_DIFFERENT: "SAME_OR_DIFFERENT";
        MATCHING: "MATCHING";
        ODD_ONE_OUT: "ODD_ONE_OUT";
        COMPARE: "COMPARE";
    }>>;
    cardIds: z.ZodArray<z.ZodString>;
    enabled: z.ZodBoolean;
    origin: z.ZodEnum<{
        CUSTOM: "CUSTOM";
        SYSTEM: "SYSTEM";
    }>;
}, z.core.$strip>;
export declare const learningRelationshipSchema: z.ZodObject<{
    id: z.ZodString;
    sourceCardId: z.ZodString;
    targetCardId: z.ZodString;
    type: z.ZodEnum<{
        MATCHES: "MATCHES";
        USED_WITH: "USED_WITH";
        LIVES_IN: "LIVES_IN";
        BELONGS_IN: "BELONGS_IN";
        PRODUCES: "PRODUCES";
        WEARS: "WEARS";
        PART_OF: "PART_OF";
    }>;
    narration: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const createKidsChildProfileSchema: z.ZodObject<{
    householdId: z.ZodString;
    displayName: z.ZodString;
    avatar: z.ZodDefault<z.ZodString>;
}, z.core.$strip>;
export declare const updateKidsSettingsSchema: z.ZodObject<{
    householdId: z.ZodString;
    childProfileId: z.ZodString;
    narrationEnabled: z.ZodBoolean;
    soundEffectsEnabled: z.ZodBoolean;
    animationsEnabled: z.ZodBoolean;
    sessionLength: z.ZodUnion<readonly [z.ZodLiteral<5>, z.ZodLiteral<10>, z.ZodLiteral<15>]>;
    difficultyMode: z.ZodEnum<{
        MEDIUM: "MEDIUM";
        AUTO: "AUTO";
        EASY: "EASY";
        HARD: "HARD";
    }>;
}, z.core.$strip>;
export declare const startKidsSessionSchema: z.ZodObject<{
    householdId: z.ZodString;
    sessionId: z.ZodString;
    childProfileId: z.ZodString;
    mode: z.ZodEnum<{
        LEARN_AND_CHOOSE: "LEARN_AND_CHOOSE";
        SAME_OR_DIFFERENT: "SAME_OR_DIFFERENT";
        MATCHING: "MATCHING";
        ODD_ONE_OUT: "ODD_ONE_OUT";
        COMPARE: "COMPARE";
    }>;
    deckIds: z.ZodArray<z.ZodString>;
    difficulty: z.ZodUnion<readonly [z.ZodLiteral<1>, z.ZodLiteral<2>, z.ZodLiteral<3>, z.ZodLiteral<4>]>;
    plannedRounds: z.ZodUnion<readonly [z.ZodLiteral<5>, z.ZodLiteral<10>, z.ZodLiteral<15>]>;
}, z.core.$strip>;
export declare const persistKidsAttemptSchema: z.ZodObject<{
    householdId: z.ZodString;
    sessionId: z.ZodString;
    attemptId: z.ZodString;
    childProfileId: z.ZodString;
    mode: z.ZodEnum<{
        LEARN_AND_CHOOSE: "LEARN_AND_CHOOSE";
        SAME_OR_DIFFERENT: "SAME_OR_DIFFERENT";
        MATCHING: "MATCHING";
        ODD_ONE_OUT: "ODD_ONE_OUT";
        COMPARE: "COMPARE";
    }>;
    roundId: z.ZodString;
    contentId: z.ZodString;
    deckId: z.ZodString;
    selectedOptionIds: z.ZodArray<z.ZodString>;
    isCorrect: z.ZodBoolean;
    attemptCount: z.ZodNumber;
    difficulty: z.ZodUnion<readonly [z.ZodLiteral<1>, z.ZodLiteral<2>, z.ZodLiteral<3>, z.ZodLiteral<4>]>;
}, z.core.$strip>;
export declare const completeKidsSessionSchema: z.ZodObject<{
    householdId: z.ZodString;
    sessionId: z.ZodString;
    childProfileId: z.ZodString;
    completedRounds: z.ZodNumber;
}, z.core.$strip>;
export declare const kidsComparisonDimensionSchema: z.ZodEnum<{
    OBJECT: "OBJECT";
    COLOR: "COLOR";
    SIZE: "SIZE";
    SHAPE: "SHAPE";
    COUNT: "COUNT";
    ORIENTATION: "ORIENTATION";
    DETAIL: "DETAIL";
}>;
export declare const kidsCompareRelationSchema: z.ZodEnum<{
    BIGGER: "BIGGER";
    SMALLER: "SMALLER";
    MORE: "MORE";
    LESS: "LESS";
    TALLER: "TALLER";
    SHORTER: "SHORTER";
    FULL: "FULL";
    EMPTY: "EMPTY";
    INSIDE: "INSIDE";
    OUTSIDE: "OUTSIDE";
    UP: "UP";
    DOWN: "DOWN";
}>;
export type CreateKidsChildProfileInput = z.infer<typeof createKidsChildProfileSchema>;
export type UpdateKidsSettingsInput = z.infer<typeof updateKidsSettingsSchema>;
export type StartKidsSessionInput = z.infer<typeof startKidsSessionSchema>;
export type PersistKidsAttemptInput = z.infer<typeof persistKidsAttemptSchema>;
export type CompleteKidsSessionInput = z.infer<typeof completeKidsSessionSchema>;
//# sourceMappingURL=kids.d.ts.map