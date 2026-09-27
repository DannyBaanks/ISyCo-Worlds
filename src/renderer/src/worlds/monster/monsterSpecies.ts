/** Original Monster Trainer families. Forms are authored as logical pixel silhouettes,
 * not borrowed creatures or franchise sprites. Each family has a stable identity,
 * palette, affinity label, and two visual evolutions. */

export type EvolutionStage = 'baby' | 'middle' | 'final';
export type MonsterVariant = 'blob' | 'horn' | 'shell' | 'spike';
export type FeatureTone = 'outline' | 'body' | 'accent' | 'highlight';

export interface SpeciesBlock {
  x: number;
  y: number;
  w: number;
  h: number;
  tone: FeatureTone;
}

export interface SpeciesForm {
  name: string;
  body: { x: number; y: number; w: number; h: number };
  features: readonly SpeciesBlock[];
}

export interface MonsterSpecies {
  id: string;
  affinity: string;
  variant: MonsterVariant;
  palette: readonly [number, number, number];
  forms: Readonly<Record<EvolutionStage, SpeciesForm>>;
}

const form = (name: string, body: SpeciesForm['body'], features: readonly SpeciesBlock[]): SpeciesForm => ({ name, body, features });
const px = (x: number, y: number, w: number, h: number, tone: FeatureTone = 'accent'): SpeciesBlock => ({ x, y, w, h, tone });

