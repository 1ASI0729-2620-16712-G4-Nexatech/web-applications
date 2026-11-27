import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Duration } from '../src/expedition-setup/domain/model/duration.js';
import {
    canEnableRoute,
    enablementRequirements,
    routeStartRequirements,
    segmentsWithoutWindow,
} from '../src/expedition-setup/domain/model/route-readiness.js';

test('durations convert days and hours, and hours and minutes, to the minutes stored by the API', () => {
    assert.equal(Duration.fromDaysAndHours(2, 3).totalMinutes, 3060);
    assert.equal(Duration.fromHoursAndMinutes(2, 30).totalMinutes, 150);
    assert.equal(Duration.fromDaysAndHours(null, 5).totalMinutes, 300);
    assert.equal(Duration.fromHoursAndMinutes(null, 45).totalMinutes, 45);
    assert.equal(Duration.fromHoursAndMinutes(30, 0).totalMinutes, 1800);
});

test('a stored duration is rebuilt with the same units, without losing minutes', () => {
    assert.deepEqual(Duration.fromMinutes(3060).toDaysAndHours(), { days: 2, hours: 3, minutes: 0 });
    assert.deepEqual(Duration.fromMinutes(150).toHoursAndMinutes(), { hours: 2, minutes: 30 });
    // A route saved before D04 in minutes that are not whole hours keeps its remaining minutes.
    assert.deepEqual(Duration.fromMinutes(1530).toDaysAndHours(), { days: 1, hours: 1, minutes: 30 });
    for (const minutes of [0, 59, 60, 1439, 1440, 3060, 10_079]) {
        const { days, hours, minutes: rest } = Duration.fromMinutes(minutes).toDaysAndHours();
        assert.equal(days * 1440 + hours * 60 + rest, minutes);
        const parts = Duration.fromMinutes(minutes).toHoursAndMinutes();
        assert.equal(Duration.fromHoursAndMinutes(parts.hours, parts.minutes).totalMinutes, minutes);
    }
});

test('durations reject fractions, negatives and parts out of range', () => {
    assert.equal(Duration.fromDaysAndHours(1, 24), null);
    assert.equal(Duration.fromDaysAndHours(-1, 2), null);
    assert.equal(Duration.fromDaysAndHours(1.5, 0), null);
    assert.equal(Duration.fromHoursAndMinutes(1, 60), null);
    assert.equal(Duration.fromHoursAndMinutes(0, 2.5), null);
    assert.equal(Duration.fromMinutes(null), null);
    assert.equal(Duration.fromMinutes(-5), null);
    assert.throws(() => new Duration(1.5), RangeError);
    assert.equal(Duration.fromHoursAndMinutes(2, 30).isLongerThan(Duration.fromHoursAndMinutes(2, 29)), true);
    assert.equal(Duration.fromHoursAndMinutes(2, 30).isLongerThan(Duration.fromMinutes(150)), false);
});

const route = { id: 3, status: 'draft' };
const start = { id: 10, sequenceOrder: 1 }, ridge = { id: 11, sequenceOrder: 2 }, summit = { id: 12, sequenceOrder: 3 };

test('enabling a route only requires a checkpoint; starting an expedition requires more', () => {
    assert.deepEqual(enablementRequirements({ checkpoints: [] }), [{ key: 'checkpoint', met: false }]);
    assert.equal(canEnableRoute({ checkpoints: [start] }), true);

    // An enabled route with one checkpoint can be enabled but still cannot start an expedition.
    assert.deepEqual(
        routeStartRequirements({ route: { ...route, status: 'enabled' }, checkpoints: [start], windows: [] })
            .map(({ key, met }) => [key, met]),
        [['enabled', true], ['twoCheckpoints', false], ['timeWindows', false]],
    );
});

test('every consecutive segment needs a valid expected time window, in checkpoint order', () => {
    const checkpoints = [summit, start, ridge];
    const windows = [
        { fromCheckpointId: 10, toCheckpointId: 11, minimumMinutes: 90, maximumMinutes: 150 },
        { fromCheckpointId: 11, toCheckpointId: 12, minimumMinutes: 60, maximumMinutes: 60 },
    ];
    assert.deepEqual(segmentsWithoutWindow({ checkpoints, windows }).map(({ from, to }) => [from.id, to.id]), [[11, 12]]);
    assert.deepEqual(routeStartRequirements({ route, checkpoints, windows }).at(-1), { key: 'timeWindows', met: false, missing: 1 });

    windows[1].maximumMinutes = 120;
    assert.deepEqual(
        routeStartRequirements({ route: { ...route, status: 'enabled' }, checkpoints, windows }).map(({ met }) => met),
        [true, true, true],
    );
});

test('duration units and draft explanations have a text in English and Spanish', async () => {
    const keys = [
        'duration.days', 'duration.hours', 'duration.minutes',
        'routeForm.estimatedDuration', 'routeForm.days', 'routeForm.hours', 'routeForm.durationTotal',
        'routes.draftNeedsCheckpoint', 'routes.draftReadyToEnable', 'routes.status.draft', 'routes.status.enabled',
        'validation.durationInvalid', 'validation.durationPartsInvalid',
    ];
    for (const language of ['en', 'es']) {
        const messages = JSON.parse(await readFile(new URL(`../src/locales/${language}.json`, import.meta.url), 'utf8'));
        for (const key of keys) {
            const text = key.split('.').reduce((node, part) => node?.[part], messages);
            assert.equal(typeof text, 'string', `${language}: ${key}`);
            assert.equal(text.includes('|'), false, `${language}: ${key} must not be read as a plural form`);
        }
    }
});
