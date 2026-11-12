import { z } from 'zod'

// The secret shipped in .env.example. Refusing it stops an install from running with a
// session-signing secret that anyone can read.
const EXAMPLE_SECRET = 'change-me'

const booleanFlag = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.enum(['true', 'false', '1', '0', 'yes', 'no']))
  .transform((value) => value === 'true' || value === '1' || value === 'yes')

/** The model that reads Teams from images when `TEAM_READER_MODEL` isn't set. */
export const DEFAULT_TEAM_READER_MODEL = 'claude-sonnet-5-5'

const unsetIfBlank = <S extends z.ZodType>(schema: S) =>
  z.preprocess((value) => (typeof value === 'string' && !value.trim() ? undefined : value), schema)

const schema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  PORT: z.coerce.number().int().positive().default(3000),
  BETTER_AUTH_SECRET: z
    .string({ error: 'BETTER_AUTH_SECRET is required' })
    .refine((secret) => secret !== EXAMPLE_SECRET, {
      message: 'replace the example value; generate one with `openssl rand -base64 32`',
      abort: true,
    })
    .refine((secret) => secret.length >= 32, {
      message: 'must be at least 32 characters; generate one with `openssl rand -base64 32`',
    }),
  APP_URL: z.url({ error: 'APP_URL must be a URL, such as http://localhost:3000' }),
  ALLOW_SIGNUPS: booleanFlag.default(true),
  // Where uploaded files are kept (ADR 27). The image sets /data/uploads, on a volume.
  UPLOADS_DIR: z.string().trim().min(1).default('.data/uploads'),
  // Reading Teams from images (ADR 24) is off unless a key is set. A blank value counts as unset,
  // so `.env.example`'s empty line keeps it off.
  ANTHROPIC_API_KEY: unsetIfBlank(z.string().trim().optional()),
  TEAM_READER_MODEL: unsetIfBlank(z.string().trim().default(DEFAULT_TEAM_READER_MODEL)),
  TEAM_READER_DAILY_LIMIT: unsetIfBlank(
    z.coerce
      .number({ error: 'must be a whole number of reads, such as 20' })
      .int('must be a whole number of reads, such as 20')
      .positive('must be at least 1; leave it unset for no limit')
      .optional(),
  ),
})

export type Config = z.infer<typeof schema>

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const result = schema.safeParse(env)
  if (!result.success) {
    const problems = result.error.issues.map(
      (issue) => `  ${issue.path.join('.')}: ${issue.message}`,
    )
    throw new Error(`Invalid configuration:\n${problems.join('\n')}`)
  }
  return result.data
}
