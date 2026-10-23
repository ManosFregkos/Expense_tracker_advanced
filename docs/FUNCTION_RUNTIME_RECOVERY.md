# Functions runtime startup recovery

On October 22, 2026, `getTransactionTotals` and `createTransaction` returned Google
Frontend HTTP 500 responses to browser OPTIONS requests. The browser reported
missing CORS headers because the callable handlers never started.

The deployed recovery uses the supported **on-deployment runtime update policy**
for those two functions. Both remain on Node.js 22. Hosting, Firestore rules, and
transaction records were not changed.

## Diagnosis and verification

A standard Firebase CLI redeploy reproduced the startup failure. Minimal private
Node.js 22 and Node.js 24 functions with no application dependencies also failed
with automatic runtime updates. Google's sample Cloud Run container started
successfully in the same project and region.

The identical minimal Node.js 22 function became healthy with
`buildConfig.onDeployUpdatePolicy` instead of
`buildConfig.automaticUpdatePolicy`. Rebuilding the two affected production
functions with that policy restored their public endpoints.

This isolates the observed failure to the automatic runtime image composition
path. The exact internal Google failure has not been established. Changing CORS
middleware, deploying Hosting, and switching regions did not address it.

Production verification at **2026-10-22 22:12 UTC** confirmed, for both functions:

- OPTIONS returns HTTP 204 and allows the production origin and callable headers.
- An unauthenticated POST reaches the callable and returns the expected HTTP 401
  `UNAUTHENTICATED` JSON response with CORS headers.
- Deployment operations complete successfully and the functions report `ACTIVE`.

No authenticated transaction writes were made during these checks.

## Inspect the deployed policy

Run from an authenticated Google Cloud CLI session:

```bash
gcloud functions describe getTransactionTotals --gen2 \
  --project expense-tracker-v2-9520e --region europe-west1 \
  --format='yaml(state,buildConfig.onDeployUpdatePolicy,buildConfig.automaticUpdatePolicy)'

gcloud functions describe createTransaction --gen2 \
  --project expense-tracker-v2-9520e --region europe-west1 \
  --format='yaml(state,buildConfig.onDeployUpdatePolicy,buildConfig.automaticUpdatePolicy)'
```

The `onDeployUpdatePolicy` field should be present and `automaticUpdatePolicy`
absent. Verify this after future deployments.

## Repeat a targeted recovery

First build and validate the intended Functions source using the production
deployment guide. To deploy that source with the recovery policy from the
repository root:

```bash
gcloud functions deploy getTransactionTotals --gen2 \
  --project expense-tracker-v2-9520e --region europe-west1 \
  --runtime nodejs22 --entry-point getTransactionTotals --source functions \
  --trigger-http --runtime-update-policy on-deploy

gcloud functions deploy createTransaction --gen2 \
  --project expense-tracker-v2-9520e --region europe-west1 \
  --runtime nodejs22 --entry-point createTransaction --source functions \
  --trigger-http --runtime-update-policy on-deploy
```

Confirm that the existing public invoker permission is retained. Firebase Auth
and household authorization continue to be enforced inside the callables.

Check browser preflight without credentials or data writes:

```bash
curl -i -X OPTIONS \
  'https://europe-west1-expense-tracker-v2-9520e.cloudfunctions.net/getTransactionTotals' \
  -H 'Origin: https://expense-tracker-v2-9520e.web.app' \
  -H 'Access-Control-Request-Method: POST' \
  -H 'Access-Control-Request-Headers: authorization,content-type,firebase-instance-id-token'
```

Repeat for `createTransaction`. Expect HTTP 204 with
`Access-Control-Allow-Origin: https://expense-tracker-v2-9520e.web.app`.

## Runtime patch maintenance

With this policy, runtime security updates are applied when the functions are
redeployed. Maintain a regular redeployment cadence to receive those updates.
Test automatic updates on an isolated function before restoring that policy.

Google documents the two policies and their image construction behavior in
[Execution environment security](https://docs.cloud.google.com/functions/docs/securing/execution-environment-security).
