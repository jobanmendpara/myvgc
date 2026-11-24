// Tests how `pnpm screenshots` reads its arguments and names its files (DEV-186, DEV-198). Taking
// real shots needs a running preview; DEV-186's and DEV-198's PRs show it run end to end. Run with `pnpm test:scripts`.
import { describe, expect, test } from 'vitest'
import { parseShots, shotName, shotStorage } from './screenshot-args.ts'

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

  test('gives a Sprite style to the shot it follows', () => {
    expect(
      parseShots(['--sprite-style', 'leading-slot', '/teams/abc/edit', '--sprite-style', 'inline']),
    ).toEqual([
      { clicks: [], spriteStyle: 'leading-slot' },
      { path: '/teams/abc/edit', clicks: [], spriteStyle: 'inline' },
    ])
  })

  test.each([
    [['--sprite-style'], /--sprite-style needs one of inline, leading-slot, stacked-tiles/],
    [['--sprite-style', 'Stacked tiles'], /--sprite-style needs one of/],
    [['/settings', '--sprite-style', 'inline'], /\/settings shows no Sprites/],
    [['--sprite-style', 'inline', '--sprite-style', 'inline'], /two --sprite-style/],
    [['--click'], /--click needs/],
    [['/teams', '--click', '--click', 'x'], /--click needs/],
    [['--click', ' '], /--click needs/],
    [['teams'], /start with \//],
    [['--full'], /Unknown option --full/],
  ])('refuses %j', (args, message) => {
    expect(() => parseShots(args)).toThrow(message)
  })
})

describe('shotStorage', () => {
  test('stores the Sprite style for the page the path belongs to', () => {
    expect(shotStorage({ clicks: [], spriteStyle: 'stacked-tiles' }, '/opponents/x')).toEqual({
      'myvgc-sprite-styles': '{"opponents":"stacked-tiles"}',
    })
    expect(shotStorage({ clicks: [] }, '/opponents/x')).toEqual({})
  })
})

describe('shotName', () => {
  test('names the page, then its Sprite style, then each click, then the width', () => {
    expect(shotName({ clicks: [] }, '/teams/aBc1', 'phone')).toBe('teams-aBc1-phone')
    expect(
      shotName(
        { clicks: ['Sprite style', 'Stacked tiles'], spriteStyle: 'inline' },
        '/teams/aBc1',
        'desktop',
      ),
    ).toBe('teams-aBc1-sprite-inline-sprite-style-stacked-tiles-desktop')
    expect(shotName({ clicks: [] }, '/', 'phone')).toBe('home-phone')
  })

  test('cuts a long name and adds a hash of the whole shot, so long shots never share a file', () => {
    const round =
      '/tournaments/ecd6a993-cee1-41e1-86a7-f02d1fdd2390/rounds/943e533e-7eed-4e80-9acd-51678ef3231f'
    const one = shotName({ clicks: ['Games', 'Game 1'] }, round, 'phone')
    const two = shotName({ clicks: ['Games', 'Game 2'] }, round, 'phone')
    expect(one).not.toBe(two)
    expect(one).toMatch(/^tournaments-ecd6a993-.*-[0-9a-f]{8}-phone$/)
    expect(one.length).toBeLessThanOrEqual(100 + '-phone'.length)
  })
})
