# Kids learning and family play

The authenticated household app serves Kids Mode at `/kids`. The child view uses its own full screen shell, Greek instructions, large native buttons, directional keyboard navigation, and bundled game content. Press Escape twice at the hub for the parent area. The parent area has an explicit exit to the normal app.

## Content and sessions

- Explorer has three worlds: Underwater, Jungle, and Space. Each world has nine positioned objects and 30 missions. Scene art is bundled SVG. Objects use the local asset registry and platform emoji glyphs.
- Memory generates missing item rounds from the bundled 54 item registry. Difficulties use 3, 4, 5, or 6 objects; 2, 3, 3, or 4 answers; and 5, 5, 4, or 4 seconds of observation.
- Logic has 20 bundled scenarios. Level 1 shows two choices. Higher difficulty shows up to three. Custom logic content is loaded from the current household and validated before display.
- Sessions contain 5, 10, or 15 rounds according to the child's profile. The current round and seed-generated content are kept in session storage for refresh recovery. Pending writes are queued locally and replayed in order when connectivity returns. The server uses deterministic session and attempt IDs so a replay does not double count progress.
- The shared `nextKidsDifficulty` service evaluates the last six attempts and requires five rounds since a previous change before moving one step. Parent fixed difficulty is applied to future sessions.

## Firestore and access

Under `/households/{householdId}` the module uses `childProfiles`, `kidsSessions`, `kidsAttempts`, `kidsProgress`, and `kidsCustomContent`. Direct writes are denied. Callable functions check Firebase Auth and current household membership, validate inputs, and perform transactional gameplay writes. Child profiles and custom content changes enter the household audit log. All five collections are readable only to current household members. No new composite index is required by the current collection reads.

## Production setup

Deploy the frontend, Functions, and Firestore rules together. Existing households need no data migration. A household member opens `/kids/parent` to create the first child profile. No Kids specific environment variable is required. The existing application environment and Firebase project configuration remain in use. Custom images are deliberately limited to the bundled asset registry in this version, so no Storage upload endpoint or new Storage rule is installed.

For local emulator E2E runs, the existing task email function requires `TASK_EMAIL_FROM` in the ignored `functions/.env.demo-family-expense-tracker` file. Example: `TASK_EMAIL_FROM="Family Test <test@example.test>"`.

## Current limits

Emoji glyphs depend on the TV browser's fonts. SpeechSynthesis may lack a Greek voice; the Greek text stays visible and gameplay continues. Some TV browsers do not expose proprietary Back keys, Fullscreen, Web Audio, or SpeechSynthesis consistently. The centralized TV key mapping supports common browser keys and Samsung/LG codes without a device SDK. Custom image uploads, custom Memory/Explorer editors, and multi-node branching stories are not included in this version.
