// Tests how `pnpm screenshots` reads its arguments (DEV-186). Taking real shots needs a running
// preview; DEV-186's PR shows it run end to end. Run with `pnpm test:scripts`.
import { describe, expect, test } from 'vitest'
import { parseShots, shotName } from './screenshot-args.ts'

describe('parseShots', () => {
  test('with no arguments, takes the Team as it loads', () => {
    expect(parseShots([])).toEqual([{ clicks: [] }])
    expect(parseShots(['--'])).toEqual([{ clicks: [] }])
  })

  test('gives each path the clicks that follow it, and clicks before any path to the Team', () => {
    expect(
      parseShots([
        '--',
        '--click',
        'Sprite style',
        '/opponents',
        '/teams',
        '--click',
        'Sprite style',
        '--click',
        'Stacked tiles',
      ]),
    ).toEqual([
      { clicks: ['Sprite style'] },
      { path: '/opponents', clicks: [] },
      { path: '/teams', clicks: ['Sprite style', 'Stacked tiles'] },
    ])
  })

  test.each([
    [['--click'], /--click needs/],
    [['/teams', '--click', '--click', 'x'], /--click needs/],
    [['--click', ' '], /--click needs/],
    [['teams'], /start with \//],
    [['--full'], /Unknown option --full/],
  ])('refuses %j', (args, message) => {
    expect(() => parseShots(args)).toThrow(message)
  })
})

describe('shotName', () => {
  test('names the page, then each click, then the width', () => {
    expect(shotName('/teams/aBc1', [], 'phone')).toBe('teams-aBc1-phone')
    expect(shotName('/teams/aBc1', ['Sprite style', 'Stacked tiles'], 'desktop')).toBe(
      'teams-aBc1-sprite-style-stacked-tiles-desktop',
    )
    expect(shotName('/', [], 'phone')).toBe('home-phone')
  })
})
