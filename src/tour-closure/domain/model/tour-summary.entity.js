/** Immutable snapshot; no private participant readings or contacts are included. */
export class TourSummary {
    constructor(resource) {
        Object.assign(this, resource, { checkpoints: resource.checkpoints ?? [] });
    }
}
