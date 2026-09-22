import { z } from 'zod';
import type { StoredDate } from '../domain/types.js';
export declare const kidsGameTypeSchema: z.ZodEnum<{
    EXPLORER: "EXPLORER";
    MEMORY: "MEMORY";
    LOGIC: "LOGIC";
}>;
export type KidsGameType = z.infer<typeof kidsGameTypeSchema>;
export declare const kidsSkillSchema: z.ZodEnum<{
    MEMORY: "MEMORY";
    LOGIC: "LOGIC";
    OBSERVATION: "OBSERVATION";
    VOCABULARY: "VOCABULARY";
    CLASSIFICATION: "CLASSIFICATION";
    COUNTING: "COUNTING";
    CAUSE_EFFECT: "CAUSE_EFFECT";
    SPATIAL: "SPATIAL";
}>;
export type KidsSkill = z.infer<typeof kidsSkillSchema>;
export declare const childAgeBandSchema: z.ZodEnum<{
    "2_PLUS": "2_PLUS";
    "3_PLUS": "3_PLUS";
    "4_PLUS": "4_PLUS";
    "5_PLUS": "5_PLUS";
}>;
export declare const kidsDifficultyModeSchema: z.ZodEnum<{
    AUTO: "AUTO";
    EASY: "EASY";
    MEDIUM: "MEDIUM";
    HARD: "HARD";
}>;
export declare const childProfileInputSchema: z.ZodObject<{
    householdId: z.ZodString;
    childProfileId: z.ZodOptional<z.ZodString>;
    displayName: z.ZodString;
    avatarId: z.ZodDefault<z.ZodEnum<{
        star: "star";
        moon: "moon";
        sun: "sun";
        flower: "flower";
    }>>;
    ageBand: z.ZodDefault<z.ZodEnum<{
        "2_PLUS": "2_PLUS";
        "3_PLUS": "3_PLUS";
        "4_PLUS": "4_PLUS";
        "5_PLUS": "5_PLUS";
    }>>;
    preferredLanguage: z.ZodDefault<z.ZodLiteral<"el-GR">>;
    defaultDifficultyMode: z.ZodDefault<z.ZodEnum<{
        AUTO: "AUTO";
        EASY: "EASY";
        MEDIUM: "MEDIUM";
        HARD: "HARD";
    }>>;
    sessionLength: z.ZodDefault<z.ZodUnion<readonly [z.ZodLiteral<5>, z.ZodLiteral<10>, z.ZodLiteral<15>]>>;
    soundEnabled: z.ZodDefault<z.ZodBoolean>;
    narrationEnabled: z.ZodDefault<z.ZodBoolean>;
    animationsEnabled: z.ZodDefault<z.ZodBoolean>;
}, z.core.$strip>;
export type ChildProfileInput = z.infer<typeof childProfileInputSchema>;
export type ChildProfile = ChildProfileInput & {
    id: string;
    createdBy: string;
    createdAt: StoredDate;
    updatedAt: StoredDate;
    archivedAt?: StoredDate;
};
export interface KidsGameSession {
    id: string;
    householdId: string;
    childProfileId: string;
    gameType: KidsGameType;
    worldId?: string;
    createdBy: string;
    roundCount: number;
    completedRoundCount: number;
    startedAt: StoredDate;
    completedAt?: StoredDate;
    createdAt: StoredDate;
}
export interface KidsGameAttempt {
    id: string;
    householdId: string;
    childProfileId: string;
    sessionId: string;
    roundId: string;
    gameType: KidsGameType;
    contentId: string;
    skill: KidsSkill;
    difficulty: number;
    isCorrect: boolean;
    attemptCount: number;
    createdAt: StoredDate;
}
export interface KidsGameProgress {
    householdId: string;
    childProfileId: string;
    gameType: KidsGameType;
    currentDifficulty: number;
    sessionsPlayed: number;
    roundsPlayed: number;
    skillExposure: Partial<Record<KidsSkill, number>>;
    recentResults: boolean[];
    roundsSinceChange: number;
    lastPlayedAt?: StoredDate;
    updatedAt: StoredDate;
}
export declare const customLogicSchema: z.ZodObject<{
    householdId: z.ZodString;
    contentId: z.ZodOptional<z.ZodString>;
    title: z.ZodString;
    difficulty: z.ZodNumber;
    skill: z.ZodEnum<{
        LOGIC: "LOGIC";
        CLASSIFICATION: "CLASSIFICATION";
        CAUSE_EFFECT: "CAUSE_EFFECT";
    }>;
    narrationText: z.ZodString;
    illustrationAssetId: z.ZodEnum<{
        moon: "moon";
        sun: "sun";
        flower: "flower";
        fish: "fish";
        octopus: "octopus";
        dolphin: "dolphin";
        turtle: "turtle";
        crab: "crab";
        starfish: "starfish";
        shell: "shell";
        seaweed: "seaweed";
        treasure: "treasure";
        elephant: "elephant";
        monkey: "monkey";
        parrot: "parrot";
        tiger: "tiger";
        snake: "snake";
        frog: "frog";
        banana: "banana";
        butterfly: "butterfly";
        tree: "tree";
        earth: "earth";
        rocket: "rocket";
        astronaut: "astronaut";
        stars: "stars";
        planet: "planet";
        satellite: "satellite";
        comet: "comet";
        apple: "apple";
        pear: "pear";
        orange: "orange";
        cat: "cat";
        dog: "dog";
        bird: "bird";
        umbrella: "umbrella";
        cloud: "cloud";
        rain: "rain";
        water: "water";
        ice: "ice";
        cup: "cup";
        pillow: "pillow";
        glasses: "glasses";
        sleep: "sleep";
        ball: "ball";
        book: "book";
        seed: "seed";
        bread: "bread";
        lamp: "lamp";
        hat: "hat";
        shoes: "shoes";
        plate: "plate";
        friend: "friend";
        hand: "hand";
        towel: "towel";
    }>;
    options: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        assetId: z.ZodEnum<{
            moon: "moon";
            sun: "sun";
            flower: "flower";
            fish: "fish";
            octopus: "octopus";
            dolphin: "dolphin";
            turtle: "turtle";
            crab: "crab";
            starfish: "starfish";
            shell: "shell";
            seaweed: "seaweed";
            treasure: "treasure";
            elephant: "elephant";
            monkey: "monkey";
            parrot: "parrot";
            tiger: "tiger";
            snake: "snake";
            frog: "frog";
            banana: "banana";
            butterfly: "butterfly";
            tree: "tree";
            earth: "earth";
            rocket: "rocket";
            astronaut: "astronaut";
            stars: "stars";
            planet: "planet";
            satellite: "satellite";
            comet: "comet";
            apple: "apple";
            pear: "pear";
            orange: "orange";
            cat: "cat";
            dog: "dog";
            bird: "bird";
            umbrella: "umbrella";
            cloud: "cloud";
            rain: "rain";
            water: "water";
            ice: "ice";
            cup: "cup";
            pillow: "pillow";
            glasses: "glasses";
            sleep: "sleep";
            ball: "ball";
            book: "book";
            seed: "seed";
            bread: "bread";
            lamp: "lamp";
            hat: "hat";
            shoes: "shoes";
            plate: "plate";
            friend: "friend";
            hand: "hand";
            towel: "towel";
        }>;
        label: z.ZodString;
        isPreferredAnswer: z.ZodBoolean;
        explanationNarration: z.ZodOptional<z.ZodString>;
        nextNodeId: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type CustomLogicInput = z.infer<typeof customLogicSchema>;
export declare const startKidsSessionSchema: z.ZodObject<{
    householdId: z.ZodString;
    childProfileId: z.ZodString;
    gameType: z.ZodEnum<{
        EXPLORER: "EXPLORER";
        MEMORY: "MEMORY";
        LOGIC: "LOGIC";
    }>;
    worldId: z.ZodOptional<z.ZodEnum<{
        underwater: "underwater";
        jungle: "jungle";
        space: "space";
    }>>;
    sessionId: z.ZodString;
}, z.core.$strip>;
export declare const completeKidsRoundSchema: z.ZodObject<{
    householdId: z.ZodString;
    childProfileId: z.ZodString;
    sessionId: z.ZodString;
    roundId: z.ZodString;
    contentId: z.ZodString;
    skill: z.ZodEnum<{
        MEMORY: "MEMORY";
        LOGIC: "LOGIC";
        OBSERVATION: "OBSERVATION";
        VOCABULARY: "VOCABULARY";
        CLASSIFICATION: "CLASSIFICATION";
        COUNTING: "COUNTING";
        CAUSE_EFFECT: "CAUSE_EFFECT";
        SPATIAL: "SPATIAL";
    }>;
    difficulty: z.ZodNumber;
    isCorrect: z.ZodBoolean;
    attemptCount: z.ZodNumber;
}, z.core.$strip>;
export declare const completeKidsSessionSchema: z.ZodObject<{
    householdId: z.ZodString;
    childProfileId: z.ZodString;
    sessionId: z.ZodString;
}, z.core.$strip>;
export declare const archiveKidsContentSchema: z.ZodObject<{
    householdId: z.ZodString;
    contentId: z.ZodString;
}, z.core.$strip>;
//# sourceMappingURL=kids.d.ts.map