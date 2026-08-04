// URLs base de cada microservicio. En desarrollo apuntan a los puertos por
// defecto usados durante las pruebas (8000/8001/8002); en producción se
// sobreescriben con variables de entorno VITE_* al momento de compilar.
export const API_URLS = {
  login: import.meta.env.VITE_LOGIN_API_URL || "http://localhost:8000",
  vacantes: import.meta.env.VITE_VACANTES_API_URL || "http://localhost:8001",
  candidatos: import.meta.env.VITE_CANDIDATOS_API_URL || "http://localhost:8002",
};
