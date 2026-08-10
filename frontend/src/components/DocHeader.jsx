import logo from "../assets/logo-aguas-nacionales.png";
import NotificationBell from "./NotificationBell";

export default function DocHeader({ title, showCode = true }) {
  return (
    <header className="doc-header">
      <div className="doc-header__inner">
        <img src={logo} alt="Aguas Nacionales EPM" className="doc-header__logo" />
        <div className="doc-header__titles">
          <h1 className="doc-header__title">{title}</h1>
        </div>
        <NotificationBell />
        {showCode && (
          <div className="doc-header__code">
            Código: <strong>GTH-FOR-03</strong>
            <br />
            Versión: <strong>02</strong>
            <br />
            Fecha: <strong>03/08/2023</strong>
          </div>
        )}
      </div>
    </header>
  );
}
