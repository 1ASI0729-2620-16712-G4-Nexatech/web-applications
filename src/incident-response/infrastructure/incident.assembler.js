import { Incident } from '../domain/model/incident.entity.js';
export class IncidentAssembler {
    static toEntityFromResource(resource) { return new Incident(resource); }
    static toEntitiesFromResponse(response) { return response.data.map((item) => this.toEntityFromResource(item)); }
}
