import sqlite3
from pathlib import Path

import pandas as pd


def sauvegarde(dossier, tables):
    dossier = Path(dossier)
    dossier.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(dossier / "festival.db")
    for nom, df in tables.items():
        df.to_csv(dossier / (nom + ".csv"), index=False)
        df.to_sql(nom, conn, if_exists="replace", index=False)
    conn.close()


def charge(dossier, nom):
    conn = sqlite3.connect(Path(dossier) / "festival.db")
    df = pd.read_sql(f"SELECT * FROM {nom}", conn)
    conn.close()
    return df


def liste_tables(dossier):
    conn = sqlite3.connect(Path(dossier) / "festival.db")
    tables = pd.read_sql("SELECT name FROM sqlite_master WHERE type='table'", conn)
    conn.close()
    return list(tables["name"])
