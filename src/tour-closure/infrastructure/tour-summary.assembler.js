import { TourSummary } from '../domain/model/tour-summary.entity.js';
export class TourSummaryAssembler {
    static toEntityFromResource(resource) { return new TourSummary(resource); }
    static toEntitiesFromResponse(response) { return response.data.map((item) => this.toEntityFromResource(item)); }
}