export const MONSTER_SPECIES: readonly MonsterSpecies[] = [
  {
    id: 'pipfern', affinity: 'verdant', variant: 'blob', palette: [0x26331d, 0x88bd57, 0xf2d66d],
    forms: {
      baby: form('Pipfern', { x: 7, y: 13, w: 10, h: 7 }, [px(10, 9, 4, 3), px(11, 7, 2, 3, 'highlight'), px(15, 15, 4, 2)]),
      middle: form('Thornbloom', { x: 5, y: 10, w: 14, h: 10 }, [px(3, 7, 4, 5), px(17, 7, 4, 5), px(4, 5, 4, 3, 'highlight'), px(16, 5, 4, 3), px(2, 16, 5, 2)]),
      final: form('Canopy Warden', { x: 3, y: 8, w: 18, h: 12 }, [px(5, 5, 3, 5), px(16, 5, 3, 5), px(3, 3, 5, 3, 'highlight'), px(16, 3, 5, 3), px(1, 14, 5, 3), px(18, 14, 5, 3)])
    }
  },
  {
    id: 'brookbit', affinity: 'river', variant: 'shell', palette: [0x17374a, 0x48a9bd, 0xb8f3e7],
    forms: {
      baby: form('Brookbit', { x: 7, y: 13, w: 10, h: 7 }, [px(4, 14, 4, 3), px(16, 14, 4, 3), px(11, 9, 2, 4, 'highlight')]),
      middle: form('Streamfin', { x: 5, y: 10, w: 14, h: 10 }, [px(2, 12, 5, 4), px(17, 12, 5, 4), px(9, 7, 6, 3, 'highlight'), px(18, 17, 4, 2)]),
      final: form('Tidecrest', { x: 3, y: 8, w: 18, h: 12 }, [px(1, 12, 5, 5), px(18, 12, 5, 5), px(7, 4, 3, 5), px(11, 2, 3, 7, 'highlight'), px(15, 4, 3, 5), px(19, 17, 4, 2)])
    }
  },
  {
    id: 'cinderkin', affinity: 'ember', variant: 'horn', palette: [0x48251e, 0xe4773f, 0xffd166],
    forms: {
      baby: form('Cinderkin', { x: 7, y: 13, w: 10, h: 7 }, [px(10, 9, 4, 4), px(11, 7, 2, 3, 'highlight'), px(15, 16, 4, 2)]),
      middle: form('Kilnback', { x: 5, y: 10, w: 14, h: 10 }, [px(6, 6, 3, 5), px(15, 6, 3, 5), px(8, 5, 2, 3, 'highlight'), px(14, 5, 2, 3), px(17, 16, 5, 2)]),
      final: form('Sunforge Drake', { x: 3, y: 8, w: 18, h: 12 }, [px(4, 4, 4, 6), px(16, 4, 4, 6), px(6, 2, 3, 4, 'highlight'), px(15, 2, 3, 4), px(0, 12, 6, 5), px(18, 12, 6, 5), px(17, 18, 5, 2)])
    }
  },
  {
    id: 'cairnling', affinity: 'stone', variant: 'shell', palette: [0x343b48, 0x9c9b88, 0xe7c979],
    forms: {
      baby: form('Cairnling', { x: 7, y: 13, w: 10, h: 7 }, [px(13, 11, 5, 4), px(14, 10, 3, 2, 'highlight')]),
      middle: form('Cragclaw', { x: 5, y: 10, w: 14, h: 10 }, [px(4, 9, 5, 5), px(15, 9, 5, 5), px(8, 6, 3, 5, 'highlight'), px(13, 6, 3, 5), px(2, 16, 5, 2)]),
      final: form('Geodeback', { x: 3, y: 8, w: 18, h: 12 }, [px(5, 6, 4, 7), px(15, 6, 4, 7), px(7, 2, 3, 5, 'highlight'), px(11, 0, 3, 7), px(15, 2, 3, 5), px(1, 15, 5, 3), px(18, 15, 5, 3)])
    }
  },
  {
    id: 'pufflet', affinity: 'sky', variant: 'blob', palette: [0x34334b, 0xa99be0, 0xe4f2ff],
    forms: {
      baby: form('Pufflet', { x: 7, y: 13, w: 10, h: 7 }, [px(4, 13, 4, 4, 'highlight'), px(16, 13, 4, 4, 'highlight'), px(10, 10, 4, 3)]),
      middle: form('Galeplume', { x: 5, y: 10, w: 14, h: 10 }, [px(1, 10, 6, 5), px(17, 10, 6, 5), px(3, 7, 4, 3, 'highlight'), px(17, 7, 4, 3), px(9, 6, 6, 4)]),
      final: form('Stormwing', { x: 3, y: 8, w: 18, h: 12 }, [px(0, 8, 7, 7), px(17, 8, 7, 7), px(2, 5, 5, 4, 'highlight'), px(17, 5, 5, 4), px(8, 3, 3, 5), px(13, 3, 3, 5, 'highlight')])
    }
  },
  {
    id: 'sporecap', affinity: 'spore', variant: 'horn', palette: [0x3b2940, 0xb876a2, 0xe9d58a],
    forms: {
      baby: form('Sporecap', { x: 8, y: 14, w: 8, h: 6 }, [px(5, 11, 14, 4), px(7, 9, 10, 3, 'highlight')]),
      middle: form('Puffshroom', { x: 5, y: 11, w: 14, h: 9 }, [px(2, 7, 20, 6), px(4, 5, 16, 3, 'highlight'), px(7, 8, 2, 2, 'body'), px(15, 8, 2, 2, 'body')]),
      final: form('Mycelord', { x: 3, y: 8, w: 18, h: 12 }, [px(0, 4, 24, 7), px(2, 2, 20, 3, 'highlight'), px(4, 7, 2, 2, 'body'), px(9, 8, 2, 2, 'body'), px(15, 7, 2, 2, 'body'), px(18, 8, 2, 2, 'body')])
    }
  },
  {
    id: 'voltkit', affinity: 'volt', variant: 'spike', palette: [0x38311c, 0xd9ba42, 0xc9f36e],
    forms: {
      baby: form('Voltkit', { x: 7, y: 13, w: 10, h: 7 }, [px(6, 9, 3, 4), px(15, 9, 3, 4), px(16, 16, 5, 2, 'highlight')]),
      middle: form('Arclynx', { x: 5, y: 10, w: 14, h: 10 }, [px(4, 5, 4, 7), px(16, 5, 4, 7), px(5, 4, 2, 3, 'highlight'), px(17, 4, 2, 3), px(17, 16, 6, 2)]),
      final: form('Thundermaw', { x: 3, y: 8, w: 18, h: 12 }, [px(4, 3, 5, 8), px(15, 3, 5, 8), px(5, 1, 3, 4, 'highlight'), px(16, 1, 3, 4), px(18, 15, 5, 2), px(20, 12, 3, 3, 'highlight')])
    }
  },
  {
    id: 'rivetbug', affinity: 'forge', variant: 'shell', palette: [0x27313a, 0x78949a, 0xe6a956],
    forms: {
      baby: form('Rivetling', { x: 7, y: 13, w: 10, h: 7 }, [px(9, 9, 2, 4), px(13, 9, 2, 4), px(6, 10, 2, 3), px(16, 10, 2, 3, 'highlight')]),
      middle: form('Geargrub', { x: 5, y: 10, w: 14, h: 10 }, [px(6, 6, 3, 5), px(15, 6, 3, 5), px(4, 8, 3, 3, 'highlight'), px(17, 8, 3, 3), px(7, 16, 3, 3), px(14, 16, 3, 3)]),
      final: form('Forge Beetle', { x: 3, y: 8, w: 18, h: 12 }, [px(5, 3, 3, 7), px(16, 3, 3, 7), px(2, 7, 4, 5, 'highlight'), px(18, 7, 4, 5), px(7, 5, 10, 8, 'outline'), px(8, 6, 8, 6, 'accent'), px(1, 16, 5, 3), px(18, 16, 5, 3)])
    }
  },
  {
    id: 'prismoth', affinity: 'prism', variant: 'spike', palette: [0x372449, 0xb88be1, 0xffc3e8],
    forms: {
      baby: form('Prismoth', { x: 8, y: 13, w: 8, h: 7 }, [px(4, 12, 5, 5), px(15, 12, 5, 5), px(10, 9, 4, 3, 'highlight')]),
      middle: form('Gleamwing', { x: 6, y: 10, w: 12, h: 10 }, [px(1, 8, 7, 8), px(16, 8, 7, 8), px(0, 6, 5, 4, 'highlight'), px(19, 6, 5, 4), px(10, 6, 4, 4)]),
      final: form('Aurorafae', { x: 4, y: 8, w: 16, h: 12 }, [px(0, 7, 8, 8), px(16, 7, 8, 8), px(1, 3, 6, 5, 'highlight'), px(17, 3, 6, 5), px(7, 5, 3, 4), px(14, 5, 3, 4), px(11, 3, 2, 5, 'highlight')])
    }
  },
  {
    id: 'dustrunner', affinity: 'dune', variant: 'spike', palette: [0x433127, 0xc28a4a, 0xf2d28c],
    forms: {
      baby: form('Dustrunner', { x: 7, y: 13, w: 10, h: 7 }, [px(4, 15, 4, 2), px(16, 15, 4, 2), px(8, 11, 2, 2, 'highlight'), px(14, 11, 2, 2)]),
      middle: form('Dunescuttler', { x: 5, y: 10, w: 14, h: 10 }, [px(1, 14, 6, 3), px(17, 14, 6, 3), px(3, 9, 4, 4), px(17, 9, 4, 4), px(8, 7, 3, 4, 'highlight'), px(13, 7, 3, 4)]),
      final: form('Suncrawler', { x: 3, y: 8, w: 18, h: 12 }, [px(0, 14, 7, 4), px(17, 14, 7, 4), px(2, 8, 5, 5), px(17, 8, 5, 5), px(5, 5, 3, 5, 'highlight'), px(16, 5, 3, 5), px(8, 5, 8, 3, 'outline'), px(9, 6, 6, 2, 'accent')])
    }
  }
] as const;

export function speciesById(id: unknown): MonsterSpecies | undefined {
  return typeof id === 'string' ? MONSTER_SPECIES.find((species) => species.id === id) : undefined;
}
