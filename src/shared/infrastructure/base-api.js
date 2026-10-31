import axios from 'axios';
import { iamInterceptor, iamResponseErrorInterceptor } from '../../iam/infrastructure/iam.interceptor.js';

const platformApi = import.meta.env.VITE_VITALTREK_API_URL || '/api/v1';

/**
 * HTTP client for the VitalTrek RESTful API. The timeout tolerates the cold start of the hosted service.
 */
export class BaseApi {
    #http;

    constructor() {
        this.#http = axios.create({
            baseURL: platformApi,
            timeout: 60000,
            headers: {
                'Content-Type': 'application/json',
            },
        });
        this.#http.interceptors.request.use(iamInterceptor);
        this.#http.interceptors.response.use((response) => response, iamResponseErrorInterceptor);
    }

    get http() {
        return this.#http;
    }
}
