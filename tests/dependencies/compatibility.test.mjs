import assert from 'node:assert/strict'
import { once } from 'node:events'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { setTimeout as delay } from 'node:timers/promises'

const require = createRequire(import.meta.url)
const firebaseRequire = createRequire(require.resolve('firebase-tools/package.json'))

test('Firebase CLI watcher detects file changes and respects its directory exclusions', async (t) => {
  const { watch } = firebaseRequire('chokidar')
  const directory = await mkdtemp(join(tmpdir(), 'expense-tracker-watch-'))
  const file = join(directory, 'firestore.rules')
  const hiddenFile = join(directory, '.env')
  const dependencyFile = join(directory, 'node_modules', 'package', 'index.js')
  await mkdir(join(directory, 'node_modules', 'package'), { recursive: true })
  await writeFile(file, 'initial rules')
  await writeFile(hiddenFile, 'initial config')
  await writeFile(dependencyFile, 'initial dependency')
  const watcher = watch(directory, {
    ignored: [/(^|[/\\])\../, /.+?[\\/]node_modules[\\/].+?/],
    ignoreInitial: true,
  })
  t.after(async () => {
    await watcher.close()
    await rm(directory, { recursive: true, force: true })
  })
  const changedFiles = new Set()
  watcher.on('change', (path) => changedFiles.add(path))
  await once(watcher, 'ready')
  const changed = once(watcher, 'change', { signal: AbortSignal.timeout(5000) })
  const [[changedFile]] = await Promise.all([
    changed,
    Promise.all([
      writeFile(file, 'updated rules'),
      writeFile(hiddenFile, 'updated config'),
      writeFile(dependencyFile, 'updated dependency'),
    ]),
  ])
  assert.equal(changedFile, file)
  await delay(150)
  assert.deepEqual([...changedFiles], [file])
})

test('Firebase CLI Pub/Sub tracing propagates context with the patched OpenTelemetry core', () => {
  const pubsubRequire = createRequire(firebaseRequire.resolve('@google-cloud/pubsub/package.json'))
  const { trace, ROOT_CONTEXT } = pubsubRequire('@opentelemetry/api')
  const { W3CTraceContextPropagator } = pubsubRequire('@opentelemetry/core')
  const { injectSpan, pubsubGetter, setGloballyEnabled } = pubsubRequire(
    './build/src/telemetry-tracing.js',
  )
  const expected = {
    traceId: '0123456789abcdef0123456789abcdef',
    spanId: '0123456789abcdef',
    traceFlags: 1,
  }
  const message = { attributes: {} }
  setGloballyEnabled(true)
  injectSpan({ spanContext: () => expected }, message)
  assert.equal(
    message.attributes.googclient_traceparent,
    `00-${expected.traceId}-${expected.spanId}-01`,
  )
  const context = new W3CTraceContextPropagator().extract(ROOT_CONTEXT, message, pubsubGetter)
  assert.deepEqual(trace.getSpanContext(context), { ...expected, isRemote: true })
})
