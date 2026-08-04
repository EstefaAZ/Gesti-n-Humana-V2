#!/usr/bin/env python3
# ==============================================================
# modulo_login / scripts/crear_admin.py
#
# Crea el primer usuario admin. Se corre UNA sola vez, a mano, desde
# la terminal del servidor — nunca se expone como endpoint HTTP,
# precisamente para que no sea un camino de ataque.
#
# Uso:
#   python3 scripts/crear_admin.py
#   (o sin prompts:)
#   python3 scripts/crear_admin.py --nombre "Ana Ruiz" --email ana@aguasnacionales.com --password "ClaveSegura123"
# ==============================================================

import argparse
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.database import Base, engine, SessionLocal
from app.models.usuario import Usuario, RolUsuario
from app.core.security import hash_password
from app.schemas.usuario import _validar_politica_password


def main():
    parser = argparse.ArgumentParser(description="Crear el primer usuario admin.")
    parser.add_argument("--nombre", help="Nombre completo")
    parser.add_argument("--email", help="Correo electrónico")
    parser.add_argument("--password", help="Contraseña (mín. 8 caracteres, mayúscula, minúscula, número y carácter especial)")
    args = parser.parse_args()

    nombre = args.nombre or input("Nombre completo: ").strip()
    email = args.email or input("Correo electrónico: ").strip()
    password = args.password or input("Contraseña: ").strip()

    if len(password) < 8:
        print("La contraseña debe tener mínimo 8 caracteres.")
        sys.exit(1)
    try:
        _validar_politica_password(password)
    except ValueError as e:
        print(str(e))
        sys.exit(1)

    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if db.query(Usuario).filter(Usuario.email == email).first():
            print(f"Ya existe un usuario con el correo {email}.")
            sys.exit(1)

        admin = Usuario(
            nombre_completo=nombre,
            email=email,
            password_hash=hash_password(password),
            rol=RolUsuario.admin,
        )
        db.add(admin)
        db.commit()
        print(f"Admin creado: {email}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
