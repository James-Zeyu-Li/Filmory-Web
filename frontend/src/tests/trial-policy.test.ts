import { describe, expect, it } from 'vitest';
import {
  TRIAL_RESOURCE_LIMIT,
  TRIAL_RESOURCE_LABELS,
  canCreateTrialResource,
  getTrialLimitMessage,
} from '../services/trialPolicy';

describe('trialPolicy', () => {
  it('allows one item per resource and blocks the second item', () => {
    expect(TRIAL_RESOURCE_LIMIT).toBe(1);
    expect(canCreateTrialResource(0)).toBe(true);
    expect(canCreateTrialResource(1)).toBe(false);
  });

  it('keeps user-facing resource labels for registration prompts', () => {
    expect(TRIAL_RESOURCE_LABELS.cameras).toBe('相机');
    expect(TRIAL_RESOURCE_LABELS.rolls).toBe('拍摄卷');
    expect(getTrialLimitMessage('filmStocks')).toContain('胶卷库存');
    expect(getTrialLimitMessage('filmStocks')).toContain('最多可以创建 1 个');
  });
});
