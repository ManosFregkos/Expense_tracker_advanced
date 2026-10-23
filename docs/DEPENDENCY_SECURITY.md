# Dependency security maintenance

The October 2026 dependency refresh keeps Firebase JS on major 12 and Firebase CLI
on major 15. It updates Vite to 7.3.7, Vitest to 5.0.5, Firebase CLI to 15.34.1,
and the affected transitive packages in both npm lockfiles.

The root package has scoped overrides while upstream packages still request
vulnerable versions:

- `@firebase/firestore` uses patched `@grpc/grpc-js` 1.14.5 or later within major 1.
  The [gRPC advisory](https://github.com/grpc/grpc-node/security/advisories/GHSA-m9gg-hp2v-232j)
  identifies patched releases 1.13.6 and 1.14.5.
- `firebase-tools` uses Chokidar 4.0.3, removing the unpatched `braces` dependency.
  [Chokidar 4 removed glob watching](https://github.com/paulmillr/chokidar/blob/4.0.3/README.md).
  This repository's emulators watch explicit directories and rule files, with
  regular-expression exclusions. If adding `functions.ignore` patterns to Firebase
  configuration, recheck ignore behavior: Chokidar 4 treats strings as paths,
  rather than globs.
- `@google-cloud/pubsub` uses `@opentelemetry/core` 2.8.0 or later within major 2
  for the [baggage propagation fix](https://github.com/open-telemetry/opentelemetry-js/security/advisories/GHSA-8988-4f7v-96qf).
  Its trace-context propagator is checked against the Pub/Sub integration.
- `gaxios@6.7.1` uses `uuid` 11.1.1 or later within major 11. This override is also
  in `functions/package.json`, because Firebase installs that directory separately
  and npm only applies overrides from the install root.

The compatibility tests run as part of `npm test`, or independently with
`npm run test:dependencies`. Run the Firestore rules and full emulator browser
tests after changing the Firebase CLI or its watcher dependencies.

Audit both installation roots:

```bash
npm audit
npm audit --prefix functions --workspaces=false --omit=dev
```

Commit `package-lock.json` and `functions/package-lock.json` together when updating
shared deployment dependencies. Use `npm ci` for reproducible installation.
Remove scoped overrides once upstream packages adopt the patched dependencies;
do not use `npm audit fix --force` to accept Firebase major-version downgrades.
