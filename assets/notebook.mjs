// Product wording is shared by the page and downloadable review notes.
export const SITE_CONFIG = Object.freeze({
  name: '豆苗的成长手帖',
  subtitle: '记录经验，整理方法，慢慢成长。',
  section: '面试练习',
});
const practiceTime = value => typeof value === 'string' ? Date.parse(value) : NaN;
export function getLearningSummary(items, progress = {}) {
  const total = items.length;
  const practiced = items.filter(item => Number.isFinite(practiceTime(progress.practiced?.[item.id]))).length;
  const favorites = items.filter(item => progress.favorites?.[item.id] === true).length;
  return {total, practiced, favorites, completion: total ? Math.round(practiced / total * 100) : 0};
}
export function getNextPracticeId(items, progress = {}) {
  let latest = -Infinity, start = -1;
  items.forEach((item, index) => {
    const time = practiceTime(progress.practiced?.[item.id]);
    if (Number.isFinite(time) && time > latest) { latest = time; start = index; }
  });
  for (let offset = 1; offset <= items.length; offset++) {
    const item = items[(start + offset) % items.length];
    if (!Number.isFinite(practiceTime(progress.practiced?.[item.id]))) return item.id;
  }
  return null;
}
