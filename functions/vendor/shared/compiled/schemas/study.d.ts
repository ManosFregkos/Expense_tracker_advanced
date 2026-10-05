import { z } from 'zod';
export declare const studyCourseSchema: z.ZodObject<{
    id: z.ZodString;
    title: z.ZodString;
    description: z.ZodString;
    instructor: z.ZodString;
    url: z.ZodString;
    color: z.ZodEnum<{
        violet: "violet";
        teal: "teal";
        amber: "amber";
        blue: "blue";
    }>;
    createdAt: z.ZodNumber;
}, z.core.$strip>;
export declare const studyNoteSchema: z.ZodObject<{
    id: z.ZodString;
    courseId: z.ZodString;
    title: z.ZodString;
    body: z.ZodString;
    transcript: z.ZodString;
    summary: z.ZodString;
    tags: z.ZodArray<z.ZodString>;
    source: z.ZodString;
    completed: z.ZodBoolean;
    starred: z.ZodBoolean;
    createdAt: z.ZodNumber;
    updatedAt: z.ZodNumber;
}, z.core.$strip>;
export declare const studyCardSchema: z.ZodObject<{
    id: z.ZodString;
    noteId: z.ZodString;
    question: z.ZodString;
    answer: z.ZodString;
    dueAt: z.ZodNumber;
    interval: z.ZodNumber;
    reviews: z.ZodNumber;
}, z.core.$strip>;
export declare const studyLibrarySchema: z.ZodObject<{
    version: z.ZodLiteral<1>;
    courses: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        title: z.ZodString;
        description: z.ZodString;
        instructor: z.ZodString;
        url: z.ZodString;
        color: z.ZodEnum<{
            violet: "violet";
            teal: "teal";
            amber: "amber";
            blue: "blue";
        }>;
        createdAt: z.ZodNumber;
    }, z.core.$strip>>;
    notes: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        courseId: z.ZodString;
        title: z.ZodString;
        body: z.ZodString;
        transcript: z.ZodString;
        summary: z.ZodString;
        tags: z.ZodArray<z.ZodString>;
        source: z.ZodString;
        completed: z.ZodBoolean;
        starred: z.ZodBoolean;
        createdAt: z.ZodNumber;
        updatedAt: z.ZodNumber;
    }, z.core.$strip>>;
    cards: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        noteId: z.ZodString;
        question: z.ZodString;
        answer: z.ZodString;
        dueAt: z.ZodNumber;
        interval: z.ZodNumber;
        reviews: z.ZodNumber;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const processStudyTranscriptSchema: z.ZodObject<{
    transcript: z.ZodString;
    courseTitle: z.ZodString;
    lessonTitle: z.ZodString;
    style: z.ZodEnum<{
        detailed: "detailed";
        concise: "concise";
    }>;
}, z.core.$strip>;
export declare const generatedStudyNotesSchema: z.ZodObject<{
    title: z.ZodString;
    summary: z.ZodString;
    markdown: z.ZodString;
    tags: z.ZodArray<z.ZodString>;
    flashcards: z.ZodArray<z.ZodObject<{
        question: z.ZodString;
        answer: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const askStudyNotesSchema: z.ZodObject<{
    question: z.ZodString;
    passages: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        title: z.ZodString;
        text: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const studyAnswerSchema: z.ZodObject<{
    answer: z.ZodString;
    sourceIds: z.ZodArray<z.ZodString>;
}, z.core.$strip>;
export type StudyCourse = z.infer<typeof studyCourseSchema>;
export type StudyNote = z.infer<typeof studyNoteSchema>;
export type StudyCard = z.infer<typeof studyCardSchema>;
export type StudyLibrary = z.infer<typeof studyLibrarySchema>;
export type ProcessStudyTranscriptInput = z.infer<typeof processStudyTranscriptSchema>;
export type GeneratedStudyNotes = z.infer<typeof generatedStudyNotesSchema>;
export type AskStudyNotesInput = z.infer<typeof askStudyNotesSchema>;
export type StudyAnswer = z.infer<typeof studyAnswerSchema>;
//# sourceMappingURL=study.d.ts.map