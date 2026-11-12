/**
 * Drop-in art for the code-painted village objects. Any `<id>.png` placed in
 * `assets/worlds/starter-village/objects/` replaces the painter for that id at
 * the next build; no code change is needed. Ids and sizes are listed in
 * docs/monster-village/ESPECIFICACIONES_ARTE.md.
 */
const files = import.meta.glob('../../assets/worlds/starter-village/objects/*.png', {
  eager: true,
  query: '?url',
  import: 'default'
}) as Record<string, string>;

export const VILLAGE_OBJECT_SPRITE_URLS: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(files).map(([file, url]) => [file.slice(file.lastIndexOf('/') + 1, -'.png'.length), url])
);

/** Preloaded with the rest of the world's resources so the scene can read them synchronously. */
export const VILLAGE_OBJECT_SPRITE_RESOURCES: { id: string; url: string }[] = Object.entries(VILLAGE_OBJECT_SPRITE_URLS)
  .map(([id, url]) => ({ id: `village-object-${id}`, url }));
