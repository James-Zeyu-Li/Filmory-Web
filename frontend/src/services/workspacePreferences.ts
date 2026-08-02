export const GEAR_SUB_TAB_KEY = 'grainfolio_gear_sub_tab';
export const ROLLS_LIBRARY_VIEW_KEY = 'grainfolio_rolls_library_view';
export const ROLLS_TAB_ORDER_KEY = 'grainfolio_rolls_tab_order';
export const ROLLS_COLLECTIONS_TAB_ENABLED_KEY = 'grainfolio_rolls_collections_tab_enabled';
export const WORKSPACE_PREFERENCES_CHANGED_EVENT = 'grainfolio:workspace-preferences-changed';

export type RollsTabId = 'collections' | 'all' | 'loose';

export const DEFAULT_ROLLS_TAB_ORDER: RollsTabId[] = ['all', 'collections', 'loose'];

const WORKSPACE_TAB_PREFERENCE_KEYS = [
  GEAR_SUB_TAB_KEY,
  ROLLS_LIBRARY_VIEW_KEY,
];

export const clearWorkspaceTabPreferences = () => {
  WORKSPACE_TAB_PREFERENCE_KEYS.forEach(key => localStorage.removeItem(key));
};

const dispatchWorkspacePreferencesChanged = () => {
  window.dispatchEvent(new CustomEvent(WORKSPACE_PREFERENCES_CHANGED_EVENT));
};

const isRollsTabId = (value: string): value is RollsTabId => {
  return value === 'collections' || value === 'all' || value === 'loose';
};

export const readRollsTabOrder = (): RollsTabId[] => {
  const raw = localStorage.getItem(ROLLS_TAB_ORDER_KEY);
  if (!raw) return DEFAULT_ROLLS_TAB_ORDER;

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_ROLLS_TAB_ORDER;

    const normalized = parsed.filter((value): value is RollsTabId => typeof value === 'string' && isRollsTabId(value));
    const unique = normalized.filter((value, index) => normalized.indexOf(value) === index);

    if (unique.length !== DEFAULT_ROLLS_TAB_ORDER.length) return DEFAULT_ROLLS_TAB_ORDER;
    if (!DEFAULT_ROLLS_TAB_ORDER.every(tab => unique.includes(tab))) return DEFAULT_ROLLS_TAB_ORDER;

    return unique;
  } catch {
    return DEFAULT_ROLLS_TAB_ORDER;
  }
};

export const writeRollsTabOrder = (order: RollsTabId[]) => {
  localStorage.setItem(ROLLS_TAB_ORDER_KEY, JSON.stringify(order));
  dispatchWorkspacePreferencesChanged();
};

export const readRollsCollectionsTabEnabled = () => {
  return localStorage.getItem(ROLLS_COLLECTIONS_TAB_ENABLED_KEY) !== 'false';
};

export const writeRollsCollectionsTabEnabled = (enabled: boolean) => {
  localStorage.setItem(ROLLS_COLLECTIONS_TAB_ENABLED_KEY, String(enabled));
  dispatchWorkspacePreferencesChanged();
};

export const getVisibleRollsTabOrder = (enableFilmMode: boolean): RollsTabId[] => {
  const order = readRollsTabOrder();
  const collectionsVisible = !enableFilmMode || readRollsCollectionsTabEnabled();
  return order.filter(tab => {
    if (tab === 'all') return true;
    if (!collectionsVisible) return false;
    return true;
  });
};
