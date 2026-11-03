import { readFileSync } from 'node:fs'
import type { PokemonBuild } from '../src'

export function fixture(name: string): string {
  return readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8')
}

/**
 * Real Champions team pastes and the Teams they should read into.
 * The expected builds were produced by Pokémon Showdown's own parser (Teams.import, pokemon-showdown
 * 0.11.11) with each name converted to a Showdown ID, so they don't depend on MyVGC's reader.
 */
export const fixtures: {
  file: string
  source: string
  warningLines: number[]
  pokemon: PokemonBuild[]
}[] = [
  {
    file: 'finisterrae-5-angel-gerpe.txt',
    source:
      'FINISTERRAE SERIES VGC #5, Ángel Gerpe (Reg M-C). https://pokepast.es/c35564881666c461, linked from https://metavgc.com/teams/featured/regulation-mc. CRLF line endings; names the Mega form (Garchomp-Mega-Z) as the species.',
    warningLines: [],
    pokemon: [
      {
        species: 'rillaboom',
        item: 'miracleseed',
        ability: 'grassysurge',
        nature: 'adamant',
        moves: ['fakeout', 'grassyglide', 'woodhammer', 'highhorsepower'],
        statPoints: { hp: 32, atk: 15, def: 0, spa: 0, spd: 19, spe: 0 },
      },
      {
        species: 'garchompmegaz',
        item: 'garchompitez',
        ability: 'roughskin',
        nature: 'modest',
        moves: ['protect', 'dragonpulse', 'flamethrower', 'powergem'],
        statPoints: { hp: 2, atk: 0, def: 0, spa: 32, spd: 0, spe: 32 },
      },
      {
        species: 'incineroar',
        item: 'sitrusberry',
        ability: 'intimidate',
        nature: 'impish',
        moves: ['helpinghand', 'fakeout', 'flareblitz', 'partingshot'],
        statPoints: { hp: 32, atk: 0, def: 32, spa: 0, spd: 2, spe: 0 },
      },
      {
        species: 'gengarmega',
        item: 'gengarite',
        ability: 'cursedbody',
        nature: 'modest',
        moves: ['protect', 'shadowball', 'sludgebomb', 'disable'],
        statPoints: { hp: 20, atk: 0, def: 4, spa: 10, spd: 0, spe: 32 },
      },
      {
        species: 'zoroark',
        item: 'focussash',
        ability: 'illusion',
        nature: 'timid',
        moves: ['protect', 'nightdaze', 'encore', 'psychic'],
        statPoints: { hp: 2, atk: 0, def: 0, spa: 32, spd: 0, spe: 32 },
      },
      {
        species: 'sneasler',
        item: 'whiteherb',
        ability: 'unburden',
        nature: 'adamant',
        moves: ['protect', 'fakeout', 'closecombat', 'direclaw'],
        statPoints: { hp: 0, atk: 32, def: 0, spa: 0, spd: 2, spe: 32 },
      },
    ],
  },
  {
    file: 'alpensee-tour-74-m-rada.txt',
    source:
      "Alpensee Tour #74 champion, Oleksandr Polishchuk (Reg M-C). https://www.vrpastes.com/qZK7HCqj, exported with the site's Export Team button, linked from https://victoryroad.pro/champions-replica/. Nicknames, lowercase stat names and Shiny lines.",
    warningLines: [3, 31],
    pokemon: [
      {
        species: 'gengar',
        nickname: 'Genry',
        item: 'gengarite',
        ability: 'cursedbody',
        nature: 'modest',
        moves: ['perishsong', 'shadowball', 'sludgebomb', 'protect'],
        statPoints: { hp: 30, atk: 0, def: 13, spa: 0, spd: 16, spe: 7 },
      },
      {
        species: 'snorlax',
        nickname: 'BIG MAN',
        item: 'leftovers',
        ability: 'thickfat',
        nature: 'relaxed',
        moves: ['yawn', 'encore', 'fissure', 'protect'],
        statPoints: { hp: 21, atk: 0, def: 31, spa: 0, spd: 14, spe: 0 },
      },
      {
        species: 'incineroar',
        item: 'sitrusberry',
        ability: 'intimidate',
        nature: 'relaxed',
        moves: ['flareblitz', 'partingshot', 'fakeout', 'protect'],
        statPoints: { hp: 32, atk: 0, def: 25, spa: 0, spd: 9, spe: 0 },
      },
      {
        species: 'scrafty',
        nickname: 'Bober',
        item: 'focussash',
        ability: 'intimidate',
        nature: 'impish',
        moves: ['closecombat', 'knockoff', 'fakeout', 'protect'],
        statPoints: { hp: 32, atk: 0, def: 4, spa: 0, spd: 4, spe: 26 },
      },
      {
        species: 'dragonite',
        nickname: 'Whisker',
        item: 'lifeorb',
        ability: 'innerfocus',
        nature: 'adamant',
        moves: ['dragonclaw', 'lowkick', 'extremespeed', 'protect'],
        statPoints: { hp: 29, atk: 32, def: 0, spa: 0, spd: 0, spe: 5 },
      },
      {
        species: 'rillaboom',
        nickname: 'Bibizyana',
        item: 'ejectbutton',
        ability: 'grassysurge',
        nature: 'sassy',
        moves: ['grassyglide', 'uturn', 'fakeout', 'protect'],
        statPoints: { hp: 32, atk: 0, def: 4, spa: 0, spd: 30, spe: 0 },
      },
    ],
  },
  {
    file: 'nice-regional-2026-sanvito.txt',
    source:
      "Nice Regional Championships Top 4, Simone Sanvito (Reg M-C). https://www.vrpastes.com/H0NBcV0M, exported with the site's Export Team button, linked from https://victoryroad.pro/champions-replica/. Tyranitarite and Staraptite.",
    warningLines: [],
    pokemon: [
      {
        species: 'tyranitar',
        item: 'tyranitarite',
        ability: 'sandstream',
        nature: 'jolly',
        moves: ['rockslide', 'knockoff', 'dragondance', 'protect'],
        statPoints: { hp: 18, atk: 16, def: 0, spa: 0, spd: 0, spe: 32 },
      },
      {
        species: 'excadrill',
        item: 'focussash',
        ability: 'sandrush',
        nature: 'adamant',
        moves: ['highhorsepower', 'ironhead', 'rockslide', 'protect'],
        statPoints: { hp: 0, atk: 32, def: 1, spa: 0, spd: 1, spe: 32 },
      },
      {
        species: 'gholdengo',
        item: 'lifeorb',
        ability: 'goodasgold',
        nature: 'modest',
        moves: ['shadowball', 'makeitrain', 'nastyplot', 'protect'],
        statPoints: { hp: 27, atk: 0, def: 12, spa: 0, spd: 17, spe: 10 },
      },
      {
        species: 'milotic',
        item: 'sitrusberry',
        ability: 'competitive',
        nature: 'calm',
        moves: ['scald', 'icebeam', 'icywind', 'protect'],
        statPoints: { hp: 32, atk: 0, def: 17, spa: 8, spd: 5, spe: 4 },
      },
      {
        species: 'sinistcha',
        item: 'rockyhelmet',
        ability: 'hospitality',
        nature: 'bold',
        moves: ['matchagotcha', 'strengthsap', 'ragepowder', 'protect'],
        statPoints: { hp: 29, atk: 0, def: 14, spa: 0, spd: 23, spe: 0 },
      },
      {
        species: 'staraptor',
        item: 'staraptite',
        ability: 'intimidate',
        nature: 'jolly',
        moves: ['closecombat', 'bravebird', 'tailwind', 'protect'],
        statPoints: { hp: 29, atk: 1, def: 0, spa: 0, spd: 4, spe: 32 },
      },
    ],
  },
  {
    file: 'worlds-2026-yamazaki-ots.txt',
    source:
      "2026 World Championships winner's open team list, Takuma Yamazaki (Reg M-B). https://www.vrpastes.com/feLZkS21, exported with the site's Export Team button, linked from https://victoryroad.pro/2026-worlds/. No EVs line (open team lists hide Stat Points); Floettite and Dragoninite.",
    warningLines: [],
    pokemon: [
      {
        species: 'floetteeternal',
        item: 'floettite',
        ability: 'flowerveil',
        nature: 'timid',
        moves: ['moonblast', 'dazzlinggleam', 'lightofruin', 'protect'],
        statPoints: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
      },
      {
        species: 'basculegion',
        item: 'lifeorb',
        ability: 'adaptability',
        nature: 'adamant',
        moves: ['wavecrash', 'lastrespects', 'aquajet', 'protect'],
        statPoints: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
      },
      {
        species: 'kingambit',
        item: 'chopleberry',
        ability: 'defiant',
        nature: 'adamant',
        moves: ['suckerpunch', 'kowtowcleave', 'lowkick', 'ironhead'],
        statPoints: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
      },
      {
        species: 'dragonite',
        item: 'dragoninite',
        ability: 'multiscale',
        nature: 'modest',
        moves: ['dragonpulse', 'heatwave', 'extremespeed', 'protect'],
        statPoints: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
      },
      {
        species: 'garchomp',
        item: 'choicescarf',
        ability: 'roughskin',
        nature: 'adamant',
        moves: ['dragonclaw', 'stompingtantrum', 'earthquake', 'rockslide'],
        statPoints: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
      },
      {
        species: 'sneasler',
        item: 'focussash',
        ability: 'poisontouch',
        nature: 'jolly',
        moves: ['closecombat', 'direclaw', 'fakeout', 'feint'],
        statPoints: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
      },
    ],
  },
]
