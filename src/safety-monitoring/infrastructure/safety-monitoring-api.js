import { BaseApi } from '../../shared/infrastructure/base-api.js';
import { BaseEndpoint } from '../../shared/infrastructure/base-endpoint.js';

const earlyWarningAlertsEndpointPath = import.meta.env
    .VITE_EARLY_WARNING_ALERTS_ENDPOINT_PATH;

/**
 * API gateway for the Safety Monitoring bounded context.
 */
export class SafetyMonitoringApi extends BaseApi {
    #earlyWarningAlertsEndpoint;

    constructor() {
        super();

        this.#earlyWarningAlertsEndpoint = new BaseEndpoint(
            this,
            earlyWarningAlertsEndpointPath,
        );
    }

    getEarlyWarningAlerts() {
        return this.#earlyWarningAlertsEndpoint.getAll();
    }

    updateEarlyWarningAlert(earlyWarningAlertId, earlyWarningAlert) {
        return this.#earlyWarningAlertsEndpoint.update(
            earlyWarningAlertId,
            earlyWarningAlert,
        );
    }
}
