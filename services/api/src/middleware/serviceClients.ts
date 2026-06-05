import axios, {AxiosInstance} from 'axios';

const createClient = (baseURL: string): AxiosInstance => {
    const client = axios.create({
        baseURL,
        timeout: 10000,
        headers: {'Content-Type': 'application/json'},
    });

    client.interceptors.response.use(
        (res) => res,
        (err) => {
            const msg = err.response?.data?.error || err.message || 'Service error';
            throw new Error(msg);
        }
    );

    return client;
}

export const userClient = createClient(
    process.env.USER_SERVICE_URL || 'http://localhost:4001'
);

export const productClient = createClient(
    process.env.PRODUCT_SERVICE_URL || 'http://localhost:4002'
);

export const orderClient = createClient(
    process.env.ORDER_SERVICE_URL || 'http://localhost:4003'
);
