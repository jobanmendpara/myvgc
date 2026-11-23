// Tests scripts/preview.ts's port picking and its handling of a stopped preview. Starting the real
// servers takes too long for here; DEV-184's PR shows it run end to end. Run with
// `pnpm test:scripts`.
import { spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, test } from 'vitest'
import {
  PORT_RANGE,
  isFree,
  pickPorts,
  previewDir,
  readState,
  runningPreview,
  stop,
} from './preview'

describe('pickPorts', () => {
  test("stays off the ports `pnpm dev` uses, even when they're free", async () => {
    expect(PORT_RANGE.from).toBeGreaterThan(3001)
    const ports = await pickPorts(2, async () => true)
    for (const port of ports) {
      expect(port).toBeGreaterThanOrEqual(PORT_RANGE.from)
      expect(port).toBeLessThanOrEqual(PORT_RANGE.to)
    }
  })

  test('skips busy ports and wraps round to the start of the range', async () => {
    const busy = new Set([PORT_RANGE.to, PORT_RANGE.from])
    const ports = await pickPorts(2, async (port) => !busy.has(port), PORT_RANGE.to)
    expect(ports).toEqual([PORT_RANGE.from + 1, PORT_RANGE.from + 2])
  })

  test('says so when the range is full', async () => {
    await expect(pickPorts(2, async () => false)).rejects.toThrow(/No 2 free ports/)
  })
})

test('isFree sees a port something listens on', async () => {
  const server = createServer()
  await new Promise<void>((resolve) => server.listen({ port: 0, host: '127.0.0.1' }, resolve))
  const { port } = server.address() as { port: number }
  try {
    expect(await isFree(port)).toBe(false)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
  expect(await isFree(port)).toBe(true)
})

describe('a preview that has stopped', () => {
  let root: string | undefined
  afterEach(() => {
    if (root) rmSync(root, { recursive: true, force: true })
    root = undefined
  })

  // A pid that has just exited, so no process has it.
  async function deadPid() {
    const child = spawn(process.execPath, ['-e', ''])
    await new Promise((resolve) => child.on('exit', resolve))
    return child.pid!
  }

  function writeState(pids: number[]) {
    root = mkdtempSync(join(tmpdir(), 'preview-'))
    mkdirSync(previewDir(root))
    const state = { url: 'http://localhost:3999', apiPort: 3998, webPort: 3999, pids }
    writeFileSync(join(previewDir(root), 'state.json'), JSON.stringify(state))
    return root
  }

  test('is cleared, so the next `pnpm preview` starts a new one', async () => {
    const dir = writeState([await deadPid()])
    expect(runningPreview(dir)).toBeUndefined()
    expect(readState(dir)).toBeUndefined()
  })

  test('stops without complaint, and so does none at all', async () => {
    const dir = writeState([await deadPid()])
    expect(await stop(dir)).toBe('Stopped the preview at http://localhost:3999.')
    expect(await stop(dir)).toBe('No preview is running.')
  })
})
