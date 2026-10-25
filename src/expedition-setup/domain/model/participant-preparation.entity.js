import { requireCondition } from '../../../shared/domain/application-error.js';

export class ParticipantPreparation {
    constructor({ id, expeditionGroupId, memberId, wearableId = null, consent = false, activated = false, emergencyContact = {}, baselineMin = 50, baselineMax = 140, agencyId, returnedAt = null, returnCondition = null }) {
        Object.assign(this, { id, expeditionGroupId, memberId, wearableId, consent, activated, emergencyContact, baselineMin, baselineMax, agencyId, returnedAt, returnCondition });
    }
    validateConsent() {
        requireCondition(this.consent && this.emergencyContact.name?.trim() && this.emergencyContact.phone?.trim(), 'workflow.errors.consent');
        requireCondition(Number.isFinite(this.baselineMin) && this.baselineMin > 0 && this.baselineMax > this.baselineMin);
    }
    get ready() { return !!(this.wearableId && this.consent && this.activated && this.emergencyContact.name && this.emergencyContact.phone); }
}
