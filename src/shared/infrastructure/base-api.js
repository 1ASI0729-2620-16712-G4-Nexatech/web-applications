import axios from 'axios';
import { iamInterceptor } from '../../iam/infrastructure/iam.interceptor.js';

const platformApi = import.meta.env.VITE_VITALTREK_API_URL || '/api/v1';

export class BaseApi {
    #http;

    constructor() {
        this.#http = axios.create({
            baseURL: platformApi,
            timeout: 10000,
            headers: {
                'Content-Type': 'application/json',
            },
        });
        this.#http.interceptors.request.use(iamInterceptor);
    }

    get http() {
        return this.#http;
    }
}
