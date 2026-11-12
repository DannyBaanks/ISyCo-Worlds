/** Wordmark for the title bar. Each world signs its own chrome; with no world chosen it is the product's. */
export function WorldBrand({ skin }: { skin?: 'office' | 'monster-trainer' } = {}) {
  if (skin === 'office') {
    return <div className="worlds-brand" data-brand="office">
      <span className="worlds-brand-mark" aria-hidden="true">MD</span>
      <span>Munder <strong>Difflin</strong></span>
    </div>;
  }
  if (skin === 'monster-trainer') {
    return <div className="worlds-brand" data-brand="monster-trainer">
      <span className="worlds-brand-mark" aria-hidden="true" />
      <span>Monster <strong>Village</strong></span>
    </div>;
  }
  return <div className="worlds-brand">
    <span className="worlds-brand-globe" aria-hidden="true">🌍</span>
    <span>ISyCo <strong>Worlds</strong></span>
  </div>;
}
