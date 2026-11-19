// URLs base de cada microservicio (equivalente a las variables VITE_* del
// frontend React). Este archivo se usa en `ng build` (producción): antes de
// desplegar, cámbialas por las URLs reales de cada backend (no `localhost`).
export const environment = {
  production: true,
  loginApiUrl: 'http://localhost:9000',
  vacantesApiUrl: 'http://localhost:9001',
  candidatosApiUrl: 'http://localhost:9002',
};
