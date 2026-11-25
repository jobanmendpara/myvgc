// Tests how `pnpm screenshots` reads its arguments and names its files (DEV-186, DEV-198, DEV-199,
// DEV-227, DEV-228). Taking real shots needs a running preview; DEV-186's, DEV-198's and DEV-227's
// PRs show it run end to end. Run with `pnpm test:scripts`.
import { describe, expect, test } from 'vitest'
import {
  HELP,
  USAGE,
  ambiguousClick,
  parseShots,
  shotName,
  shotStorage,
} from './screenshot-args.ts'

describe('parseShots', () => {
  test('with no path, takes the Team, with every option given', () => {
    expect(parseShots([])).toEqual([{ clicks: [], settings: {} }])
    expect(parseShots(['--'])).toEqual([{ clicks: [], settings: {} }])
    expect(parseShots(['--click', 'Sprite style', '--sprite-style', 'inline', '--dark'])).toEqual([
      { clicks: [{ text: 'Sprite style' }], settings: { 'sprite-style': 'inline' }, dark: true },
    ])
  })

  test('gives each path the clicks before the first path, then the clicks that follow it', () => {
    expect(
      parseShots([
        '--',
        '--click',
        'Sprite style',
        '/opponents',
        '/teams',
        '--click',
        'Stacked tiles',
      ]),
    ).toEqual([
      { path: '/opponents', clicks: [{ text: 'Sprite style' }], settings: {} },
      {
        path: '/teams',
        clicks: [{ text: 'Sprite style' }, { text: 'Stacked tiles' }],
        settings: {},
      },
    ])
  })

  test('picks the region of the click that follows --within', () => {
    expect(
      parseShots(['/teams/abc/edit', '--within', 'main', '--click', 'Dragonite', '--click', 'x']),
    ).toEqual([
      {
        path: '/teams/abc/edit',
        clicks: [{ text: 'Dragonite', within: 'main' }, { text: 'x' }],
        settings: {},
      },
    ])
  })

  test('gives a Sprite style before the first path to every path that shows Sprites', () => {
    expect(
      parseShots(['--sprite-style', 'stacked-tiles', '/teams/abc/edit', '/settings', '/opponents']),
    ).toEqual([
      { path: '/teams/abc/edit', clicks: [], settings: { 'sprite-style': 'stacked-tiles' } },
      { path: '/settings', clicks: [], settings: {} },
      { path: '/opponents', clicks: [], settings: { 'sprite-style': 'stacked-tiles' } },
    ])
  })

  test('lets a path’s own Sprite style replace the one before the first path', () => {
    expect(
      parseShots([
        '--sprite-style',
        'leading-slot',
        '/teams',
        '/opponents',
        '--sprite-style',
        'inline',
      ]),
    ).toEqual([
      { path: '/teams', clicks: [], settings: { 'sprite-style': 'leading-slot' } },
      { path: '/opponents', clicks: [], settings: { 'sprite-style': 'inline' } },
    ])
  })

  test('takes a Sprite style after each path', () => {
    expect(
      parseShots([
        '/teams',
        '--sprite-style',
        'inline',
        '/teams',
        '--sprite-style',
        'stacked-tiles',
      ]),
    ).toEqual([
      { path: '/teams', clicks: [], settings: { 'sprite-style': 'inline' } },
      { path: '/teams', clicks: [], settings: { 'sprite-style': 'stacked-tiles' } },
    ])
  })

  test('gives the dark theme and 2× pixel ratio before the first path to every path', () => {
    expect(parseShots(['--dark', '/statistics', '--2x', '/teams'])).toEqual([
      { path: '/statistics', clicks: [], settings: {}, dark: true, double: true },
      { path: '/teams', clicks: [], settings: {}, dark: true },
    ])
    expect(parseShots(['/statistics', '/statistics', '--dark'])).toEqual([
      { path: '/statistics', clicks: [], settings: {} },
      { path: '/statistics', clicks: [], settings: {}, dark: true },
    ])
  })

  test('asks for the usage with --help, whatever else is given', () => {
    expect(parseShots(['--help'])).toBe(HELP)
    expect(parseShots(['/teams', '--bogus', '-h'])).toBe(HELP)
  })

  test.each([
    [['/teams', '--dark', '--dark'], /--dark is given twice for \/teams/],
    [['--2x', '--2x'], /--2x is given twice for every path/],
    [['--sprite-style'], /--sprite-style needs one of inline, leading-slot, stacked-tiles/],
    [['--sprite-style', 'Stacked tiles'], /--sprite-style needs one of/],
    [['/settings', '--sprite-style', 'inline'], /\/settings has no Sprite style/],
    [['--sprite-style', 'inline', '/settings'], /None of the paths has a Sprite style/],
    [['--sprite-style', 'inline', '--sprite-style', 'inline'], /--sprite-style is given twice/],
    [
      ['/teams', '/settings', '/opponents', '--sprite-style', 'stacked-tiles'],
      /--sprite-style is given after \/opponents but not after \/teams, which would show the default/,
    ],
    [['--type-icon-style', 'pills'], /--type-icon-style needs one of compact, badges, labelled/],
    [['/statistics', '--move-layout', 'two-columns'], /\/statistics has no Move layout/],
    [['--click'], /--click needs/],
    [['/teams', '--click', '--click', 'x'], /--click needs/],
    [['--click', ' '], /--click needs/],
    [['--within'], /--within needs the region/],
    [['--within', 'main'], /--within main needs a --click right after it/],
    [['--within', 'main', '--dark', '--click', 'x'], /needs a --click right after it/],
    [['teams'], /start with \//],
    [['--full'], /Unknown option --full/],
  ])('refuses %j', (args, message) => {
    expect(() => parseShots(args)).toThrow(message)
  })
})

describe('USAGE', () => {
  test('says which paths an option applies to, and lists each page setting', () => {
    expect(USAGE).toMatch(/Options before the first path apply to every path/)
    expect(USAGE).toMatch(
      /--sprite-style <value> +the Sprite style: inline, leading-slot, stacked-tiles \(default inline\)/,
    )
    expect(USAGE).toMatch(
      /--type-icon-style <value> +the Type icon style: compact, badges, labelled/,
    )
    expect(USAGE).toMatch(/--move-layout <value> +the Move layout: one-column, two-columns/)
    expect(USAGE).toMatch(/--within <region>/)
  })
})

describe('shotStorage', () => {
  test('stores the Sprite style for the page the path belongs to', () => {
    expect(
      shotStorage({ clicks: [], settings: { 'sprite-style': 'stacked-tiles' } }, '/opponents/x'),
    ).toEqual({ 'myvgc-sprite-styles': '{"opponents":"stacked-tiles"}' })
    expect(shotStorage({ clicks: [], settings: {} }, '/opponents/x')).toEqual({})
  })

  test('stores the Type icon style and Move layout for the page the path belongs to', () => {
    expect(
      shotStorage(
        { clicks: [], settings: { 'type-icon-style': 'labelled', 'move-layout': 'two-columns' } },
        '/tournaments/x',
      ),
    ).toEqual({
      'myvgc-type-icon-styles': '{"tournaments":"labelled"}',
      'myvgc-move-layouts': '{"tournaments":"two-columns"}',
    })
  })

  test('stores the dark theme as the theme Device setting does', () => {
    expect(shotStorage({ clicks: [], settings: {}, dark: true }, '/settings')).toEqual({
      'myvgc-mode': 'dark',
    })
  })
})

describe('shotName', () => {
  test('names the page, its page settings (the defaults too), then each click, then the width', () => {
    expect(
      shotName(
        { clicks: [], settings: { 'type-icon-style': 'badges', 'move-layout': 'two-columns' } },
        '/opponents',
        'phone',
      ),
    ).toBe('opponents-sprite-inline-types-badges-moves-two-columns-phone')
    expect(shotName({ clicks: [], settings: {} }, '/teams/aBc1', 'phone')).toBe(
      'teams-aBc1-sprite-inline-types-compact-moves-one-column-phone',
    )
    expect(
      shotName(
        {
          clicks: [{ text: 'Sprite style' }, { text: 'Stacked tiles' }],
          settings: { 'sprite-style': 'leading-slot' },
        },
        '/teams/aBc1',
        'desktop',
      ),
    ).toBe(
      'teams-aBc1-sprite-leading-slot-types-compact-moves-one-column-sprite-style-stacked-tiles-desktop',
    )
    expect(shotName({ clicks: [], settings: {} }, '/', 'phone')).toBe('home-phone')
    expect(shotName({ clicks: [], settings: {} }, '/settings', 'phone')).toBe('settings-phone')
    expect(
      shotName(
        { clicks: [{ text: 'Games' }], settings: {}, dark: true, double: true },
        '/statistics',
        'phone',
      ),
    ).toBe('statistics-sprite-inline-dark-2x-games-phone')
  })

  test('names a click’s region before its text', () => {
    expect(
      shotName(
        { clicks: [{ text: 'Dragonite', within: 'Pokémon' }], settings: {} },
        '/settings',
        'phone',
      ),
    ).toBe('settings-pokemon-dragonite-phone')
  })

  test('cuts a long name and adds a hash of the whole shot, so long shots never share a file', () => {
    const round =
      '/tournaments/ecd6a993-cee1-41e1-86a7-f02d1fdd2390/rounds/943e533e-7eed-4e80-9acd-51678ef3231f'
    const one = shotName(
      { clicks: [{ text: 'Games' }, { text: 'Game 1' }], settings: {} },
      round,
      'phone',
    )
    const two = shotName(
      { clicks: [{ text: 'Games' }, { text: 'Game 2' }], settings: {} },
      round,
      'phone',
    )
    expect(one).not.toBe(two)
    expect(one).toMatch(/^tournaments-ecd6a993-.*-[0-9a-f]{8}-phone$/)
    expect(one.length).toBeLessThanOrEqual(100 + '-phone'.length)
  })
})

describe('ambiguousClick', () => {
  test('names each match and the --within that picks it', () => {
    const message = ambiguousClick('http://x/teams/abc/edit', { text: 'Dragonite' }, [
      { kind: 'a link', regions: ['Pokémon in Sun', 'complementary', 'main'] },
      { kind: 'a button', regions: ['Pokémon', 'main'] },
    ])
    expect(message).toBe(
      [
        '2 elements on http://x/teams/abc/edit match --click "Dragonite":',
        '  1. a link in Pokémon in Sun in complementary in main: pick it with --within "Pokémon in Sun" --click Dragonite',
        '  2. a button in Pokémon in main: pick it with --within "Pokémon" --click Dragonite',
      ].join('\n'),
    )
  })

  test('says when no region tells a match apart', () => {
    expect(
      ambiguousClick('u', { text: 'Save', within: 'main' }, [
        { kind: 'a button', regions: ['main'] },
        { kind: 'a button', regions: ['main'] },
      ]),
    ).toMatch(
      /match --click "Save" within main:\n {2}1\. a button in main: no region tells it apart/,
    )
  })
})
