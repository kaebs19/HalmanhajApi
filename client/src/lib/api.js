import axios from 'axios';

export const API_BASE = process.env.REACT_APP_API_URL || '/api';
export const SERVER_URL = process.env.REACT_APP_SERVER_URL || '';

export const getHeaders = () => ({
  headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
});

const api = axios.create({
  baseURL: API_BASE,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
