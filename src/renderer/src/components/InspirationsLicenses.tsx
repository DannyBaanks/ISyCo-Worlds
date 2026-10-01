import { useTranslation } from 'react-i18next';
import { WorldCredits } from '@/worlds/WorldCredits';

const projects = [
  {
    key: 'munder',
    name: 'Munder Difflin',
    website: 'https://munderdiffl.in',
    github: 'https://github.com/chaitanyagiri/munder-difflin',
  },
  {
    key: 'opencode',
    name: 'OpenCode',
    website: 'https://opencode.ai',
    github: 'https://github.com/anomalyco/opencode',
  },
] as const;

/** Origin, integrations and world asset credits, kept together at the end of General. */
export function InspirationsLicenses() {
  const { t } = useTranslation();

  return (
    <section aria-labelledby="inspirations-licenses-title" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <header>
        <h2 id="inspirations-licenses-title" style={{ margin: 0, fontFamily: 'var(--cth-font-display)', fontSize: 10, lineHeight: '16px' }}>
          {t('settings.general.inspirations.title')}
        </h2>
        <p style={{ margin: '4px 0 0', fontSize: 12, lineHeight: '18px', color: 'var(--cth-ink-600)' }}>
          {t('settings.general.inspirations.description')}
        </p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 230px), 1fr))', gap: 10 }}>
        {projects.map((project) => (
          <article key={project.key} style={{ padding: 12, background: 'var(--cth-cream-200)', boxShadow: 'inset 0 0 0 1px var(--cth-ink-300)', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <h3 style={{ margin: 0, fontFamily: 'var(--cth-font-display)', fontSize: 9, lineHeight: '14px' }}>{project.name}</h3>
            <p style={{ margin: 0, minHeight: 36, fontSize: 12, lineHeight: '18px', color: 'var(--cth-ink-700)' }}>
              {t(`settings.general.inspirations.${project.key}`)}
            </p>
            <p style={{ margin: 0, fontSize: 11, lineHeight: '16px', color: 'var(--cth-ink-600)' }}>
              {project.key === 'munder' ? t('settings.general.inspirations.munderLicense') : t('settings.general.inspirations.openSource')}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 'auto' }}>
              {[['website', project.website], ['github', project.github]].map(([label, href]) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', minHeight: 28, padding: '4px 8px', border: '1px solid var(--cth-ink-500)', background: 'var(--cth-cream-50)', color: 'var(--cth-ink-900)', fontSize: 11, lineHeight: '16px', textDecoration: 'none' }}
                >
                  {t(`settings.general.inspirations.${label}`)} ↗
                </a>
              ))}
            </div>
          </article>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: 10 }}>
        <WorldCredits worldId="office" />
        <WorldCredits worldId="monster-trainer" />
      </div>
    </section>
  );
}
