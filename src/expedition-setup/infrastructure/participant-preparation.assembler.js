import { ParticipantPreparation } from '../domain/model/participant-preparation.entity.js';

export class ParticipantPreparationAssembler {
    static toEntityFromResource(resource) { return new ParticipantPreparation({ ...resource, emergencyContact: resource.emergencyContact ?? {} }); }
    static toEntitiesFromResponse(response) { return response.data.map((item) => this.toEntityFromResource(item)); }
}
