import { describe, expect, it } from 'vitest';
import {
  TRIAL_RESOURCE_LIMIT,
  TRIAL_RESOURCE_LABEL_KEYS,
  canCreateTrialResource,
  getTrialLimitMessage,
} from '../services/trialPolicy';
import { translations } from '../i18n/translations';

const t = (
  key: keyof typeof translations['zh-CN'],
  values: Record<string, string | number> = {}
) => {
  const template = translations['zh-CN'][key] ?? key;
  return template.replace(/\{\{(\w+)\}\}/g, (_, valueKey: string) => (
    values[valueKey] === undefined ? '' : String(values[valueKey])
  ));
};

describe('trialPolicy', () => {
  it('allows one item per resource and blocks the second item', () => {
    expect(TRIAL_RESOURCE_LIMIT).toBe(1);
    expect(canCreateTrialResource(0)).toBe(true);
    expect(canCreateTrialResource(1)).toBe(false);
  });

  it('keeps user-facing resource labels for registration prompts', () => {
    expect(TRIAL_RESOURCE_LABEL_KEYS.cameras).toBe('trial.resource.cameras');
    expect(TRIAL_RESOURCE_LABEL_KEYS.rolls).toBe('trial.resource.rolls');
    expect(getTrialLimitMessage('filmStocks', t)).toContain('胶卷库存');
    expect(getTrialLimitMessage('filmStocks', t)).toContain('最多可以创建 1 个');
  });
});
