<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
const props = defineProps({ checkpoints: { type: Array, default: () => [] } });
const { t } = useI18n();
const points = computed(() => {
    const valid = props.checkpoints.filter((c) => Number.isFinite(c.latitude) && Number.isFinite(c.longitude));
    const lats = valid.map((c) => c.latitude), lons = valid.map((c) => c.longitude);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats), minLon = Math.min(...lons), maxLon = Math.max(...lons);
    return valid.map((c) => ({ ...c, x: 45 + (c.longitude - minLon) / (maxLon - minLon || 1) * 510, y: 250 - (c.latitude - minLat) / (maxLat - minLat || 1) * 200 }));
});
</script>
<template>
  <figure class="vt-route-map"><svg viewBox="0 0 600 300" role="img" :aria-label="t('workflow.routeDiagram')"><defs><pattern id="route-grid" width="30" height="30" patternUnits="userSpaceOnUse"><path d="M 30 0 L 0 0 0 30" fill="none" stroke="#d9e2dc" stroke-width="1" /></pattern></defs><rect width="600" height="300" fill="url(#route-grid)" rx="16" /><polyline :points="points.map((p) => `${p.x},${p.y}`).join(' ')" fill="none" stroke="#1c7c7d" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" /><g v-for="(point, index) in points" :key="point.id"><circle :cx="point.x" :cy="point.y" r="14" fill="#0f3d2e" /><text :x="point.x" :y="point.y + 5" text-anchor="middle" fill="white" font-size="13">{{ index + 1 }}</text><title>{{ point.location }}: {{ point.latitude }}, {{ point.longitude }}</title></g></svg><figcaption>{{ t('workflow.routeDiagramHint') }}</figcaption></figure>
</template>
