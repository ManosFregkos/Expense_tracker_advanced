# Study Studio

Open **Study Studio** in the existing app navigation, or visit `/study` after signing in and choosing a household. On mobile, open the main navigation using the header menu.

## What you can do

- Add/edit courses with instructor, description, course link, and color.
- Paste a lesson transcript, or import TXT, Markdown, SRT, and VTT files. Subtitle timestamps are removed for AI processing.
- Generate detailed or concise Markdown notes, a summary, topic tags, and editable flashcards. Review and save the draft explicitly.
- Write notes yourself, or use a transcript directly as notes without AI.
- Read with a table of contents, code-copy buttons, adjustable font size, a 25-minute focus timer, and a focus view (Escape exits).
- Bookmark notes, mark lessons read, search and filter by course, and export a lesson as Markdown.
- Use **Ask my notes**: deterministic keyword retrieval ranks saved lessons and extracts passages; the server uses these passages to generate an answer with clickable sources. This is a basic lexical RAG pipeline, not an embedding or vector search service. It works best with topic words used in the notes.
- Review flashcards with spaced repetition and keyboard shortcuts (Space reveals, 1/2/3 rate). Again schedules 10 minutes later; Good starts at one day and doubles; Easy starts at four days and triples. Maximum interval: 365 days.
- Explore connections through shared topic tags and create project notebooks from the suggested projects.
- Export and restore a validated JSON backup including courses, notes, transcripts, and card schedules.

The initial collections are **illustrative starter examples**, not Udemy course content. Add your actual course titles and transcripts. The app does not access a Udemy account or download course videos. PDF/audio/video ingestion is not included.

## AI setup

The two AI callables use the [OpenAI Responses API](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses) with strict structured outputs. The default model is `gpt-4.1-mini`; use another Responses-compatible model with structured output support via `STUDY_AI_MODEL` if desired.

1. Obtain an OpenAI API key for your project and configure provider billing.
2. Store the key in Firebase Secret Manager. Never use a `VITE_` environment variable for it:

   ```sh
   npx firebase functions:secrets:set STUDY_OPENAI_API_KEY --project YOUR_PROJECT_ID
   ```

3. Optionally set `STUDY_AI_MODEL=gpt-4.1-mini` in `functions/.env.YOUR_PROJECT_ID`.
4. Build and deploy the callables:

   ```sh
   npm run build
   npx firebase deploy --only functions:processStudyTranscript,functions:askStudyNotes --project YOUR_PROJECT_ID
   ```

5. Open a transcript editor in Study Studio and generate notes. Deployment and a valid key are required for live AI; failures leave the draft intact and display a useful error.

For local emulators, add the secret override to the ignored `functions/.secret.local` file:

```dotenv
STUDY_OPENAI_API_KEY=your-api-key
```

Use `npm run emulators` and `npm run dev` with the existing Firebase emulator variables. The emulator calls the real provider when a key is configured. There is no built-in fake AI response. Tests mock provider requests separately.

## Data and limits

The study library is saved in browser local storage under `study-studio.v1.<Firebase uid>`. It is scoped to the signed-in user and follows that user across household switches on the same browser. **There is no cloud synchronization.** Clearing browser storage removes the library; export backups regularly, and import a backup to move devices. A shared browser's local storage can be inspected by anyone with access to its developer tools; it is not encrypted.

Source text is rendered as React text; HTML, remote images, and unsafe links are not executed. Supported Markdown includes headings, paragraphs, ordered/unordered lists, bold text, inline/fenced code, block quotes, simple tables, and HTTP(S) links. Other Markdown syntax may appear as plain text.

Transcripts are limited to 60,000 characters per request (one lesson), with at least 100 characters required for AI processing. Split longer lessons yourself. Text file import is limited to 500 KB. AI output is bounded and validated. A provider refusal, incomplete response, or invalid source ID never silently creates a saved lesson.

AI callables require authentication and a verified email. They use the project's existing App Check option. Transactional per-user quotas limit combined AI requests to 40 per UTC day and one request every five seconds across instances. Attempts that reach the provider count against the quota even when the provider fails. Usage records are in `privateStudyAiUsage/<uid>`, inaccessible to clients under the existing default-deny Firestore rule. The provider key is bound only to these server functions.

Only submitted transcripts or selected note passages and the question are sent to OpenAI. Requests use `store: false`. No course library, API keys, transcripts, or model output is logged by these functions. AI notes remain editable drafts until you save, and source references in answers are validated against the supplied passages. Source links make it easier to check an answer; they do not guarantee that every claim is correct.

## Validation

```sh
npm run typecheck
npm run build
npm run test --workspace=@family-expense-tracker/shared
npm run test --workspace=@family-expense-tracker/functions
npm run test --workspace=@family-expense-tracker/web
```

To run the study browser scenario with emulators:

```sh
npx firebase emulators:exec --project demo-family-expense-tracker --config firebase.e2e.json --only auth,firestore,functions,storage 'npx playwright test tests/e2e/study-flow.spec.ts'
```

Live AI cannot be verified without a configured API key. Provider tests cover request shapes, validation, refusal/incomplete responses, HTTP failures, and citation validation without making paid requests.
