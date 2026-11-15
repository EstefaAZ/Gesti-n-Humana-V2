// URLs de los 3 backends en desarrollo local (`ng serve` / `npm start`).
// Son los mismos puertos que tenía el .env.local del frontend React.
export const environment = {
  production: false,
  loginApiUrl: 'http://localhost:9000',
  vacantesApiUrl: 'http://localhost:9001',
  candidatosApiUrl: 'http://localhost:9002',
};
