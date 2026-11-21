import { describe, it, expect } from 'vitest';
import {
    countNewMailIds,
    createSeenTracker,
    formatUnreadTitle,
    stripUnreadTitlePrefix,
} from '../mail-alerts';

describe('countNewMailIds', () => {
    it('returns ids not present in the seen set', () => {
        const seen = new Set([1, 2, 3]);
        expect(countNewMailIds(seen, [2, 3, 4, 5])).toEqual([4, 5]);
    });

    it('returns an empty array when everything was seen', () => {
        const seen = new Set([1, 2]);
        expect(countNewMailIds(seen, [1, 2])).toEqual([]);
    });
});

describe('createSeenTracker', () => {
    it('treats the first observed batch as already seen', () => {
        const tracker = createSeenTracker();
        expect(tracker.observe([1, 2, 3])).toEqual([]);
        expect(tracker.initialized).toBe(true);
    });

    it('reports ids that appear in later batches', () => {
        const tracker = createSeenTracker();
        tracker.observe([1, 2]);
        expect(tracker.observe([2, 3, 4])).toEqual([3, 4]);
        // Already-reported ids are not reported twice.
        expect(tracker.observe([1, 2, 3, 4])).toEqual([]);
    });

    it('markAllSeen clears the pending set without reporting', () => {
        const tracker = createSeenTracker();
        tracker.observe([1]);
        tracker.markAllSeen([2, 3]);
        expect(tracker.observe([2, 3, 4])).toEqual([4]);
    });

    it('keeps working when the tracked set is pruned', () => {
        const tracker = createSeenTracker();
        const many = Array.from({ length: 1001 }, (_, i) => i + 1);
        tracker.observe(many);
        expect(tracker.observe([2000])).toEqual([]);
    });
});

describe('formatUnreadTitle', () => {
    it('prefixes the count when positive', () => {
        expect(formatUnreadTitle(2, 'Temp Email')).toBe('(2) Temp Email');
        expect(formatUnreadTitle(12, 'Temp Email')).toBe('(12) Temp Email');
    });

    it('returns the base title when zero', () => {
        expect(formatUnreadTitle(0, 'Temp Email')).toBe('Temp Email');
    });
});

describe('stripUnreadTitlePrefix', () => {
    it('removes an unread prefix', () => {
        expect(stripUnreadTitlePrefix('(3) Temp Email')).toBe('Temp Email');
    });

    it('leaves ordinary titles untouched', () => {
        expect(stripUnreadTitlePrefix('Temp Email')).toBe('Temp Email');
    });

    it('only strips a leading count', () => {
        expect(stripUnreadTitlePrefix('Temp (3) Email')).toBe('Temp (3) Email');
    });
});
