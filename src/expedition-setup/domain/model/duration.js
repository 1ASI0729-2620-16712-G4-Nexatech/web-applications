export const MINUTES_PER_HOUR = 60;
export const HOURS_PER_DAY = 24;
export const MINUTES_PER_DAY = MINUTES_PER_HOUR * HOURS_PER_DAY;

/** An empty input counts as zero; anything else must be a whole number of at least zero. */
function toPart(value) {
    if (value === null || value === undefined || value === '') return 0;
    return Number.isInteger(value) && value >= 0 ? value : null;
}

/**
 * Value object for a length of time within Expedition Setup. The API stores route durations and expected time windows
 * in whole minutes; people enter them in days and hours or in hours and minutes. The conversion is exact both ways, so
 * a stored value is always shown with the same units it was entered with.
 */
export class Duration {
    /**
     * @param {number} totalMinutes - Whole minutes, zero or more.
     * @throws {RangeError} When the value is not a whole number of minutes of at least zero.
     */
    constructor(totalMinutes) {
        if (!Number.isInteger(totalMinutes) || totalMinutes < 0) {
            throw new RangeError('A duration is a whole number of minutes of at least zero.');
        }
        this.totalMinutes = totalMinutes;
        Object.freeze(this);
    }

    /**
     * @param {?number} days - Whole days; empty counts as zero.
     * @param {?number} hours - Whole hours from 0 to 23; empty counts as zero.
     * @returns {?Duration} The duration, or null when a part is not a valid whole number.
     */
    static fromDaysAndHours(days, hours) {
        const [wholeDays, wholeHours] = [toPart(days), toPart(hours)];
        if (wholeDays === null || wholeHours === null || wholeHours >= HOURS_PER_DAY) return null;
        return new Duration(wholeDays * MINUTES_PER_DAY + wholeHours * MINUTES_PER_HOUR);
    }

    /**
     * @param {?number} hours - Whole hours; empty counts as zero.
     * @param {?number} minutes - Whole minutes from 0 to 59; empty counts as zero.
     * @returns {?Duration} The duration, or null when a part is not a valid whole number.
     */
    static fromHoursAndMinutes(hours, minutes) {
        const [wholeHours, wholeMinutes] = [toPart(hours), toPart(minutes)];
        if (wholeHours === null || wholeMinutes === null || wholeMinutes >= MINUTES_PER_HOUR) return null;
        return new Duration(wholeHours * MINUTES_PER_HOUR + wholeMinutes);
    }

    /** @returns {?Duration} The duration of a stored value, or null when the API returned no valid minutes. */
    static fromMinutes(totalMinutes) {
        return Number.isInteger(totalMinutes) && totalMinutes >= 0 ? new Duration(totalMinutes) : null;
    }

    /** @returns {{days: number, hours: number, minutes: number}} Days, hours of the day and remaining minutes. */
    toDaysAndHours() {
        return {
            days: Math.floor(this.totalMinutes / MINUTES_PER_DAY),
            hours: Math.floor((this.totalMinutes % MINUTES_PER_DAY) / MINUTES_PER_HOUR),
            minutes: this.totalMinutes % MINUTES_PER_HOUR,
        };
    }

    /** @returns {{hours: number, minutes: number}} Whole hours and remaining minutes. */
    toHoursAndMinutes() {
        return {
            hours: Math.floor(this.totalMinutes / MINUTES_PER_HOUR),
            minutes: this.totalMinutes % MINUTES_PER_HOUR,
        };
    }

    /** @returns {boolean} Whether this duration is longer than another one. */
    isLongerThan(other) {
        return this.totalMinutes > other.totalMinutes;
    }
}
