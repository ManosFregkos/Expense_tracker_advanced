# Notes

Open **Notes** in the sidebar (`/notes`). The previous `/study` address redirects here.

- Create personal or course notebooks, with colors, an instructor, a course URL and a lesson count. Course completion tracks active lesson notes marked complete.
- Capture a blank note, daily journal, meeting, reading, or course lesson. Today’s page opens the existing active journal for the current local date.
- Changes save immediately in the current browser, under the signed-in account. Notes are independent of the active household. They do not sync to another device or require an AI API key.
- Write Markdown or switch to reading and split views. Supported formatting includes headings, bold, italic, code, quotes, web links, and checklists. HTML is displayed as text. Only HTTP/HTTPS source links open.
- Add `- [ ] Task` checkboxes; tick them in reading view or the Checklists section. Checkboxes inside fenced code examples are ignored.
- Connect ideas with `[[Exact note title]]`. Linked notes open from reading view; the destination shows backlinks. For unambiguous links, use unique titles.
- Search note titles, bodies, tags, sources and lesson labels. Use Cmd/Ctrl+K to focus search, filter by tag and sort by edit date, title or creation date. Pinned notes appear first.
- Add tags, lesson labels, source references and revisit dates in Details. Due revisit dates appear in Review when the section is opened.
- Make review cards from any active note. Reveal the answer before rating recall. Again returns in ten minutes; Got it starts at one day and doubles; Easy starts at three days and triples, capped at one year. Archived and trashed notes do not enter the review queue. Manage cards to remove a card.
- Focus mode removes distractions (Escape exits). A 25-minute timer uses a deadline so it stays accurate when the tab is backgrounded; it pauses and resets on demand. The timer resets when leaving the note.
- The last 12 editing checkpoints preserve previous titles and bodies. Checkpoints are captured when leaving a field or switching modes. Restoring a version preserves the current version first.
- Archive or move a note to trash through Details. Restore either later; permanent deletion requires a separate confirmation and removes associated review cards.
- Export one note as Markdown, or export the full library as JSON. Backups include archived notes, trash, versions and cards. Import merges with newly allocated identifiers or replaces after downloading the current data. Invalid backups cannot alter existing notes. Files are limited to 20 MB.

If saving fails, the saved library remains intact and the editor marks the draft unsaved. Retry saving or export the draft. Failed editor drafts stay available while navigating within Notes during the same page session; closing or reloading warns about unsaved drafts. If existing storage is corrupt, editing pauses, and Library & backup can download the original data for recovery before restoring a valid backup.

Browser storage has finite capacity. Export regular backups; clearing browser data removes the local library. Editing the same note in multiple tabs uses the latest successfully saved edit; changes to different notes are merged against the latest stored library.

## Validation

`npm run test --workspace=@family-expense-tracker/web -- src/features/notes` checks backup integrity, merging, checkbox extraction, search, recall scheduling, account isolation, cross-tab updates, corrupt storage and failed writes.

`npm run test:e2e` includes `tests/e2e/notes-flow.spec.ts`, covering registration, daily capture, Udemy course notes, autosave/reload, completion, cards, focus mode, history, trash recovery, backup validation/merge and mobile layout.
