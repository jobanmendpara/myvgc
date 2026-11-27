// The real Sandboxes: Sandcastle's docker() provider (What Sandcastle needs to run MyVGC in Docker,
// DEV-248), on the image built from .sandcastle/Dockerfile. Thin on purpose, and not unit-tested:
// the pilot's first Run proves it (DEV-269). The spike's prototype/sandcastle-spike branch shows the
// same calls.
import { claudeCode, createSandbox } from '@ai-hero/sandcastle'
import { docker } from '@ai-hero/sandcastle/sandboxes/docker'
import { execFileSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { Sandboxes } from './ports.ts'
import { STORE_DIR } from './run.ts'

export const IMAGE = 'sandcastle:myvgc'
/** Each sandbox's share of the Docker VM (8 CPUs, about 7.7 GiB): two run at once. */
const CPUS = 3

export function sandcastleSandboxes(repoDir: string): Sandboxes {
  return {
    async create({ branch, base, env }) {
      requireImage()
      // The host keeps pnpm's store, so each sandbox's install reuses what the last one fetched.
      const store = join(homedir(), '.cache', 'myvgc-factory', 'pnpm-store')
      mkdirSync(store, { recursive: true })
      const sandbox = await createSandbox({
        branch,
        baseBranch: base,
        cwd: repoDir,
        sandbox: docker({
          imageName: IMAGE,
          cpus: CPUS,
          env,
          mounts: [{ hostPath: store, sandboxPath: STORE_DIR }],
        }),
      })
      return {
        worktreePath: sandbox.worktreePath,
        async exec(command, options) {
          const result = await sandbox.exec(
            command,
            options?.stdin === undefined ? undefined : { stdin: options.stdin },
          )
          return { exitCode: result.exitCode, stdout: result.stdout, stderr: result.stderr }
        },
        async runAgent(step) {
          const result = await sandbox.run({
            name: step.name,
            agent: claudeCode(step.model, { effort: step.effort, env }),
            prompt: step.prompt,
            idleTimeoutSeconds: step.idleTimeoutSeconds,
          })
          return { stdout: result.stdout }
        },
        async close() {
          await sandbox.close()
        },
      }
    },
  }
}

function requireImage() {
  try {
    execFileSync('docker', ['image', 'inspect', IMAGE], { stdio: 'ignore' })
  } catch {
    throw new Error(
      `The Docker image ${IMAGE} isn't built: run \`docker build -t ${IMAGE} .sandcastle\`.`,
    )
  }
}
