/** Last persisted state of a group's tracking session. */
export class GroupProgress {
    constructor({
        sessionId, expeditionGroupId, routeId, status, startedAt, endedAt, totalCheckpoints,
        confirmedCheckpointsCount, estimatedProgressPercentage, lastConfirmedCheckpoint,
        nextCheckpoint, confirmedCheckpoints, participants, synchronizedAt,
    }) {
        Object.assign(this, {
            sessionId, expeditionGroupId, routeId, status, startedAt, endedAt, totalCheckpoints,
            confirmedCheckpointsCount, estimatedProgressPercentage, lastConfirmedCheckpoint,
            nextCheckpoint, confirmedCheckpoints, participants, synchronizedAt,
        });
    }
}
