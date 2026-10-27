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
    contentVersion: z.ZodOptional<z.ZodNumber>;
    householdId: z.ZodOptional<z.ZodString>;
    createdBy: z.ZodOptional<z.ZodString>;
    createdAt: z.ZodOptional<z.ZodUnknown>;
    updatedAt: z.ZodOptional<z.ZodUnknown>;
    archivedAt: z.ZodOptional<z.ZodUnknown>;
    alternativeNarration: z.ZodOptional<z.ZodString>;
    assetUrl: z.ZodOptional<z.ZodString>;
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
        EVERYDAY_CHOICE: "EVERYDAY_CHOICE";
        CLASSIFY: "CLASSIFY";
        SEQUENCE: "SEQUENCE";
        EMOTION: "EMOTION";
        MEMORY_PAIRS: "MEMORY_PAIRS";
        COUNT_FINGERS: "COUNT_FINGERS";
        MATCH_FINGERS_TO_NUMBER: "MATCH_FINGERS_TO_NUMBER";
        COMPARE_QUANTITY: "COMPARE_QUANTITY";
        COUNT_OBJECTS: "COUNT_OBJECTS";
        MATCH_QUANTITY_TO_NUMBER: "MATCH_QUANTITY_TO_NUMBER";
        SIMPLE_SUM: "SIMPLE_SUM";
        LEARN_FLAG: "LEARN_FLAG";
        FIND_FLAG: "FIND_FLAG";
        PATTERN_COMPLETE: "PATTERN_COMPLETE";
        SPATIAL_CONCEPT: "SPATIAL_CONCEPT";
        MIXED_PLAY: "MIXED_PLAY";
    }>>;
    cardIds: z.ZodArray<z.ZodString>;
    enabled: z.ZodBoolean;
    origin: z.ZodEnum<{
        CUSTOM: "CUSTOM";
        SYSTEM: "SYSTEM";
    }>;
    contentVersion: z.ZodOptional<z.ZodNumber>;
    householdId: z.ZodOptional<z.ZodString>;
    createdBy: z.ZodOptional<z.ZodString>;
    createdAt: z.ZodOptional<z.ZodUnknown>;
    updatedAt: z.ZodOptional<z.ZodUnknown>;
    archivedAt: z.ZodOptional<z.ZodUnknown>;
    icon: z.ZodOptional<z.ZodString>;
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
        STORED_IN: "STORED_IN";
        USED_IN: "USED_IN";
        PRODUCES: "PRODUCES";
        WEARS: "WEARS";
        WORN_ON: "WORN_ON";
        PART_OF: "PART_OF";
        USES: "USES";
    }>;
    narration: z.ZodOptional<z.ZodString>;
    householdId: z.ZodOptional<z.ZodString>;
    createdBy: z.ZodOptional<z.ZodString>;
    createdAt: z.ZodOptional<z.ZodUnknown>;
    updatedAt: z.ZodOptional<z.ZodUnknown>;
    enabled: z.ZodOptional<z.ZodBoolean>;
    origin: z.ZodOptional<z.ZodEnum<{
        CUSTOM: "CUSTOM";
        SYSTEM: "SYSTEM";
    }>>;
    archivedAt: z.ZodOptional<z.ZodUnknown>;
}, z.core.$strip>;
export declare const everydayScenarioSchema: z.ZodObject<{
    id: z.ZodString;
    topic: z.ZodEnum<{
        HYGIENE: "HYGIENE";
        KINDNESS: "KINDNESS";
        SAFETY: "SAFETY";
        HOME: "HOME";
        ROUTINE: "ROUTINE";
        ANIMALS: "ANIMALS";
        SOCIAL: "SOCIAL";
        FOOD: "FOOD";
        WEATHER: "WEATHER";
    }>;
    subtopic: z.ZodOptional<z.ZodEnum<{
        RAIN: "RAIN";
        SUN: "SUN";
        COLD: "COLD";
        SNOW: "SNOW";
        WIND: "WIND";
    }>>;
    narration: z.ZodString;
    situationAssetId: z.ZodOptional<z.ZodString>;
    choices: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        assetId: z.ZodString;
        narration: z.ZodString;
    }, z.core.$strip>>;
    preferredChoiceId: z.ZodString;
    explanationNarration: z.ZodString;
    difficulty: z.ZodUnion<readonly [z.ZodLiteral<1>, z.ZodLiteral<2>, z.ZodLiteral<3>, z.ZodLiteral<4>]>;
    enabled: z.ZodBoolean;
    origin: z.ZodEnum<{
        CUSTOM: "CUSTOM";
        SYSTEM: "SYSTEM";
    }>;
    householdId: z.ZodOptional<z.ZodString>;
    createdBy: z.ZodOptional<z.ZodString>;
    createdAt: z.ZodOptional<z.ZodUnknown>;
    updatedAt: z.ZodOptional<z.ZodUnknown>;
    archivedAt: z.ZodOptional<z.ZodUnknown>;
}, z.core.$strip>;
export declare const patternElementSchema: z.ZodObject<{
    id: z.ZodString;
    assetId: z.ZodString;
    narration: z.ZodOptional<z.ZodString>;
    semanticType: z.ZodEnum<{
        OBJECT: "OBJECT";
        COLOR: "COLOR";
        SHAPE: "SHAPE";
    }>;
    value: z.ZodString;
}, z.core.$strip>;
export declare const patternDefinitionSchema: z.ZodObject<{
    id: z.ZodString;
    type: z.ZodEnum<{
        ABAB: "ABAB";
        AABB: "AABB";
        AAB: "AAB";
        ABB: "ABB";
        AAA_B: "AAA_B";
        REPEATED_BLOCK: "REPEATED_BLOCK";
    }>;
    elements: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        assetId: z.ZodString;
        narration: z.ZodOptional<z.ZodString>;
        semanticType: z.ZodEnum<{
            OBJECT: "OBJECT";
            COLOR: "COLOR";
            SHAPE: "SHAPE";
        }>;
        value: z.ZodString;
    }, z.core.$strip>>;
    missingIndex: z.ZodNumber;
    correctElement: z.ZodObject<{
        id: z.ZodString;
        assetId: z.ZodString;
        narration: z.ZodOptional<z.ZodString>;
        semanticType: z.ZodEnum<{
            OBJECT: "OBJECT";
            COLOR: "COLOR";
            SHAPE: "SHAPE";
        }>;
        value: z.ZodString;
    }, z.core.$strip>;
    distractorElements: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        assetId: z.ZodString;
        narration: z.ZodOptional<z.ZodString>;
        semanticType: z.ZodEnum<{
            OBJECT: "OBJECT";
            COLOR: "COLOR";
            SHAPE: "SHAPE";
        }>;
        value: z.ZodString;
    }, z.core.$strip>>;
    narration: z.ZodString;
    explanationNarration: z.ZodString;
    difficulty: z.ZodUnion<readonly [z.ZodLiteral<1>, z.ZodLiteral<2>, z.ZodLiteral<3>, z.ZodLiteral<4>]>;
    category: z.ZodEnum<{
        OBJECT: "OBJECT";
        COLOR: "COLOR";
        SHAPE: "SHAPE";
    }>;
    enabled: z.ZodBoolean;
    origin: z.ZodEnum<{
        CUSTOM: "CUSTOM";
        SYSTEM: "SYSTEM";
    }>;
    householdId: z.ZodOptional<z.ZodString>;
    createdBy: z.ZodOptional<z.ZodString>;
    createdAt: z.ZodOptional<z.ZodUnknown>;
    updatedAt: z.ZodOptional<z.ZodUnknown>;
    archivedAt: z.ZodOptional<z.ZodUnknown>;
}, z.core.$strip>;
export declare const spatialChoiceSchema: z.ZodObject<{
    id: z.ZodString;
    assetId: z.ZodString;
    narration: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const spatialScenarioSchema: z.ZodObject<{
    id: z.ZodString;
    concept: z.ZodEnum<{
        INSIDE: "INSIDE";
        OUTSIDE: "OUTSIDE";
        ABOVE: "ABOVE";
        BELOW: "BELOW";
        IN_FRONT_OF: "IN_FRONT_OF";
        BEHIND: "BEHIND";
        NEXT_TO: "NEXT_TO";
        BETWEEN: "BETWEEN";
    }>;
    narration: z.ZodString;
    promptStyle: z.ZodEnum<{
        FIND_CORRECT_SCENE: "FIND_CORRECT_SCENE";
        FIND_CORRECT_OBJECT: "FIND_CORRECT_OBJECT";
    }>;
    choices: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        assetId: z.ZodString;
        narration: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    correctChoiceId: z.ZodString;
    explanationNarration: z.ZodString;
    difficulty: z.ZodUnion<readonly [z.ZodLiteral<1>, z.ZodLiteral<2>, z.ZodLiteral<3>, z.ZodLiteral<4>]>;
    enabled: z.ZodBoolean;
    origin: z.ZodEnum<{
        CUSTOM: "CUSTOM";
        SYSTEM: "SYSTEM";
    }>;
    householdId: z.ZodOptional<z.ZodString>;
    createdBy: z.ZodOptional<z.ZodString>;
    createdAt: z.ZodOptional<z.ZodUnknown>;
    updatedAt: z.ZodOptional<z.ZodUnknown>;
    archivedAt: z.ZodOptional<z.ZodUnknown>;
}, z.core.$strip>;
export declare const patternCompleteRoundSchema: z.ZodObject<{
    id: z.ZodString;
    difficulty: z.ZodUnion<readonly [z.ZodLiteral<1>, z.ZodLiteral<2>, z.ZodLiteral<3>, z.ZodLiteral<4>]>;
    deckId: z.ZodString;
    instructionText: z.ZodString;
    narrationText: z.ZodString;
    skill: z.ZodString;
    contentIds: z.ZodArray<z.ZodString>;
    mode: z.ZodLiteral<"PATTERN_COMPLETE">;
    patternId: z.ZodString;
    patternType: z.ZodEnum<{
        ABAB: "ABAB";
        AABB: "AABB";
        AAB: "AAB";
        ABB: "ABB";
        AAA_B: "AAA_B";
        REPEATED_BLOCK: "REPEATED_BLOCK";
    }>;
    slots: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        assetId: z.ZodString;
        narration: z.ZodOptional<z.ZodString>;
        semanticType: z.ZodEnum<{
            OBJECT: "OBJECT";
            COLOR: "COLOR";
            SHAPE: "SHAPE";
        }>;
        value: z.ZodString;
        missing: z.ZodBoolean;
    }, z.core.$strip>>;
    options: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        assetId: z.ZodString;
        narration: z.ZodOptional<z.ZodString>;
        semanticType: z.ZodEnum<{
            OBJECT: "OBJECT";
            COLOR: "COLOR";
            SHAPE: "SHAPE";
        }>;
        value: z.ZodString;
    }, z.core.$strip>>;
    correctElementId: z.ZodString;
    explanationNarration: z.ZodString;
    conceptId: z.ZodString;
    conceptType: z.ZodLiteral<"PATTERN">;
}, z.core.$strip>;
export declare const spatialConceptRoundSchema: z.ZodObject<{
    id: z.ZodString;
    difficulty: z.ZodUnion<readonly [z.ZodLiteral<1>, z.ZodLiteral<2>, z.ZodLiteral<3>, z.ZodLiteral<4>]>;
    deckId: z.ZodString;
    instructionText: z.ZodString;
    narrationText: z.ZodString;
    skill: z.ZodString;
    contentIds: z.ZodArray<z.ZodString>;
    mode: z.ZodLiteral<"SPATIAL_CONCEPT">;
    scenarioId: z.ZodString;
    concept: z.ZodEnum<{
        INSIDE: "INSIDE";
        OUTSIDE: "OUTSIDE";
        ABOVE: "ABOVE";
        BELOW: "BELOW";
        IN_FRONT_OF: "IN_FRONT_OF";
        BEHIND: "BEHIND";
        NEXT_TO: "NEXT_TO";
        BETWEEN: "BETWEEN";
    }>;
    promptStyle: z.ZodEnum<{
        FIND_CORRECT_SCENE: "FIND_CORRECT_SCENE";
        FIND_CORRECT_OBJECT: "FIND_CORRECT_OBJECT";
    }>;
    options: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        assetId: z.ZodString;
        narration: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    correctChoiceId: z.ZodString;
    explanationNarration: z.ZodString;
    conceptId: z.ZodString;
    conceptType: z.ZodLiteral<"SPATIAL">;
}, z.core.$strip>;
export declare const sequenceDefinitionSchema: z.ZodObject<{
    id: z.ZodString;
    title: z.ZodOptional<z.ZodString>;
    steps: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        assetId: z.ZodString;
        narration: z.ZodString;
    }, z.core.$strip>>;
    narration: z.ZodString;
    explanationNarration: z.ZodOptional<z.ZodString>;
    difficulty: z.ZodUnion<readonly [z.ZodLiteral<1>, z.ZodLiteral<2>, z.ZodLiteral<3>, z.ZodLiteral<4>]>;
    category: z.ZodString;
    enabled: z.ZodBoolean;
    origin: z.ZodEnum<{
        CUSTOM: "CUSTOM";
        SYSTEM: "SYSTEM";
    }>;
    householdId: z.ZodOptional<z.ZodString>;
    createdBy: z.ZodOptional<z.ZodString>;
    createdAt: z.ZodOptional<z.ZodUnknown>;
    updatedAt: z.ZodOptional<z.ZodUnknown>;
    archivedAt: z.ZodOptional<z.ZodUnknown>;
}, z.core.$strip>;
export declare const emotionScenarioSchema: z.ZodObject<{
    id: z.ZodString;
    sceneAssetId: z.ZodString;
    narration: z.ZodString;
    options: z.ZodArray<z.ZodEnum<{
        HAPPY: "HAPPY";
        SAD: "SAD";
        ANGRY: "ANGRY";
        SCARED: "SCARED";
        SURPRISED: "SURPRISED";
        TIRED: "TIRED";
    }>>;
    expectedEmotion: z.ZodEnum<{
        HAPPY: "HAPPY";
        SAD: "SAD";
        ANGRY: "ANGRY";
        SCARED: "SCARED";
        SURPRISED: "SURPRISED";
        TIRED: "TIRED";
    }>;
    explanationNarration: z.ZodOptional<z.ZodString>;
    difficulty: z.ZodUnion<readonly [z.ZodLiteral<1>, z.ZodLiteral<2>, z.ZodLiteral<3>, z.ZodLiteral<4>]>;
    enabled: z.ZodBoolean;
    origin: z.ZodEnum<{
        CUSTOM: "CUSTOM";
        SYSTEM: "SYSTEM";
    }>;
    householdId: z.ZodOptional<z.ZodString>;
    createdBy: z.ZodOptional<z.ZodString>;
    createdAt: z.ZodOptional<z.ZodUnknown>;
    updatedAt: z.ZodOptional<z.ZodUnknown>;
    archivedAt: z.ZodOptional<z.ZodUnknown>;
}, z.core.$strip>;
export declare const kidsAssetMetadataSchema: z.ZodObject<{
    id: z.ZodString;
    householdId: z.ZodString;
    storagePath: z.ZodString;
    downloadUrl: z.ZodString;
    mimeType: z.ZodEnum<{
        "image/jpeg": "image/jpeg";
        "image/png": "image/png";
        "image/webp": "image/webp";
    }>;
    size: z.ZodNumber;
    width: z.ZodOptional<z.ZodNumber>;
    height: z.ZodOptional<z.ZodNumber>;
    createdBy: z.ZodString;
    createdAt: z.ZodUnknown;
}, z.core.$strip>;
export declare const kidsCustomContentKindSchema: z.ZodEnum<{
    SEQUENCE: "SEQUENCE";
    PATTERN: "PATTERN";
    DECK: "DECK";
    CARD: "CARD";
    RELATIONSHIP: "RELATIONSHIP";
    EVERYDAY_SCENARIO: "EVERYDAY_SCENARIO";
    EMOTION_SCENARIO: "EMOTION_SCENARIO";
    SPATIAL_SCENARIO: "SPATIAL_SCENARIO";
}>;
export declare const saveKidsCustomContentSchema: z.ZodObject<{
    householdId: z.ZodString;
    kind: z.ZodEnum<{
        SEQUENCE: "SEQUENCE";
        PATTERN: "PATTERN";
        DECK: "DECK";
        CARD: "CARD";
        RELATIONSHIP: "RELATIONSHIP";
        EVERYDAY_SCENARIO: "EVERYDAY_SCENARIO";
        EMOTION_SCENARIO: "EMOTION_SCENARIO";
        SPATIAL_SCENARIO: "SPATIAL_SCENARIO";
    }>;
    content: z.ZodRecord<z.ZodString, z.ZodUnknown>;
}, z.core.$strip>;
export declare const archiveKidsCustomContentSchema: z.ZodObject<{
    householdId: z.ZodString;
    kind: z.ZodEnum<{
        SEQUENCE: "SEQUENCE";
        PATTERN: "PATTERN";
        DECK: "DECK";
        CARD: "CARD";
        RELATIONSHIP: "RELATIONSHIP";
        EVERYDAY_SCENARIO: "EVERYDAY_SCENARIO";
        EMOTION_SCENARIO: "EMOTION_SCENARIO";
        SPATIAL_SCENARIO: "SPATIAL_SCENARIO";
    }>;
    contentId: z.ZodString;
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
    earlyMath: z.ZodOptional<z.ZodObject<{
        numberRange: z.ZodEnum<{
            ONE_TO_THREE: "ONE_TO_THREE";
            ONE_TO_FIVE: "ONE_TO_FIVE";
        }>;
        addition: z.ZodEnum<{
            OFF: "OFF";
            WITHIN_THREE: "WITHIN_THREE";
            WITHIN_FIVE: "WITHIN_FIVE";
        }>;
        showNumerals: z.ZodEnum<{
            AUTO: "AUTO";
            OFF: "OFF";
            ON: "ON";
        }>;
        fingersEnabled: z.ZodBoolean;
        countObjectsEnabled: z.ZodBoolean;
    }, z.core.$strip>>;
    flags: z.ZodOptional<z.ZodObject<{
        enabled: z.ZodBoolean;
        tier: z.ZodEnum<{
            AUTO: "AUTO";
            STARTER: "STARTER";
            EXPANDED: "EXPANDED";
        }>;
        newPerSession: z.ZodUnion<readonly [z.ZodLiteral<2>, z.ZodLiteral<3>, z.ZodLiteral<4>]>;
    }, z.core.$strip>>;
    contentAreas: z.ZodOptional<z.ZodObject<{
        patterns: z.ZodBoolean;
        spatial: z.ZodBoolean;
        weather: z.ZodBoolean;
        professions: z.ZodBoolean;
    }, z.core.$strip>>;
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
        EVERYDAY_CHOICE: "EVERYDAY_CHOICE";
        CLASSIFY: "CLASSIFY";
        SEQUENCE: "SEQUENCE";
        EMOTION: "EMOTION";
        MEMORY_PAIRS: "MEMORY_PAIRS";
        COUNT_FINGERS: "COUNT_FINGERS";
        MATCH_FINGERS_TO_NUMBER: "MATCH_FINGERS_TO_NUMBER";
        COMPARE_QUANTITY: "COMPARE_QUANTITY";
        COUNT_OBJECTS: "COUNT_OBJECTS";
        MATCH_QUANTITY_TO_NUMBER: "MATCH_QUANTITY_TO_NUMBER";
        SIMPLE_SUM: "SIMPLE_SUM";
        LEARN_FLAG: "LEARN_FLAG";
        FIND_FLAG: "FIND_FLAG";
        PATTERN_COMPLETE: "PATTERN_COMPLETE";
        SPATIAL_CONCEPT: "SPATIAL_CONCEPT";
        MIXED_PLAY: "MIXED_PLAY";
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
        EVERYDAY_CHOICE: "EVERYDAY_CHOICE";
        CLASSIFY: "CLASSIFY";
        SEQUENCE: "SEQUENCE";
        EMOTION: "EMOTION";
        MEMORY_PAIRS: "MEMORY_PAIRS";
        COUNT_FINGERS: "COUNT_FINGERS";
        MATCH_FINGERS_TO_NUMBER: "MATCH_FINGERS_TO_NUMBER";
        COMPARE_QUANTITY: "COMPARE_QUANTITY";
        COUNT_OBJECTS: "COUNT_OBJECTS";
        MATCH_QUANTITY_TO_NUMBER: "MATCH_QUANTITY_TO_NUMBER";
        SIMPLE_SUM: "SIMPLE_SUM";
        LEARN_FLAG: "LEARN_FLAG";
        FIND_FLAG: "FIND_FLAG";
        PATTERN_COMPLETE: "PATTERN_COMPLETE";
        SPATIAL_CONCEPT: "SPATIAL_CONCEPT";
        MIXED_PLAY: "MIXED_PLAY";
    }>;
    roundId: z.ZodString;
    contentId: z.ZodString;
    deckId: z.ZodString;
    selectedOptionIds: z.ZodArray<z.ZodString>;
    isCorrect: z.ZodBoolean;
    attemptCount: z.ZodNumber;
    difficulty: z.ZodUnion<readonly [z.ZodLiteral<1>, z.ZodLiteral<2>, z.ZodLiteral<3>, z.ZodLiteral<4>]>;
    conceptType: z.ZodOptional<z.ZodEnum<{
        WEATHER: "WEATHER";
        PATTERN: "PATTERN";
        SPATIAL: "SPATIAL";
        NUMBER: "NUMBER";
        FLAG: "FLAG";
        COUNTING: "COUNTING";
        ADDITION: "ADDITION";
        QUANTITY: "QUANTITY";
        PROFESSION: "PROFESSION";
    }>>;
    conceptId: z.ZodOptional<z.ZodString>;
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
export type SaveKidsCustomContentInput = z.infer<typeof saveKidsCustomContentSchema>;
export type ArchiveKidsCustomContentInput = z.infer<typeof archiveKidsCustomContentSchema>;
//# sourceMappingURL=kids.d.ts.map