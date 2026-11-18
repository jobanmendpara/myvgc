import { z } from 'zod'
import type { S3Options } from './storage'

// The secret shipped in .env.example. Refusing it stops an install from running with a
// session-signing secret that anyone can read.
const EXAMPLE_SECRET = 'change-me'

const booleanFlag = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.enum(['true', 'false', '1', '0', 'yes', 'no']))
  .transform((value) => value === 'true' || value === '1' || value === 'yes')

/**
 * The model that reads Teams from images when `TEAM_READER_MODEL` isn't set. Haiku 5.5 read the
 * samples exactly as well as Sonnet 5.5 at about 1/17 of the cost (ADR 24, DEV-125).
 */
export const DEFAULT_TEAM_READER_MODEL = 'claude-haiku-5-5'

const unsetIfBlank = <S extends z.ZodType>(schema: S) =>
  z.preprocess((value) => (typeof value === 'string' && !value.trim() ? undefined : value), schema)

// TEAM_READER_MODEL, trimmed, or the default when it's unset or blank.
const teamReaderModelSchema = unsetIfBlank(z.string().trim().default(DEFAULT_TEAM_READER_MODEL))

/**
 * The model that reads Teams from images, by the same rule as `loadConfig`. The accuracy check
 * (ADR 24) uses it, so `pnpm accuracy` tests the model the app would use without needing the
 * app's other settings (DEV-153).
 */
export function teamReaderModel(env: NodeJS.ProcessEnv = process.env): string {
  return teamReaderModelSchema.parse(env.TEAM_READER_MODEL)
}

const schema = z
  .object({
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
    // An S3-compatible bucket for uploaded files instead of UPLOADS_DIR (DEV-71). Unset keeps disk.
    S3_BUCKET: unsetIfBlank(z.string().trim().optional()),
    // Defaults to us-east-1 below, so only a value actually set is refused without a bucket.
    S3_REGION: unsetIfBlank(z.string().trim().optional()),
    S3_ENDPOINT: unsetIfBlank(
      z.url({ error: 'S3_ENDPOINT must be a URL, such as https://s3.example.com' }).optional(),
    ),
    S3_ACCESS_KEY_ID: unsetIfBlank(z.string().trim().optional()),
    S3_SECRET_ACCESS_KEY: unsetIfBlank(z.string().trim().optional()),
    // No default here, so a value set without a bucket can be refused below.
    S3_FORCE_PATH_STYLE: unsetIfBlank(booleanFlag.optional()),
    // Reading Teams from images (ADR 24) is off unless a key is set. A blank value counts as unset,
    // so `.env.example`'s empty line keeps it off.
    ANTHROPIC_API_KEY: unsetIfBlank(z.string().trim().optional()),
    TEAM_READER_MODEL: teamReaderModelSchema,
    TEAM_READER_DAILY_LIMIT: unsetIfBlank(
      z.coerce
        .number({ error: 'must be a whole number of reads, such as 20' })
        .int('must be a whole number of reads, such as 20')
        .positive('must be at least 1; leave it unset for no limit')
        .optional(),
    ),
  })
  .transform(
    (
      {
        S3_BUCKET,
        S3_REGION,
        S3_ENDPOINT,
        S3_ACCESS_KEY_ID,
        S3_SECRET_ACCESS_KEY,
        S3_FORCE_PATH_STYLE,
        ...config
      },
      ctx,
    ) => {
      const refuse = (path: string, message: string) =>
        ctx.addIssue({ code: 'custom', path: [path], message })

      // The one place the access key and secret are paired; S3Options can't hold half a pair.
      let credentials: S3Options['credentials']
      if (S3_ACCESS_KEY_ID && S3_SECRET_ACCESS_KEY)
        credentials = { accessKeyId: S3_ACCESS_KEY_ID, secretAccessKey: S3_SECRET_ACCESS_KEY }
      else if (S3_ACCESS_KEY_ID || S3_SECRET_ACCESS_KEY)
        refuse(
          S3_ACCESS_KEY_ID ? 'S3_SECRET_ACCESS_KEY' : 'S3_ACCESS_KEY_ID',
          'set S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY together, or neither',
        )

      // Settings that do nothing without a bucket are more likely a mistake than a choice.
      const needsBucket = [
        S3_REGION,
        S3_ENDPOINT,
        S3_ACCESS_KEY_ID,
        S3_SECRET_ACCESS_KEY,
        S3_FORCE_PATH_STYLE,
      ]
      if (!S3_BUCKET && needsBucket.some((value) => value !== undefined))
        refuse('S3_BUCKET', 'set S3_BUCKET to keep uploads in S3, or remove the other S3_ settings')

      if (ctx.issues.length) return z.NEVER

      // One group for the S3 settings, present only when a bucket is set.
      const s3: S3Options | undefined = S3_BUCKET
        ? {
            bucket: S3_BUCKET,
            region: S3_REGION ?? 'us-east-1',
            forcePathStyle: S3_FORCE_PATH_STYLE ?? false,
            ...(S3_ENDPOINT && { endpoint: S3_ENDPOINT }),
            ...(credentials && { credentials }),
          }
        : undefined
      return { ...config, s3 }
    },
  )

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
