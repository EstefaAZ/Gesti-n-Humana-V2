import { environment } from '../../../environments/environment';

// URLs base de cada microservicio. Se configuran en src/environments/
// (equivalente a las variables VITE_* del frontend React).
export const API_URLS = {
  login: environment.loginApiUrl || 'http://localhost:8000',
  vacantes: environment.vacantesApiUrl || 'http://localhost:8001',
  candidatos: environment.candidatosApiUrl || 'http://localhost:8002',
};
