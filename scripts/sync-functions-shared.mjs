import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const sharedRoot = resolve(projectRoot, 'packages/shared')
const destination = resolve(projectRoot, 'functions/vendor/shared')
const compiledDestination = resolve(destination, 'compiled')

const sharedPackage = JSON.parse(await readFile(resolve(sharedRoot, 'package.json'), 'utf8'))
const vendorPackage = {
  name: sharedPackage.name,
  version: sharedPackage.version,
  private: true,
  type: 'module',
  main: './compiled/index.js',
  types: './compiled/index.d.ts',
  exports: {
    '.': {
      types: './compiled/index.d.ts',
      import: './compiled/index.js',
    },
  },
  dependencies: sharedPackage.dependencies,
}

await rm(destination, { recursive: true, force: true })
await mkdir(compiledDestination, { recursive: true })
await cp(resolve(sharedRoot, 'dist'), compiledDestination, {
  recursive: true,
  filter: (source) => !source.includes('.test.') && !source.endsWith('.map'),
})
await writeFile(resolve(destination, 'package.json'), `${JSON.stringify(vendorPackage, null, 2)}\n`)
