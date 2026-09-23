# Production deployment guide

This runbook publishes the current finance, banking, household Tasks, and Kids Card Learning work
to the Firebase production project `expense-tracker-v2-9520e`. Run commands from the repository
root.

## Current production-readiness check

The repository is configured with these Firebase aliases:

- `default`: `demo-family-expense-tracker`
- `production`: `expense-tracker-v2-9520e`

The local `apps/web/.env.production` already targets the production project, has Firebase
emulators disabled, and has a Web Push public key configured. The following items still need
attention before the first Tasks deployment:

- **Required for task email to all users:** verify a sending domain with Resend, set
  `TASK_EMAIL_FROM` in the Functions environment, and set the `RESEND_API_KEY` Functions secret.
- **Recommended hardening:** add `VITE_FIREBASE_APPCHECK_SITE_KEY`. App Check enforcement must
  remain disabled until the production web app is registered and verified.
- **Required for all configured banks:** `OPEN_BANKING_PROVIDER` is set to Salt Edge, but the
  production Functions environment currently has no Eurobank or NBG provider code. Add
  `SALTEDGE_EUROBANK_PROVIDER_CODE` and `SALTEDGE_NBG_PROVIDER_CODE`, or leave those institutions
  unavailable intentionally.
- **Verify manually:** confirm enabled Secret Manager versions exist for `SALTEDGE_APP_ID`,
  `SALTEDGE_SECRET`, and `SALTEDGE_PRIVATE_KEY`.
- **Source hosting:** `origin` currently points to the GitHub project. Verify it before pushing.

The `.env.production`, Functions `.env.<project-id>`, private keys, and local `.env` files are
ignored by Git. Do not force-add them.

## 1. Commit and upload the source code

Review exactly what will be committed:

```bash
git status
git diff --check
git diff
```

Stage and commit the application changes:

```bash
git add .
git status
git commit -m "Add production household tasks module"
```

If this is the first source upload, create an empty remote repository and connect it:

```bash
git remote add origin <YOUR_GIT_REMOTE_URL>
git push -u origin main
```

If `origin` is added later, verify it before pushing:

```bash
git remote -v
git push origin main
```

Do not commit `apps/web/.env.production`, `functions/.env.expense-tracker-v2-9520e`, Salt Edge
private keys, downloaded service-account JSON, or Firebase Admin credentials.

## 2. Verify the Firebase production project

The project needs a billing plan that supports Cloud Functions, Secret Manager, and Cloud
Scheduler. The scheduled task reminder function creates a Cloud Scheduler job when Functions are
deployed.

In Firebase and Google Cloud consoles, verify:

1. The active project is `expense-tracker-v2-9520e`.
2. Cloud Firestore exists in the intended production region.
3. Firebase Authentication has Email/Password enabled. Enable Google sign-in too if it is exposed
   in the application.
4. The Hosting domain and any custom domain are in Authentication **Authorized domains**.
5. Firebase Cloud Messaging is enabled for the registered web app.
6. Cloud Scheduler API and Secret Manager API are enabled.
7. Billing and budget alerts are configured.

Authenticate the local CLI and select the explicit production alias:

```bash
firebase login
firebase projects:list
firebase use production
firebase use
```

Continue only if `firebase use` reports `expense-tracker-v2-9520e`. Every deployment command below
also includes `--project production` to avoid accidentally deploying to the demo project.

## 3. Create the FCM Web Push key

In the Firebase console for `expense-tracker-v2-9520e`:

1. Open **Project settings → Cloud Messaging**.
2. Find **Web configuration → Web Push certificates**.
3. Select **Generate key pair** if no pair exists.
4. Copy the displayed **public** key.

Add the public key to `apps/web/.env.production`:

```dotenv
VITE_FIREBASE_VAPID_KEY=PASTE_THE_PUBLIC_WEB_PUSH_KEY_HERE
```

This public VAPID key is expected in the browser bundle. Do not put the private half of a VAPID
pair, Firebase Admin credentials, or a service-account key in a `VITE_` variable.

FCM Web Push needs HTTPS and a service worker. Firebase Hosting supplies HTTPS, and this repository
builds `apps/web/src/sw.ts` into the production service worker. Notification permission is requested
only when a signed-in user selects **Settings → Task notifications → Enable browser push**.

## Task reminder email setup

Email reminders use Resend. Keep the API key private. Store it in Firebase Secret Manager from the
repository root; the command prompts for the key without putting it in source code or shell history:

```bash
firebase functions:secrets:set RESEND_API_KEY --project production
```

Do not add `RESEND_API_KEY` to a Functions `.env` file. Keep only `TASK_EMAIL_FROM` there.

### Test with no domain

Resend's shared sender is suitable for testing with the email address used to create the Resend
account. Put this in the ignored `functions/.env.expense-tracker-v2-9520e` file:

```dotenv
TASK_EMAIL_FROM="Expense Tracker <onboarding@resend.dev>"
```

The Firebase Authentication account receiving the reminder must use the same email address as the
Resend account for this test. Resend will reject emails to other users from this sender. Do not use
this setup as the production email sender for a household with multiple users.

