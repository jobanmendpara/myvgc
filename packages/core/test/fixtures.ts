import { readFileSync } from 'node:fs'
import type { PokemonBuild } from '../src'

export function fixture(name: string): string {
  return readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8')
}

const sp = (stats: Partial<PokemonBuild['statPoints']>): PokemonBuild['statPoints'] => ({
  hp: 0,
  atk: 0,
  def: 0,
  spa: 0,
  spd: 0,
  spe: 0,
  ...stats,
})

/** Each fixture paste and the Team it should read into. */
export const fixtures: { file: string; levelLines: number[]; pokemon: PokemonBuild[] }[] = [
  {
    file: 'sun-mega-charizard.txt',
    levelLines: [3, 13, 23, 33, 43, 53],
    pokemon: [
      {
        species: 'charizard',
        item: 'charizarditey',
        ability: 'solarpower',
        nature: 'timid',
        moves: ['heatwave', 'solarbeam', 'protect', 'willowisp'],
        statPoints: sp({ hp: 2, spa: 32, spe: 32 }),
      },
      {
        species: 'venusaur',
        gender: 'M',
        item: 'focussash',
        ability: 'chlorophyll',
        nature: 'modest',
        moves: ['earthpower', 'gigadrain', 'sludgebomb', 'protect'],
        statPoints: sp({ hp: 2, spa: 32, spe: 32 }),
      },
      {
        species: 'incineroar',
        gender: 'F',
        item: 'sitrusberry',
        ability: 'intimidate',
        nature: 'careful',
        moves: ['fakeout', 'partingshot', 'flareblitz', 'knockoff'],
        statPoints: sp({ hp: 32, atk: 2, spd: 32 }),
      },
      {
        species: 'rotomwash',
        item: 'leftovers',
        ability: 'levitate',
        nature: 'bold',
        moves: ['hydropump', 'thunderbolt', 'willowisp', 'protect'],
        statPoints: sp({ hp: 32, def: 18, spa: 16 }),
      },
      {
        species: 'whimsicott',
        item: 'mentalherb',
        ability: 'prankster',
        nature: 'timid',
        moves: ['tailwind', 'moonblast', 'encore', 'lightscreen'],
        statPoints: sp({ hp: 32, def: 2, spe: 32 }),
      },
      {
        species: 'garchomp',
        item: 'lifeorb',
        ability: 'roughskin',
        nature: 'jolly',
        moves: ['earthquake', 'rockslide', 'dragonclaw', 'protect'],
        statPoints: sp({ hp: 2, atk: 32, spe: 32 }),
      },
    ],
  },
  {
    file: 'mega-garchomp-z.txt',
    levelLines: [],
    pokemon: [
      {
        species: 'garchomp',
        nickname: 'Chompy',
        gender: 'F',
        item: 'garchompitez',
        ability: 'roughskin',
        nature: 'jolly',
        moves: ['earthquake', 'dragonclaw', 'rockslide', 'protect'],
        statPoints: sp({ atk: 32, def: 2, spe: 32 }),
      },
      {
        species: 'floetteeternal',
        item: 'sitrusberry',
        ability: 'flowerveil',
        nature: 'modest',
        moves: ['lightofruin', 'moonblast', 'calmmind', 'protect'],
        statPoints: sp({ hp: 32, spa: 32, spd: 2 }),
      },
      {
        species: 'sinistcha',
        item: 'rockyhelmet',
        ability: 'hospitality',
        nature: 'bold',
        moves: ['matchagotcha', 'strengthsap', 'ragepowder', 'trickroom'],
        statPoints: sp({ hp: 32, def: 32, spd: 2 }),
      },
      {
        species: 'kingambit',
        item: 'blackglasses',
        ability: 'supremeoverlord',
        nature: 'adamant',
        moves: ['kowtowcleave', 'suckerpunch', 'ironhead', 'protect'],
        statPoints: sp({ hp: 32, atk: 32, spe: 2 }),
      },
      {
        species: 'basculegionf',
        nickname: 'Lucy',
        item: 'mysticwater',
        ability: 'adaptability',
        nature: 'adamant',
        moves: ['wavecrash', 'lastrespects', 'aquajet', 'protect'],
        statPoints: sp({ hp: 2, atk: 32, spe: 32 }),
      },
      {
        species: 'ninetalesalola',
        item: 'lightclay',
        ability: 'snowwarning',
        nature: 'timid',
        moves: ['blizzard', 'auroraveil', 'freezedry', 'protect'],
        statPoints: sp({ hp: 2, spa: 32, spe: 32 }),
      },
    ],
  },
  {
    file: 'trick-room-gengar.txt',
    levelLines: [],
    pokemon: [
      {
        species: 'gengar',
        item: 'gengarite',
        ability: 'cursedbody',
        nature: 'quiet',
        moves: ['shadowball', 'sludgebomb', 'icywind', 'protect'],
        statPoints: sp({ hp: 32, spa: 32, spd: 2 }),
      },
      {
        species: 'hatterene',
        gender: 'F',
        item: 'lifeorb',
        ability: 'magicbounce',
        nature: 'quiet',
        moves: ['trickroom', 'dazzlinggleam', 'psychic', 'mysticalfire'],
        statPoints: sp({ hp: 32, def: 2, spa: 32 }),
      },
      {
        species: 'taurospaldeaaqua',
        gender: 'M',
        item: 'widelens',
        ability: 'intimidate',
        nature: 'brave',
        moves: ['wavecrash', 'closecombat', 'rockslide', 'protect'],
        statPoints: sp({ hp: 32, atk: 32, spd: 2 }),
      },
      {
        species: 'mausholdfour',
        item: 'focussash',
        ability: 'friendguard',
        nature: 'impish',
        moves: ['followme', 'beatup', 'taunt'],
        statPoints: sp({ hp: 32, def: 32, spd: 2 }),
      },
      {
        species: 'arcaninehisui',
        item: 'shucaberry',
        ability: 'intimidate',
        nature: 'adamant',
        moves: ['flareblitz', 'rockslide', 'extremespeed', 'protect'],
        statPoints: sp({ hp: 32, atk: 32, def: 2 }),
      },
      {
        species: 'aegislash',
        item: 'leftovers',
        ability: 'stancechange',
        nature: 'quiet',
        moves: ['shadowball', 'flashcannon', 'kingsshield', 'shadowsneak'],
        statPoints: sp({ hp: 32, spa: 32, spd: 2 }),
      },
    ],
  },
]
