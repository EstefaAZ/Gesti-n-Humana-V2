import Field from "../Field";
import SelectConOtro from "../SelectConOtro";
import { MUNICIPIOS_POR_DEPARTAMENTO, DEPARTAMENTOS } from "../../data/municipiosPorDepartamento";

export default function HojaI({ datos, setDatos, errors }) {
  const set = (key) => (e) => setDatos({ [key]: e.target.value });

  return (
    <section>
      <h2 className="section-title">I. Datos Personales y Familiares</h2>
      <p className="section-intro">Diligencie su información básica de contacto e identificación.</p>

      <div className="field-grid">
        <Field label="Proceso de selección No.">
          <input type="text" value={datos.proceso} onChange={set("proceso")} disabled={datos.urlLocked} />
        </Field>
        <Field label="Fecha de entrega">
          <input type="date" value={datos.fechaEntrega} onChange={set("fechaEntrega")} disabled={datos.urlLocked} />
        </Field>

        <Field label="Nombre completo *" span2 error={errors.nombreCompleto}>
          <input type="text" value={datos.nombreCompleto} onChange={set("nombreCompleto")} />
        </Field>

        <Field label="Cédula No. *" error={errors.cedula}>
          <input type="text" value={datos.cedula} onChange={set("cedula")} />
        </Field>
        <Field label="De (lugar de expedición) *" error={errors.cedulaDe}>
          <input type="text" value={datos.cedulaDe} onChange={set("cedulaDe")} />
        </Field>

        <Field label="Departamento de nacimiento *" error={errors.deptoNacimiento}>
          <SelectConOtro
            value={datos.deptoNacimiento}
            opciones={DEPARTAMENTOS}
            onChange={(v) => setDatos({ deptoNacimiento: v, ciudadNacimiento: "" })}
          />
        </Field>
        <Field label="Ciudad de nacimiento *" error={errors.ciudadNacimiento}>
          <SelectConOtro
            key={datos.deptoNacimiento}
            value={datos.ciudadNacimiento}
            opciones={MUNICIPIOS_POR_DEPARTAMENTO[datos.deptoNacimiento] || []}
            onChange={(v) => setDatos({ ciudadNacimiento: v })}
            placeholder={datos.deptoNacimiento ? "Seleccione…" : "Elige primero el departamento"}
          />
        </Field>
        <Field label="País de nacimiento *" error={errors.paisNacimiento}>
          <input type="text" value={datos.paisNacimiento} onChange={set("paisNacimiento")} />
        </Field>
        <Field label="Fecha de nacimiento *" error={errors.fechaNacimiento}>
          <input type="date" value={datos.fechaNacimiento} onChange={set("fechaNacimiento")} />
        </Field>

        <Field label="¿Tiene licencia de conducción?">
          <div className="radio-row">
            <label className="radio-option">
              <input type="radio" name="licencia" checked={datos.licencia === "si"} onChange={() => setDatos({ licencia: "si" })} /> Sí
            </label>
            <label className="radio-option">
              <input type="radio" name="licencia" checked={datos.licencia === "no"} onChange={() => setDatos({ licencia: "no", licenciaClase: "" })} /> No
            </label>
          </div>
        </Field>
        <Field label="Clase">
          <input type="text" value={datos.licenciaClase} onChange={set("licenciaClase")} disabled={datos.licencia !== "si"} />
        </Field>

        <Field label="Correo electrónico *" span2 error={errors.correo}>
          <input type="email" value={datos.correo} onChange={set("correo")} />
        </Field>

        <Field label="Dirección de residencia *" span2 error={errors.direccion}>
          <input type="text" value={datos.direccion} onChange={set("direccion")} />
        </Field>
        <Field label="Departamento *" error={errors.deptoResidencia}>
          <SelectConOtro
            value={datos.deptoResidencia}
            opciones={DEPARTAMENTOS}
            onChange={(v) => setDatos({ deptoResidencia: v, municipio: "" })}
          />
        </Field>
        <Field label="Municipio *" error={errors.municipio}>
          <SelectConOtro
            key={datos.deptoResidencia}
            value={datos.municipio}
            opciones={MUNICIPIOS_POR_DEPARTAMENTO[datos.deptoResidencia] || []}
            onChange={(v) => setDatos({ municipio: v })}
            placeholder={datos.deptoResidencia ? "Seleccione…" : "Elige primero el departamento"}
          />
        </Field>

        <Field label="Teléfono residencia">
          <input type="tel" value={datos.telResidencia} onChange={set("telResidencia")} />
        </Field>
        <Field label="Celular *" error={errors.celular}>
          <input type="tel" value={datos.celular} onChange={set("celular")} />
        </Field>

        <Field label="Estado civil *" error={errors.estadoCivil}>
          <select value={datos.estadoCivil} onChange={set("estadoCivil")}>
            <option value="">Seleccione…</option>
            <option>Soltero(a)</option>
            <option>Casado(a)</option>
            <option>Unión libre</option>
            <option>Separado(a)</option>
            <option>Divorciado(a)</option>
            <option>Viudo(a)</option>
          </select>
        </Field>
        <Field label="N° de hijos *" error={errors.numHijos}>
          <input type="number" min="0" value={datos.numHijos} onChange={set("numHijos")} />
        </Field>
        <Field label="¿Tiene vehículo?">
          <div className="radio-row">
            <label className="radio-option">
              <input type="radio" name="tieneVehiculo" checked={datos.tieneVehiculo === "si"} onChange={() => setDatos({ tieneVehiculo: "si" })} /> Sí
            </label>
            <label className="radio-option">
              <input type="radio" name="tieneVehiculo" checked={datos.tieneVehiculo === "no"} onChange={() => setDatos({ tieneVehiculo: "no" })} /> No
            </label>
          </div>
        </Field>

        <Field label="Tarjeta o matrícula profesional N°">
          <input type="text" value={datos.tarjetaProfesional} onChange={set("tarjetaProfesional")} />
        </Field>
        <Field label="Profesión">
          <input type="text" value={datos.profesion} onChange={set("profesion")} />
        </Field>
        <Field label="Fecha de expedición">
          <input type="date" value={datos.fechaTarjeta} onChange={set("fechaTarjeta")} />
        </Field>
      </div>
    </section>
  );
}
