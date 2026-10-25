/** Demonstration rules over checkpoint snapshots, never a medical assessment or live signal. */
export function evaluateSafety(group, telemetry, arrivals, segments, preparations, now = Date.now()) {
    const results = [];
    const latest = new Map();
    telemetry.filter((r) => r.expeditionGroupId === group.id).forEach((r) => {
        if (!latest.has(r.memberId) || r.recordedAt > latest.get(r.memberId).recordedAt) latest.set(r.memberId, r);
    });
    for (const record of latest.values()) {
        const baseline = preparations.find((p) => p.memberId === record.memberId);
        if (baseline && (record.heartRate < baseline.baselineMin || record.heartRate > baseline.baselineMax)) {
            results.push({ key: `vital-${record.memberId}`, type: 'vital-sign-anomaly', priority: 'high', riskEvidence: [{ metricType: 'heart-rate', observedValue: `${record.heartRate} bpm`, expectedValue: `${baseline.baselineMin}–${baseline.baselineMax} bpm (demo)`, recordedAt: record.recordedAt }] });
        }
        if (record.deviationMeters > 100) results.push({ key: `deviation-${record.memberId}`, type: 'route-deviation', priority: 'high', riskEvidence: [{ metricType: 'route-position', observedValue: `${record.deviationMeters} m (simulated)`, expectedValue: '≤ 100 m (demo)', recordedAt: record.recordedAt }] });
    }
    const visits = arrivals.filter((r) => r.expeditionGroupId === group.id);
    for (const segment of segments) {
        const from = visits.find((r) => r.checkpointId === segment.fromCheckpoint.id);
        const to = visits.find((r) => r.checkpointId === segment.toCheckpoint.id);
        if (!from || !segment.expectedTimeWindow) continue;
        const elapsed = ((to ? Date.parse(to.recordedAt) : now) - Date.parse(from.recordedAt)) / 60000;
        if (elapsed > segment.expectedTimeWindow.maximumMinutes) results.push({ key: `delay-${segment.toCheckpoint.id}`, type: 'delay', priority: 'medium', riskEvidence: [{ metricType: 'elapsed-time', observedValue: `${Math.round(elapsed)} min`, expectedValue: `≤ ${segment.expectedTimeWindow.maximumMinutes} min`, recordedAt: to?.recordedAt ?? new Date(now).toISOString() }] });
    }
    return results;
}
