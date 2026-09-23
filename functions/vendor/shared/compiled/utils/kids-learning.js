export const SPACED_LEARNING_MIX = {
    LEARNING: 0.4,
    NEW: 0.3,
    FAMILIAR: 0.3,
};
export function applySpacedLearning(current, correct) {
    const recognitionAttempts = current.recognitionAttempts + 1;
    const recognitionSuccesses = current.recognitionSuccesses + Number(correct);
    const consecutiveSuccesses = correct ? current.consecutiveSuccesses + 1 : 0;
    const recentMisses = correct ? 0 : current.recentMisses + 1;
    let status = current.status === 'NEW' ? 'LEARNING' : current.status;
    if (status === 'LEARNING' &&
        recognitionAttempts >= 4 &&
        recognitionSuccesses >= 3 &&
        consecutiveSuccesses >= 2)
        status = 'FAMILIAR';
    if (status === 'FAMILIAR' && recentMisses >= 2)
        status = 'LEARNING';
    const nextIntervalDays = !correct ? 0 : status === 'FAMILIAR' ? 14 : 2;
    return {
        exposureCount: current.exposureCount + 1,
        recognitionAttempts,
        recognitionSuccesses,
        consecutiveSuccesses,
        recentMisses,
        status,
        nextIntervalDays,
    };
}
export const DIFFICULTY_CONFIG = {
    windowSize: 8,
    minimumSamples: 5,
    increaseSuccessRate: 0.8,
    decreaseSuccessRate: 0.4,
    maximumHintRate: 0.2,
    cooldownSamples: 6,
};
export function updateModeDifficulty(current, fallbackLevel, sample) {
    const previous = current ?? {
        level: fallbackLevel,
        totalSamples: 0,
        lastChangeAtSample: 0,
        recent: [],
    };
    const totalSamples = previous.totalSamples + 1;
    const recent = [...previous.recent, sample].slice(-DIFFICULTY_CONFIG.windowSize);
    const enough = recent.length >= DIFFICULTY_CONFIG.minimumSamples;
    const cooledDown = totalSamples - previous.lastChangeAtSample >= DIFFICULTY_CONFIG.cooldownSamples;
    let level = previous.level;
    let lastChangeAtSample = previous.lastChangeAtSample;
    if (enough && cooledDown) {
        const successRate = recent.filter((item) => item.success).length / recent.length;
        const hintRate = recent.filter((item) => item.usedHint).length / recent.length;
        if (successRate >= DIFFICULTY_CONFIG.increaseSuccessRate &&
            hintRate <= DIFFICULTY_CONFIG.maximumHintRate &&
            level < 4) {
            level = (level + 1);
            lastChangeAtSample = totalSamples;
        }
        else if (successRate <= DIFFICULTY_CONFIG.decreaseSuccessRate && level > 1) {
            level = (level - 1);
            lastChangeAtSample = totalSamples;
        }
    }
    return { level, totalSamples, lastChangeAtSample, recent };
}
