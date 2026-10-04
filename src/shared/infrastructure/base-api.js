import axios from 'axios';

const platformApi = import.meta.env.VITE_VITALTREK_API_URL;

export class BaseApi {
    #http;

    constructor() {
        this.#http = axios.create({
            baseURL: platformApi,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }

    get http() {
        return this.#http;
    }
}