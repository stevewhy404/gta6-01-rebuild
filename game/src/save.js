// Solmar Bay — save / load via localStorage. Nothing leaves the browser.
const KEY = 'solmar-bay-save-v1';

export function hasSave() {
  try { return !!localStorage.getItem(KEY); } catch (e) { return false; }
}

export function saveGame(state) {
  const p = state.player;
  const data = {
    version: 1,
    money: state.money,
    respect: state.respect,
    health: p.health,
    armor: p.armor,
    x: p.x, y: p.y,
    missionIndex: state.mission ? state.mission.index : (state.storyComplete ? 99 : 0),
    packagesFound: [...state.packagesFound],
    stats: state.stats,
    dayTime: state.dayTime,
    savedAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch (e) { return false; }
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data.version !== 1) return null;
    return data;
  } catch (e) { return null; }
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
}