### Send to all users

1. Obtain a domain you control with access to its DNS settings. The Firebase `web.app` domain
   cannot be used as your Resend sender domain because you cannot add its required DNS records.
2. In the Resend dashboard, open **Domains**, add the domain, and copy the DNS records that Resend
   shows for sending. Add those exact records in the domain registrar's DNS settings.
3. Wait until Resend marks sending as **Verified**. Use an address at that domain in the ignored
   Functions environment file; for example:

   ```dotenv
   TASK_EMAIL_FROM="Expense Tracker <reminders@your-domain.example>"
   ```

4. Deploy Functions again so `sendTaskReminderEmail` uses the new sender. Send a short reminder to
   a second verified Firebase Authentication user and confirm delivery in that user's inbox and
   in Resend's email log.

Users enable **Due reminders** or **One overdue reminder**, plus **Email due and overdue
reminders**, under Settings. The scheduled worker creates the notification and the email trigger
sends to the assignee's verified Firebase Authentication email. Delivery attempts are recorded in
the backend-only `/privateTaskEmailDeliveries` collection. No email is sent for task assignments.
The Functions emulator logs a mock delivery instead of contacting Resend.

## 4. Complete the production web environment

`apps/web/.env.production` must contain the production web-app values copied from **Project
settings → General → Your apps → Web app**:

```dotenv
VITE_FIREBASE_API_KEY=<production-web-api-key>
VITE_FIREBASE_AUTH_DOMAIN=expense-tracker-v2-9520e.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=expense-tracker-v2-9520e
VITE_FIREBASE_STORAGE_BUCKET=<production-storage-bucket>
VITE_FIREBASE_MESSAGING_SENDER_ID=<production-sender-id>
VITE_FIREBASE_APP_ID=<production-web-app-id>
VITE_FIREBASE_VAPID_KEY=<public-web-push-key>
VITE_USE_FIREBASE_EMULATORS=false
VITE_DEFAULT_TIME_ZONE=Europe/Athens
```

Firebase web configuration and the VAPID public key are identifiers, not server secrets. They are
baked into the Vite bundle at build time, so changing them requires rebuilding and redeploying
Hosting.

### Optional but recommended: App Check

For a new setup, prefer Firebase App Check with reCAPTCHA Enterprise. Register the production web
app and its Hosting/custom domains, then add its public site key:

```dotenv
VITE_FIREBASE_APPCHECK_SITE_KEY=<production-app-check-site-key>
```

First deploy with App Check monitoring and `ENFORCE_APP_CHECK=false`. Confirm legitimate production
requests receive valid tokens before changing the Functions environment to
`ENFORCE_APP_CHECK=true` and redeploying Functions. Enabling enforcement before the browser key is
configured will block callable operations.

## 5. Complete Functions configuration and secrets

Non-secret production settings live locally in
`functions/.env.expense-tracker-v2-9520e`. Keep it ignored by Git. Confirm at least:

```dotenv
ENFORCE_APP_CHECK=false
OPEN_BANKING_PROVIDER=saltedge
SALTEDGE_BASE_URL=https://www.saltedge.com/api/v6
SALTEDGE_ALPHA_PROVIDER_CODE=<salt-edge-alpha-code>
SALTEDGE_EUROBANK_PROVIDER_CODE=<salt-edge-eurobank-code>
SALTEDGE_NBG_PROVIDER_CODE=<salt-edge-nbg-code>
OPEN_BANKING_ALLOWED_RETURN_ORIGINS=https://expense-tracker-v2-9520e.web.app
OPEN_BANKING_WEBHOOK_URL=<exact-deployed-openBankingWebhook-url>
```

If a custom domain is used, add its exact HTTPS origin to
`OPEN_BANKING_ALLOWED_RETURN_ORIGINS`. Configure the exact webhook URL in Salt Edge as well.

Verify secret metadata without displaying secret values:

```bash
firebase functions:secrets:get SALTEDGE_APP_ID --project production
firebase functions:secrets:get SALTEDGE_SECRET --project production
firebase functions:secrets:get SALTEDGE_PRIVATE_KEY --project production
```

Create or rotate missing secrets interactively:

```bash
firebase functions:secrets:set SALTEDGE_APP_ID --project production
firebase functions:secrets:set SALTEDGE_SECRET --project production
firebase functions:secrets:set SALTEDGE_PRIVATE_KEY --data-file ./saltedge-private.pem --project production
```

The PEM file is ignored by the repository pattern `saltedge-*.pem`. Updating a secret requires a
Functions redeployment before the new version is used.

Tasks and FCM do not require a server-side VAPID secret. Firebase Admin Messaging uses the deployed
Function's service identity; only the public `VITE_FIREBASE_VAPID_KEY` is added to the web build.

## 6. Run the release gates

Use Node.js 22 or later and Java 21 for the emulator tests:

```bash
npm install
npm run format:check
npm run typecheck
npm run lint
npm test
npm run test:rules
npm run test:e2e
npm run build
```

Do not deploy if any command fails. `npm run build` uses Vite production mode and therefore reads
`apps/web/.env.production`. Inspect the generated service worker before deployment if the build
reports PWA errors:

