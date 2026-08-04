// El backend genera el id al crear la vacante, así que un borrador nuevo no lo trae.
export function vacanteVacia() {
  return {
    procesoNo: "",
    cargo: "",
    area: "",
    salario: "",
    tipoVinculacion: "",
    sede: "",
    plazas: 1,
    fechaApertura: "",
    fechaCierre: "",
    horaCierre: "16:00",
    publicoObjetivo: "Externo",
    conocimientosComplementarios: "",
    requisitosObligatorios: "",
    estado: "publicada",
    criterios: {
      nivelEducativoMin: "",
      graduadoRequerido: true,
      profesionKeyword: "",
      experienciaMinAnios: "",
      idiomaRequerido: "",
      idiomaHabilidad: "habla",
      idiomaNivelMin: "Regular",
      certificacionesKeywords: [],
    },
  };
}
