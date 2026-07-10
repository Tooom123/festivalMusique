import pandas as pd

BOISSONS = [
    ("Eau", 2.0), ("Soda", 3.0), ("Bière", 4.0), ("Bière pression", 5.0),
    ("Vin rosé", 5.0), ("Vin blanc", 5.0), ("Cocktail sans alcool", 4.0),
]

NOURRITURE = [
    ("Burger", 9.0), ("Hot-dog", 6.0), ("Pizza (part)", 5.0),
    ("Frites", 4.0), ("Popcorn", 3.0), ("Panini", 6.0),
]

MENUS = {
    "stand_boisson": BOISSONS,
    "stand_nourriture": NOURRITURE,
    "stand_mixte": [("Bière", 4.0), ("Soda", 3.0), ("Eau", 2.0),
                    ("Burger", 9.0), ("Frites", 4.0), ("Hot-dog", 6.0)],
}


def carte_menu(type_poi):
    lignes = MENUS.get(type_poi, [])
    return pd.DataFrame(lignes, columns=["Produit", "Prix (EUR)"])
