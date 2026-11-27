import { BaseApi } from '../../shared/infrastructure/base-api.js';

const earlyWarningAlertsEndpointPath = import.meta.env
    .VITE_EARLY_WARNING_ALERTS_ENDPOINT_PATH || '/early-warning-alerts';

/**
 * REST gateway for the Safety Monitoring alerts of the VitalTrek RESTful API. The server evaluates the persisted
 * readings and passages and raises the alerts; the client reads them and requests status transitions only.
 */
export class SafetyMonitoringApi extends BaseApi {
    /** Reads the open alerts of the groups the authenticated user can see. */
    getOpenAlerts() {
        return this.http.get(earlyWarningAlertsEndpointPath);
    }

    /** Reads every alert of a tracking session, closed ones included. */
    getAlertsBySession(sessionId) {
        return this.http.get(earlyWarningAlertsEndpointPath, { params: { sessionId } });
    }

    /** Reads one alert. */
    getAlert(earlyWarningAlertId) {
        return this.http.get(`${earlyWarningAlertsEndpointPath}/${earlyWarningAlertId}`);
    }

    /** Requests a transition: acknowledged, dismissed or resolved. The server records who performed it and when. */
    updateAlertStatus(earlyWarningAlertId, status) {
        return this.http.patch(`${earlyWarningAlertsEndpointPath}/${earlyWarningAlertId}/status`, { status });
    }

    /** Asks the server to evaluate the delay of a session again; only its assigned guide or an administrator may. */
    requestEvaluation(sessionId) {
        return this.http.post(`${earlyWarningAlertsEndpointPath}/evaluations`, { sessionId });
    }
}
