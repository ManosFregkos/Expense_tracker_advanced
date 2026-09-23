import type { CardFamiliarity, KidsCardGameMode, KidsDifficulty, KidsSettings } from '../domain/types.js';
export declare const SPACED_LEARNING_MIX: {
    readonly LEARNING: 0.4;
    readonly NEW: 0.3;
    readonly FAMILIAR: 0.3;
};
export interface LearningMemorySnapshot {
    exposureCount: number;
    recognitionAttempts: number;
    recognitionSuccesses: number;
    consecutiveSuccesses: number;
    recentMisses: number;
    status: CardFamiliarity;
}
export declare function applySpacedLearning(current: LearningMemorySnapshot, correct: boolean): LearningMemorySnapshot & {
    nextIntervalDays: number;
};
export declare const DIFFICULTY_CONFIG: {
    readonly windowSize: 8;
    readonly minimumSamples: 5;
    readonly increaseSuccessRate: 0.8;
    readonly decreaseSuccessRate: 0.4;
    readonly maximumHintRate: 0.2;
    readonly cooldownSamples: 6;
};
export type ModeDifficultyState = NonNullable<KidsSettings['modeDifficultyState']>[KidsCardGameMode];
export declare function updateModeDifficulty(current: ModeDifficultyState | undefined, fallbackLevel: KidsDifficulty, sample: {
    success: boolean;
    usedHint: boolean;
}): NonNullable<ModeDifficultyState>;
//# sourceMappingURL=kids-learning.d.ts.map