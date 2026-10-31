import { SimulatedApi } from '../../shared/infrastructure/simulated-api.js';
import { BaseEndpoint } from '../../shared/infrastructure/base-endpoint.js';

const earlyWarningAlertsEndpointPath = import.meta.env
    .VITE_EARLY_WARNING_ALERTS_ENDPOINT_PATH || '/early-warning-alerts';

/**
 * API gateway for the Safety Monitoring bounded context.
 */
export class SafetyMonitoringApi extends SimulatedApi {
    #earlyWarningAlertsEndpoint;
    #progressEndpoint;

    constructor() {
        super();

        this.#earlyWarningAlertsEndpoint = new BaseEndpoint(
            this,
            earlyWarningAlertsEndpointPath,
        );
        this.#progressEndpoint = new BaseEndpoint(this, '/group-progress');
    }

    getEarlyWarningAlerts() {
        return this.#earlyWarningAlertsEndpoint.getAll();
    }

    createEarlyWarningAlert(resource) { return this.#earlyWarningAlertsEndpoint.create(resource); }

    async updateProgressRisk(groupId, riskLevel, status) {
        const current = (await this.#progressEndpoint.getAll({ expeditionGroupId: groupId })).data[0];
        if (current) await this.#progressEndpoint.patch(current.id, { riskLevel, status });
    }

    updateEarlyWarningAlert(earlyWarningAlertId, earlyWarningAlert) {
        return this.#earlyWarningAlertsEndpoint.update(
            earlyWarningAlertId,
            earlyWarningAlert,
        );
    }
}
