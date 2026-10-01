/**
 * World manifest v1: who made a world, under which licence, from where, and
 * what it is built on. Every world ships one — the two bundled today and any
 * a Marketplace brings later — and a world without complete provenance does
 * not validate. See docs/worlds/MANIFEST.md.
 *
 * Pure data and a pure validator: no fs, no Electron, so main, the renderer
 * and the tests all read the same rules.
 */

/** English is required; other locales are optional and fall back to it. */
export type LocalizedText = string | ({ en: string } & Partial<Record<string, string>>);

export interface WorldCreator {
  name: string;
  url?: string;
}

/** The work a world is derived from: kept so the chain of credit is never lost. */
export interface WorldOrigin {
  name: string;
  author: WorldCreator;
  license: string;
  source: string;
  note?: LocalizedText;
}

/**
 * `open`       anyone may copy and redistribute the file (MIT, ISC, CC0, OFL…).
 * `restricted` the licence limits redistribution; see `terms`. The manifest
 *              says so out loud instead of letting it hide in a text file.
 */
export type AssetRedistribution = 'open' | 'restricted';

export interface WorldAsset {
  /** Repo-relative file or directory (trailing `/`). Every file under it is covered. */
  path: string;
  author: WorldCreator;
  license: string;
  source?: string;
  redistribution: AssetRedistribution;
  /** Required when redistribution is `restricted`: what the licence forbids or demands. */
  terms?: LocalizedText;
  /** A credit line the licence requires to be shown, if any. */
  credit?: LocalizedText;
}

export interface WorldManifestV1 {
  manifestVersion: 1;
  id: string;
  name: string;
  description: LocalizedText;
  author: WorldCreator;
  /** SPDX identifier for the world's own code, e.g. "MIT". */
  license: string;
  source: string;
  derivedFrom?: WorldOrigin[];
  assets: WorldAsset[];
  /** Non-affiliation and trademark notices shown with the world. */
  disclaimers?: LocalizedText[];
}

const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const URL_RE = /^https:\/\/[^\s]+$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function text(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function localized(value: unknown): value is LocalizedText {
  if (text(value)) return true;
  return isRecord(value) && text(value.en) && Object.values(value).every(text);
}

function checkCreator(value: unknown, where: string, errors: string[]): void {
  if (!isRecord(value) || !text(value.name)) errors.push(`${where}.name es obligatorio`);
  else if (value.url !== undefined && !(text(value.url) && URL_RE.test(value.url))) errors.push(`${where}.url debe ser https://`);
}

function checkSource(value: unknown, where: string, errors: string[], required: boolean): void {
  if (value === undefined && !required) return;
  if (!(text(value) && URL_RE.test(value))) errors.push(`${where} debe ser una URL https://`);
}

/** Every problem found, in Spanish, one per line; empty means valid. */
export function validateWorldManifest(value: unknown): string[] {
  const errors: string[] = [];
  if (!isRecord(value)) return ['el manifiesto debe ser un objeto'];
  if (value.manifestVersion !== 1) errors.push('manifestVersion debe ser 1');
  if (!(text(value.id) && ID.test(value.id))) errors.push('id debe ser kebab-case (a-z, 0-9, -)');
  if (!text(value.name)) errors.push('name es obligatorio');
  if (!localized(value.description)) errors.push('description es obligatorio (con "en" si es por idioma)');
  checkCreator(value.author, 'author', errors);
  if (!text(value.license)) errors.push('license es obligatorio');
  checkSource(value.source, 'source', errors, true);

  if (value.derivedFrom !== undefined) {
    if (!Array.isArray(value.derivedFrom)) errors.push('derivedFrom debe ser una lista');
    else value.derivedFrom.forEach((origin, i) => {
      const where = `derivedFrom[${i}]`;
      if (!isRecord(origin)) { errors.push(`${where} debe ser un objeto`); return; }
      if (!text(origin.name)) errors.push(`${where}.name es obligatorio`);
      checkCreator(origin.author, `${where}.author`, errors);
      if (!text(origin.license)) errors.push(`${where}.license es obligatorio`);
      checkSource(origin.source, `${where}.source`, errors, true);
      if (origin.note !== undefined && !localized(origin.note)) errors.push(`${where}.note no es texto válido`);
    });
  }

  if (!Array.isArray(value.assets)) errors.push('assets debe ser una lista (vacía si el mundo no trae archivos)');
  else value.assets.forEach((asset, i) => {
    const where = `assets[${i}]`;
    if (!isRecord(asset)) { errors.push(`${where} debe ser un objeto`); return; }
    if (!text(asset.path) || asset.path.startsWith('/') || asset.path.split('/').includes('..')) {
      errors.push(`${where}.path debe ser una ruta relativa al repo, sin ".."`);
    }
    checkCreator(asset.author, `${where}.author`, errors);
    if (!text(asset.license)) errors.push(`${where}.license es obligatorio`);
    checkSource(asset.source, `${where}.source`, errors, false);
    if (asset.redistribution !== 'open' && asset.redistribution !== 'restricted') {
      errors.push(`${where}.redistribution debe ser "open" o "restricted"`);
    } else if (asset.redistribution === 'restricted' && !localized(asset.terms)) {
      errors.push(`${where}.terms es obligatorio cuando redistribution es "restricted"`);
    }
    if (asset.terms !== undefined && !localized(asset.terms)) errors.push(`${where}.terms no es texto válido`);
    if (asset.credit !== undefined && !localized(asset.credit)) errors.push(`${where}.credit no es texto válido`);
  });

  if (value.disclaimers !== undefined) {
    if (!Array.isArray(value.disclaimers) || !value.disclaimers.every(localized)) {
      errors.push('disclaimers debe ser una lista de textos');
    }
  }
  return errors;
}

export function isWorldManifestV1(value: unknown): value is WorldManifestV1 {
  return validateWorldManifest(value).length === 0;
}

/** Pick the viewer's language, falling back to English. */
export function localize(value: LocalizedText, language: string): string {
  if (typeof value === 'string') return value;
  const base = language.split('-')[0];
  return value[language] ?? value[base] ?? value.en;
}
