// Keep this module identical in client/src/utils/tags.js and server/src/utils/tags.js.
// Only explicit aliases are merged; unrelated words are never matched fuzzily.
const aliases = { mat: 'matematica', matemat: 'matematica' };

export function normalizeTag(value) {
  const key = value.normalize('NFD').replace(/\p{M}/gu, '')
    .toLocaleLowerCase('pt-BR').trim().replace(/\s+/gu, ' ');
  return Object.hasOwn(aliases, key) ? aliases[key] : key;
}

export function normalizeTags(tags) {
  return [...new Set(tags.map(normalizeTag).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

export function suggestTags(available, input) {
  const parts = input.split(',');
  const query = normalizeTag(parts.pop() ?? '');
  const selected = new Set(normalizeTags(parts));
  return normalizeTags(available).filter((tag) => !selected.has(tag) && (!query || tag.includes(query))).slice(0, 12);
}
