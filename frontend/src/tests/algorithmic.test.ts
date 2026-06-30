import { describe, it, expect } from 'vitest';

describe('Algorithmic Robustness (Pure Functions)', () => {
  it('DnD Reorder Engine should heal a broken array and assign clean linear orderIndex', () => {
    // 1. Simulate a completely broken array of photo entities resulting from crashes or sync conflicts
    const brokenPhotos = [
      { id: 'p1', orderIndex: undefined }, // Missing completely
      { id: 'p2', orderIndex: 999 },       // Ridiculous number
      { id: 'p3', orderIndex: -50 },       // Negative
      { id: 'p4', orderIndex: 999 },       // Duplicate
    ];

    // 2. The DnD Reorder core logic (Array Splice + Re-Index)
    const reorderPhotos = (list: any[], startIndex: number, endIndex: number) => {
      const result = Array.from(list);
      const [removed] = result.splice(startIndex, 1);
      result.splice(endIndex, 0, removed);
      
      // Healing phase: map and strictly enforce linear indexes
      return result.map((item, index) => ({
        ...item,
        orderIndex: index
      }));
    };

    // 3. User drags the photo at Index 3 (p4) and drops it to Index 0.
    const healedAndReordered = reorderPhotos(brokenPhotos, 3, 0);

    // 4. Assertions
    // Expected order of IDs: p4, p1, p2, p3
    expect(healedAndReordered[0].id).toBe('p4');
    expect(healedAndReordered[1].id).toBe('p1');
    expect(healedAndReordered[2].id).toBe('p2');
    expect(healedAndReordered[3].id).toBe('p3');

    // Expected sequence of strictly enforced orderIndexes
    expect(healedAndReordered[0].orderIndex).toBe(0);
    expect(healedAndReordered[1].orderIndex).toBe(1);
    expect(healedAndReordered[2].orderIndex).toBe(2);
    expect(healedAndReordered[3].orderIndex).toBe(3);
    
    // No NaN or Undefined allowed
    healedAndReordered.forEach(p => {
      expect(typeof p.orderIndex).toBe('number');
      expect(Number.isNaN(p.orderIndex)).toBe(false);
    });
  });
});
