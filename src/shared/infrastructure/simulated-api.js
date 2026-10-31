import axios from 'axios';
import { simulatedApiInterceptor } from '../../iam/infrastructure/iam.interceptor.js';

const simulatedApi = import.meta.env.VITE_SIMULATED_API_URL || '/simulated-api/v1';

/**
 * HTTP client for the json-server Fake API that still backs Field Tracking, Checkpoint Sync,
 * Safety Monitoring, Incident Response and Tour Closure.
 */
export class SimulatedApi {
    #http;

    constructor() {
        this.#http = axios.create({
            baseURL: simulatedApi,
            timeout: 10000,
            headers: {
                'Content-Type': 'application/json',
            },
        });
        this.#http.interceptors.request.use(simulatedApiInterceptor);
    }

    get http() {
        return this.#http;
    }
}
