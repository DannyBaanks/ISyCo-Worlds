import { useTranslation } from 'react-i18next';
import type { WorldId } from '@shared/worlds';
import { localize, type WorldCreator } from '@shared/worldManifest';
import { worldManifest } from '@shared/worldManifests';

/**
 * Who made the chosen world, under which licence, what it is built on, and
 * whose art it carries — straight from its manifest, never retyped. This is
 * also the in-app credits surface LimeZu's licence requires.
 *
 * Links are plain `target="_blank"` anchors: main's window-open handler sends
 * https URLs to the OS browser and never opens a window inside the app.
 */
export function WorldCredits({ worldId }: { worldId: WorldId }) {
  const { t, i18n } = useTranslation();
  const m = worldManifest(worldId);
  const lang = i18n.language || 'en';

  const link = (href: string, label: string) => (
    <a href={href} target="_blank" rel="noreferrer" style={{ color: 'var(--cth-ink-900)', textDecorationThickness: 1 }}>{label}</a>
  );
  const creator = (c: WorldCreator) => (c.url ? link(c.url, c.name) : <span>{c.name}</span>);
  const small = { margin: 0, fontSize: 12, lineHeight: '18px', color: 'var(--cth-ink-700)' } as const;

  return (
    <section
      aria-label={t('settings.general.worlds.credits.title', { world: m.name })}
      style={{ padding: 12, background: 'var(--cth-cream-200)', boxShadow: 'inset 0 0 0 1px var(--cth-ink-300)', display: 'flex', flexDirection: 'column', gap: 8 }}
    >
      <h2 style={{ margin: 0, fontFamily: 'var(--cth-font-display)', fontSize: 9, lineHeight: '14px' }}>
        {t('settings.general.worlds.credits.title', { world: m.name })}
      </h2>
      <p style={{ ...small, color: 'var(--cth-ink-900)' }}>{localize(m.description, lang)}</p>
      <p style={small}>
        {t('settings.general.worlds.credits.createdBy')} {creator(m.author)}
        {' · '}{t('settings.general.worlds.credits.license')}: <strong>{m.license}</strong>
        {' · '}{link(m.source, t('settings.general.worlds.credits.source'))}
      </p>

      {m.derivedFrom && m.derivedFrom.length > 0 && (
        <div>
          <p style={{ ...small, fontWeight: 600 }}>{t('settings.general.worlds.credits.basedOn')}</p>
          <ul style={{ margin: '2px 0 0', paddingInlineStart: 18 }}>
            {m.derivedFrom.map((o) => (
              <li key={o.source} style={small}>
                {link(o.source, o.name)} · {creator(o.author)} ({o.license})
                {o.note && <span> — {localize(o.note, lang)}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {m.assets.length > 0 && (
        <div>
          <p style={{ ...small, fontWeight: 600 }}>{t('settings.general.worlds.credits.assets')}</p>
          <ul style={{ margin: '2px 0 0', paddingInlineStart: 18 }}>
            {m.assets.map((a) => (
              <li key={a.path} style={small}>
                {creator(a.author)} · {a.source ? link(a.source, a.license) : a.license}
                {a.credit && <span> — {localize(a.credit, lang)}</span>}
                {a.redistribution === 'restricted' && (
                  <details style={{ marginTop: 2 }}>
                    <summary style={{ cursor: 'pointer', color: 'var(--cth-danger-700)' }}>
                      {t('settings.general.worlds.credits.restricted')}
                    </summary>
                    {a.terms && <span>{localize(a.terms, lang)}</span>}
                  </details>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {m.disclaimers?.map((d, i) => (
        <p key={i} style={{ ...small, fontStyle: 'italic' }}>{localize(d, lang)}</p>
      ))}
    </section>
  );
}
