import { useI18n } from 'vue-i18n';
import { Duration } from '../domain/model/duration.js';

/**
 * Shows durations stored in minutes with the units they are entered with: days and hours for a route and hours and
 * minutes for a segment. Zero parts are omitted ("2 d 3 h", "45 min"); remaining minutes are never hidden.
 */
export function useDurationFormat() {
    const { t } = useI18n();

    function join(parts) {
        const shown = Object.entries(parts).filter(([, value]) => value > 0)
            .map(([unit, value]) => t(`duration.${unit}`, { count: value }));
        return shown.length ? shown.join(' ') : t('duration.minutes', { count: 0 });
    }

    /** @returns {string} A route duration in days and hours, or a dash when there is no valid value. */
    function formatDaysAndHours(totalMinutes) {
        const duration = Duration.fromMinutes(totalMinutes);
        return duration ? join(duration.toDaysAndHours()) : '—';
    }

    /** @returns {string} A segment duration in hours and minutes, or a dash when there is no valid value. */
    function formatHoursAndMinutes(totalMinutes) {
        const duration = Duration.fromMinutes(totalMinutes);
        return duration ? join({ hours: 0, ...duration.toHoursAndMinutes() }) : '—';
    }

    return { formatDaysAndHours, formatHoursAndMinutes };
}
