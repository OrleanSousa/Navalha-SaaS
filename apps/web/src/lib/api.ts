import axios from 'axios';
const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3333/api';
let accessToken: string | null = null;
export const setAccessToken = (token: string | null) => {
  accessToken = token;
};
export const api = axios.create({ baseURL, withCredentials: true });
api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (
      error.response?.status === 401 &&
      !original?._retried &&
      !String(original?.url).includes('/auth/')
    ) {
      original._retried = true;
      try {
        const { data } = await axios.post(`${baseURL}/auth/refresh`, {}, { withCredentials: true });
        setAccessToken(data.accessToken);
        original.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(original);
      } catch {
        setAccessToken(null);
        window.dispatchEvent(new Event('session-expired'));
      }
    }
    return Promise.reject(error);
  },
);
export const money = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
export const assetUrl = (path?: string | null) => {
  if (!path || /^https?:\/\//i.test(path)) return path || '';
  return `${baseURL.replace(/\/api\/?$/, '')}/${path.replace(/^\//, '')}`;
};
