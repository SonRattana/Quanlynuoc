import axios from "axios";

const api = axios.create({
  // baseURL: "https://quanlynuoc-production.up.railway.app/",
  baseURL: "http://192.168.1.129:3000/",
  // baseURL: "http://localhost:3000/"
});

// ===== Request interceptor =====
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});


// ===== Response interceptor =====
api.interceptors.response.use(
  (response) => response,
  (error) => {

    if (error.response && (error.response.status === 401 || error.response.status === 403)) {

      // xoá token
      localStorage.removeItem("token");

      // redirect login
      window.location.href = "/login";

    }

    return Promise.reject(error);
  }
);

export default api;