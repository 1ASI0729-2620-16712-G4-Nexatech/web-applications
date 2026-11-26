import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

export function useTrackingTime() {
    const { locale } = useI18n();
    const now = ref(Date.now());
    const clock = computed(() => new Intl.DateTimeFormat(locale.value, {
        dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Lima',
    }));
    const relative = computed(() => new Intl.RelativeTimeFormat(locale.value, { numeric: 'auto' }));
    let timer;
    onMounted(() => { timer = setInterval(() => { now.value = Date.now(); }, 30_000); });
    onUnmounted(() => clearInterval(timer));

    function elapsedMinutes(value) {
        return Math.max(0, Math.floor((now.value - Date.parse(value)) / 60_000));
    }

    function timestamp(value) {
        return Number.isFinite(Date.parse(value)) ? clock.value.format(new Date(value)) : '—';
    }

    function age(value) {
        const minutes = elapsedMinutes(value);
        if (!Number.isFinite(minutes)) return '';
        if (minutes === 0) return relative.value.format(0, 'second');
        if (minutes < 60) return relative.value.format(-minutes, 'minute');
        if (minutes < 1440) return relative.value.format(-Math.floor(minutes / 60), 'hour');
        return relative.value.format(-Math.floor(minutes / 1440), 'day');
    }

    return { timestamp, age, isStale: (value) => elapsedMinutes(value) >= 30 };
}
