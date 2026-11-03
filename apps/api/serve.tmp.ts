import { serve } from '@hono/node-server'
import { fileURLToPath } from 'node:url'
import { createApp } from './src/app'
import { createTestDb } from './test/db'
const { db } = await createTestDb()
serve({ fetch: createApp({ db, webDir: fileURLToPath(new URL('../web/.output/public', import.meta.url)) }).fetch, port: 3999 })
console.log('up')
