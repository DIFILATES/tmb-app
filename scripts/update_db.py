#!/usr/bin/env python3
"""
TMB Objectes Perduts - Gestor de Base de Dades
Actualitza data/db.json amb operacions CRUD.
S'executa des de GitHub Actions o localment.
"""
import json
import os
import sys
from datetime import datetime

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(SCRIPT_DIR, '..', 'data', 'db.json')


def load_db():
    with open(DB_PATH, 'r', encoding='utf-8') as f:
        return json.load(f)


def save_db(db):
    db['meta']['lastUpdated'] = datetime.now().astimezone().isoformat()
    with open(DB_PATH, 'w', encoding='utf-8') as f:
        json.dump(db, f, ensure_ascii=False, indent=2)
    print(f"💾 Base de dades actualitzada: {db['meta']['lastUpdated']}")


def next_id(items, prefix):
    if not items:
        return f"{prefix}001"
    nums = []
    for item in items:
        try:
            nums.append(int(item['id'][len(prefix):]))
        except (ValueError, KeyError):
            pass
    return f"{prefix}{(max(nums) + 1 if nums else 1):03d}"


def add_item(db, tipus, que, categoria='altres', linia='', estacio='',
             data='', hora='', descripcio='', contacte='', nom='Anònim'):
    collection = 'trobats' if tipus == 'trobat' else 'perduts'
    prefix = 'T' if tipus == 'trobat' else 'P'
    new_id = next_id(db[collection], prefix)

    if not data:
        data = datetime.now().strftime('%Y-%m-%d')

    item = {
        'id': new_id,
        'que': que,
        'categoria': categoria,
        'linia': linia,
        'estacio': estacio,
        'data': data,
        'hora': hora,
        'descripcio': descripcio,
        'contacte': contacte,
        'nom': nom,
        'status': 'disponible' if tipus == 'trobat' else 'actiu',
        'createdAt': datetime.now().astimezone().isoformat()
    }

    db[collection].insert(0, item)
    save_db(db)
    print(f"✅ Objecte {tipus} afegit → ID: {new_id}")
    print(f"   📦 {que}")
    return new_id


def delete_item(db, item_id):
    for collection in ['trobats', 'perduts']:
        for i, item in enumerate(db[collection]):
            if item['id'] == item_id:
                removed = db[collection].pop(i)
                save_db(db)
                print(f"🗑️  Objecte esborrat: {item_id} ({removed['que']})")
                return True
    print(f"❌ Objecte {item_id} no trobat a la base de dades")
    return False


def create_match(db, trobat_id, perdut_id, notes=''):
    # Verify both items exist
    trobat = next((t for t in db['trobats'] if t['id'] == trobat_id), None)
    perdut = next((p for p in db['perduts'] if p['id'] == perdut_id), None)

    if not trobat:
        print(f"❌ Objecte trobat {trobat_id} no existeix"); return None
    if not perdut:
        print(f"❌ Objecte perdut {perdut_id} no existeix"); return None

    new_id = next_id(db['matches'], 'M')
    match = {
        'id': new_id,
        'trobatId': trobat_id,
        'perdutId': perdut_id,
        'status': 'pendent',
        'createdAt': datetime.now().astimezone().isoformat(),
        'notes': notes
    }
    db['matches'].insert(0, match)
    save_db(db)
    print(f"🤝 Match creat → {new_id}")
    print(f"   📦 Trobat: {trobat['que']}")
    print(f"   🔎 Perdut: {perdut['que']}")
    return new_id


def update_match(db, match_id, new_status, notes=''):
    for match in db['matches']:
        if match['id'] == match_id:
            old = match['status']
            match['status'] = new_status
            if notes:
                match['notes'] = notes
            if new_status == 'tancat':
                match['closedAt'] = datetime.now().astimezone().isoformat()
                # Update linked items
                for t in db['trobats']:
                    if t['id'] == match['trobatId']:
                        t['status'] = 'retornat'
                for p in db['perduts']:
                    if p['id'] == match['perdutId']:
                        p['status'] = 'resolt'
            save_db(db)
            print(f"✅ Match {match_id}: {old} → {new_status}")
            return True
    print(f"❌ Match {match_id} no trobat")
    return False


def list_items(db, collection=None):
    if collection:
        collections = [collection]
    else:
        collections = ['trobats', 'perduts', 'matches']

    for col in collections:
        items = db.get(col, [])
        print(f"\n{'='*50}")
        print(f" {col.upper()} ({len(items)} elements)")
        print(f"{'='*50}")
        for item in items:
            if col == 'matches':
                trobat = next((t for t in db['trobats'] if t['id'] == item['trobatId']), {})
                perdut = next((p for p in db['perduts'] if p['id'] == item['perdutId']), {})
                status_icon = {'pendent': '⏳', 'confirmat': '✅', 'tancat': '🔒'}.get(item['status'], '❓')
                print(f"  {status_icon} {item['id']}: {trobat.get('que','?')} ↔ {perdut.get('que','?')} [{item['status']}]")
            else:
                icon = '📦' if col == 'trobats' else '🔎'
                print(f"  {icon} {item['id']}: {item['que']} | {item.get('linia','')} {item.get('estacio','')} | {item['data']} [{item['status']}]")


# ============================================
# MAIN - reads from environment variables
# ============================================
if __name__ == '__main__':
    db = load_db()

    action = os.environ.get('ACTION', '').strip()

    if action == 'afegir':
        tipus = os.environ.get('TIPUS', 'trobat').strip()
        add_item(
            db, tipus,
            que=os.environ.get('QUE', '').strip(),
            categoria=os.environ.get('CATEGORIA', 'altres').strip(),
            linia=os.environ.get('LINIA', '').strip(),
            estacio=os.environ.get('ESTACIO', '').strip(),
            data=os.environ.get('DATA_OBJECTE', '').strip(),
            hora=os.environ.get('HORA', '').strip(),
            descripcio=os.environ.get('DESCRIPCIO', '').strip(),
            contacte=os.environ.get('CONTACTE', '').strip(),
            nom=os.environ.get('NOM', 'Anònim').strip()
        )

    elif action == 'esborrar':
        item_id = os.environ.get('ID', '').strip()
        if not item_id:
            print("❌ Cal especificar ID"); sys.exit(1)
        delete_item(db, item_id)

    elif action == 'crear-match':
        trobat_id = os.environ.get('ID', '').strip()
        perdut_id = os.environ.get('ID2', '').strip()
        notes = os.environ.get('NOTES', '').strip()
        if not trobat_id or not perdut_id:
            print("❌ Cal especificar ID (trobat) i ID2 (perdut)"); sys.exit(1)
        create_match(db, trobat_id, perdut_id, notes)

    elif action == 'confirmar-match':
        match_id = os.environ.get('ID', '').strip()
        notes = os.environ.get('NOTES', '').strip()
        if not match_id:
            print("❌ Cal especificar ID del match"); sys.exit(1)
        update_match(db, match_id, 'confirmat', notes)

    elif action == 'tancar-match':
        match_id = os.environ.get('ID', '').strip()
        notes = os.environ.get('NOTES', '').strip()
        if not match_id:
            print("❌ Cal especificar ID del match"); sys.exit(1)
        update_match(db, match_id, 'tancat', notes)

    elif action == 'llistar':
        col = os.environ.get('COLLECTION', '').strip() or None
        list_items(db, col)

    else:
        print("❌ Acció no reconeguda. Accions vàlides: afegir, esborrar, crear-match, confirmar-match, tancar-match, llistar")
        sys.exit(1)
