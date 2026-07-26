import { deepEqual, equal } from 'node:assert/strict';
import test from 'node:test';
import {
    mergeStoredCalendarGroups,
    normalizeCalendarGroupTombstones,
} from './schedulingTypes.ts';

test('legacy stored groups receive the missing US Holidays system group', () => {
    const groups = mergeStoredCalendarGroups(
        [{
            id: 'grp_work',
            name: 'Work',
            color: '#3b82f6',
            enabled: true,
            expanded: false,
        }],
        [],
        false,
    );

    equal(groups.length, 2);
    equal(groups.find((group) => group.id === 'grp_work')?.kind, 'custom');
    equal(groups.find((group) => group.id === 'grp_holidays')?.enabled, false);
});

test('US Holidays tombstone prevents the system group from returning', () => {
    const groups = mergeStoredCalendarGroups([], ['grp_holidays'], true);
    equal(groups.some((group) => group.id === 'grp_holidays'), false);
});

test('calendar group tombstones normalize duplicate and invalid values', () => {
    deepEqual(
        normalizeCalendarGroupTombstones(['grp_holidays', 1, 'grp_holidays', 'grp_work']),
        ['grp_holidays', 'grp_work'],
    );
});
