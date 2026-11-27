import { requireCondition } from '../../../shared/domain/application-error.js';

/** Maximum length of the optional health information accepted by the API. */
export const MAX_HEALTH_NOTES = 500;

export class ParticipantPreparation {
    constructor({ id, expeditionGroupId, memberId, wearableId = null, consent = false, activated = false, emergencyContact = {}, baselineMin = 50, baselineMax = 140, agencyId, returnedAt = null, returnCondition = null, healthNotes = null, healthNotesRecordedAt = null }) {
        Object.assign(this, { id, expeditionGroupId, memberId, wearableId, consent, activated, emergencyContact, baselineMin, baselineMax, agencyId, returnedAt, returnCondition, healthNotes, healthNotesRecordedAt });
    }
    /**
     * Offline snapshots and local storage never keep the optional health information: it is read from the API by the
     * participant and the authorized staff of the group only while they are online.
     */
    toJSON() {
        const { healthNotes, healthNotesRecordedAt, ...stored } = this;
        return stored;
    }
    validateConsent() {
        requireCondition(this.consent && this.emergencyContact.name?.trim() && this.emergencyContact.phone?.trim(), 'workflow.errors.consent');
        requireCondition(Number.isFinite(this.baselineMin) && this.baselineMin > 0 && this.baselineMax > this.baselineMin);
    }
    get ready() { return !!(this.wearableId && this.consent && this.activated && this.emergencyContact.name && this.emergencyContact.phone); }
}