```bash
ls -lh apps/web/dist/sw.js apps/web/dist/manifest.webmanifest
```

## 7. Deploy in a safe order

Deploy Firestore rules and indexes first:

```bash
firebase deploy --only firestore --project production
```

The Kids release adds no composite index. Confirm that the deployed rules expose Kids collections
only to household members and keep all Kids writes callable-only before continuing.

In **Firestore → Indexes**, wait until every new task index reports **Enabled**. Building indexes can
take time on an existing database. Deploying the UI before the indexes are ready can make Tasks
queries fail temporarily.

Deploy Functions next:

```bash
firebase deploy --only functions --project production
```

Confirm that `scheduledTaskReminders` created its Cloud Scheduler job and that the Tasks callable
functions are deployed in `europe-west1`.

Finally rebuild with the finalized production environment and deploy Hosting:

```bash
npm run build
firebase deploy --only hosting --project production
```

The production URL is normally:

```text
https://expense-tracker-v2-9520e.web.app
```

For later releases, all configured resources can be deployed together after the same checks:

```bash
firebase deploy --only firestore,functions,hosting --project production
```

## 8. Production smoke test

Use a normal browser and a second private/incognito session where noted:

1. Open the production URL and confirm no emulator banner appears.
2. Register or sign in, verify the email, and select an existing household.
3. Confirm Dashboard, Accounts, Transactions, Analytics, Categories, and Bank Connections still
   load.
4. Open `/tasks`; verify the five default task lists appear once.
5. Create a task due today, assign it, edit it, complete it, and reopen it.
6. Create a weekly recurring task, complete it twice rapidly, and verify only one next occurrence
   exists.
7. Create and complete a subtask.
8. Confirm the dashboard widget and sidebar count update.
9. In Settings, enable task reminder preferences and then select **Enable browser push**. Confirm the
   browser grants notification permission and a `/userDevices/{uid}/devices/{tokenHash}` document
   exists. That collection is intentionally unreadable from the client.
10. Create a short reminder and verify one in-app notification and at most one push. The scheduled
    worker runs every five minutes, so allow for its interval.
    With **Email due and overdue reminders** enabled, verify one email arrives at the assignee's
    verified sign-in address. The browser tab can be closed while waiting.
11. In a second household/user session, verify another household's task URL cannot be read or
    mutated.
12. Test one production bank connection for every institution whose provider code is enabled.
13. Open **Settings -> Kids settings**, create or select a child profile, and verify narration,
    sounds, animations, session length, and difficulty persist after refresh.
14. Enter `/kids` and confirm no dashboard balances, transactions, accounts, or administrative
    controls are visible in the child-facing shell.
15. Start one Learn & Choose Animals session. Complete five rounds with only arrow keys and Enter,
    including three rapid Enter presses on one answer. Verify only one round advances and the
    session completes once.
16. Open Observe and Think and start each available mode/deck combination. Confirm unsupported
    combinations are not offered and that Same/Different, Matching, Odd One Out, and Compare each
    produce an unambiguous first round.
17. During a Kids session, use the repeat-audio button, Escape/Back navigation, and a wrong answer.
    Confirm narration does not overlap, the wrong answer permits a retry, and focus remains visible.
18. In browser developer tools, temporarily switch the network offline after a session starts.
    Finish the session, reconnect, and verify its attempts synchronize exactly once.
19. In a second household/user session, verify another household's child profiles, sessions,
    attempts, settings, and card progress cannot be read or mutated.

Inspect operational state without exposing private data:

```bash
firebase functions:list --project production
firebase functions:log --project production
```

Also inspect Cloud Scheduler execution history, Functions errors, Firestore usage, Authentication,
and FCM delivery/error metrics in the consoles.

## 9. Rollback

- **Hosting:** use **Firebase Console → Hosting → Release history → Roll back**.
- **Functions:** check out the last known-good Git commit, run the release gates, and redeploy
  Functions.
- **Firestore Rules:** restore the previous rules file from Git and deploy `--only firestore`.
  Rules do not have the same one-click rollback as Hosting.
- **Indexes:** keep additive indexes during rollback unless a reviewed cleanup explicitly removes
  them.
- **Secrets:** select or create a known-good secret version, then redeploy every Function that
  references it.

The Tasks and Kids releases add collections but require no destructive data migration. Existing
households receive default task lists lazily on first use. Kids data is created only after a parent
creates a child profile or starts a session. Both initialization paths are idempotent.

## Official Firebase references

- [Firebase CLI and deployment](https://firebase.google.com/docs/cli)
- [Firebase Hosting deployment](https://firebase.google.com/docs/hosting/quickstart)
- [FCM Web Push and VAPID keys](https://firebase.google.com/docs/cloud-messaging/web/get-started)
- [Scheduled Functions](https://firebase.google.com/docs/functions/schedule-functions)
- [Functions environment and Secret Manager](https://firebase.google.com/docs/functions/config-env)
- [Firebase App Check for web](https://firebase.google.com/docs/app-check/web/recaptcha-provider)
