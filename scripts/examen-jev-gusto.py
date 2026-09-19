# EL ANÁLISIS DE LA TERCERA PRUEBA DE JEV (la mitad gratis y repetible).
#
# Uso:  python3 scripts/examen-jev-gusto.py /ruta/gusto.json
#
# El porqué, el diseño y LA REGLA PRE-REGISTRADA viven en el encabezado de
# scripts/examen-jev-gusto.ts, que es quien paga la corrida y vuelca el JSON.
# Se repite aquí sólo la regla, porque este archivo es el que la aplica:
#
#   1. La idea está viva sólo si el mejor brazo llega a AUC >= 0.65.
#   2. Jev pasa sólo si A3 (contexto+código+Jev) supera a A1 (contexto+código)
#      por >= 0.03 de AUC y la diferencia pareada es > 2 desviaciones estándar.
#   3. Empatar no es pasar: a igualdad gana el código.
#
# POR QUÉ NUMPY A MANO Y NO UNA LIBRERÍA: no hay sklearn en esta máquina, y una
# regresión logística con L2 son veinte líneas. Instalar una dependencia para un
# experimento que puede morir hoy es más deuda que escribirla.
#
# LAMBDA FIJA (1.0) PARA TODOS LOS BRAZOS, a propósito: afinar la regularización
# por brazo es otra forma de elegir el resultado después de verlo.
import json
import re
import sys
import colorsys
import numpy as np

LAMBDA = 1.0
PLIEGUES = 7
REPETICIONES = 30
PISO_AUC = 0.65
VENTAJA_MINIMA = 0.03


def hex_a_hsv_lum(h):
    h = (h or "").lstrip("#")
    if len(h) != 6:
        return None
    try:
        r, g, b = (int(h[i : i + 2], 16) / 255 for i in (0, 2, 4))
    except ValueError:
        return None
    hue, sat, val = colorsys.rgb_to_hsv(r, g, b)
    lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
    return hue, sat, val, lum


# Tipos de prenda por nombre. Sin límites de palabra a propósito (la trampa del
# backspace en regex ya mordió dos veces en este repo): son subcadenas simples.
TIPOS = {
    "saco": r"saco|blazer|traje",
    "pantalon_vestir": r"pantal[oó]n de (vestir|traje)",
    "tenis": r"tenis|sneaker",
    "bota": r"bota|bot[ií]n",
    "mocasin": r"mocas[ií]n|loafer",
    "zapato_vestir": r"oxford negro|derby|zapato",
    "jeans": r"jeans|mezclilla",
    "chinos": r"chino",
    "sueter": r"su[eé]ter|cuello alto|tortuga|cardigan",
    "camisa": r"camisa",
    "playera": r"camiseta|playera|polo",
    "corbata": r"corbata|mo[ñn]o",
    "abrigo": r"abrigo|parka|puffer|gabardina|trench|acolchad",
    "chamarra": r"chamarra|chaqueta|bomber|cazadora|overshirt",
    "accesorio": r"reloj|bufanda|gorra|lentes|cintur[oó]n|sombrero",
}


def rasgos_por_codigo(prendas):
    nombres = [p["nombre"].lower() for p in prendas]
    f = {f"tiene_{k}": float(any(re.search(rx, n) for n in nombres)) for k, rx in TIPOS.items()}
    f["n_prendas"] = float(len(prendas))

    # Formalidad: la proporción de prendas en cada registro declarado.
    formal = [str(p["attrs"].get("formalidad") or "").lower() for p in prendas]
    for nivel in ("casual", "smart", "formal"):
        f[f"formalidad_{nivel}"] = sum(nivel in x for x in formal) / max(len(formal), 1)

    # Color: aritmética sobre el hex MEDIDO de cada prenda, que es justo lo que
    # Jev no tiene (él lee "azul oscuro"; aquí está el tono real).
    hsv = [x for x in (hex_a_hsv_lum(p["attrs"].get("color_hex")) for p in prendas) if x]
    if hsv:
        lums = [x[3] for x in hsv]
        sats = [x[1] for x in hsv]
        f["lum_media"] = float(np.mean(lums))
        f["lum_rango"] = float(max(lums) - min(lums))
        f["sat_max"] = float(max(sats))
        f["sat_media"] = float(np.mean(sats))
        f["prop_neutros"] = float(np.mean([s < 0.25 for s in sats]))
        f["prop_oscuros"] = float(np.mean([l < 0.25 for l in lums]))
    else:
        for k in ("lum_media", "lum_rango", "sat_max", "sat_media", "prop_neutros", "prop_oscuros"):
            f[k] = 0.0

    cortes = [str(p["attrs"].get("corte") or "").lower() for p in prendas]
    f["prop_holgado"] = float(np.mean([bool(re.search(r"holgad|oversize|relajad|ancho", c)) for c in cortes]))
    f["prop_entallado"] = float(np.mean([bool(re.search(r"slim|entallad|ajustad", c)) for c in cortes]))
    return f


def contexto(brief, vocab):
    f = {}
    for campo in ("objective", "formality", "momento"):
        for v in vocab[campo]:
            f[f"{campo}={v}"] = float((brief.get(campo) or "") == v)
    t = brief.get("temp_c")
    f["temp_c"] = float(t) if t is not None else np.nan
    f["lluvia"] = float(bool(re.search(r"lluvi|rain|llovizn|tormenta", str(brief.get("condition") or "").lower())))
    return f


def matriz(filas):
    claves = sorted({k for f in filas for k in f})
    X = np.array([[f.get(k, 0.0) for k in claves] for f in filas], dtype=float)
    # temp_c faltante -> media de la columna (se reestandariza por pliegue después).
    for j in range(X.shape[1]):
        col = X[:, j]
        if np.isnan(col).any():
            col[np.isnan(col)] = np.nanmean(col) if not np.isnan(col).all() else 0.0
    return X, claves


def ajustar(X, y, lam=LAMBDA, iteraciones=40):
    # Logística con L2 por Newton. El intercepto (columna 0) no se regulariza.
    Xb = np.hstack([np.ones((X.shape[0], 1)), X])
    w = np.zeros(Xb.shape[1])
    R = np.eye(Xb.shape[1]) * lam
    R[0, 0] = 0.0
    for _ in range(iteraciones):
        p = 1 / (1 + np.exp(-np.clip(Xb @ w, -30, 30)))
        g = Xb.T @ (p - y) + R @ w
        H = (Xb * (p * (1 - p))[:, None]).T @ Xb + R + np.eye(Xb.shape[1]) * 1e-8
        paso = np.linalg.solve(H, g)
        w -= paso
        if np.abs(paso).max() < 1e-7:
            break
    return w


def predecir(w, X):
    return np.hstack([np.ones((X.shape[0], 1)), X]) @ w


def auc(y, s):
    # Mann-Whitney con rangos promedio en empates.
    orden = np.argsort(s, kind="mergesort")
    rangos = np.empty(len(s))
    i = 0
    ss = s[orden]
    while i < len(ss):
        j = i
        while j + 1 < len(ss) and ss[j + 1] == ss[i]:
            j += 1
        rangos[orden[i : j + 1]] = (i + j) / 2 + 1
        i = j + 1
    pos = y == 1
    n1, n0 = pos.sum(), (~pos).sum()
    return (rangos[pos].sum() - n1 * (n1 + 1) / 2) / (n1 * n0)


def auc_por_rondas(X, y, rondas, rng):
    # Rondas ENTERAS fuera: los pares espejo repiten looks dentro de una ronda,
    # y con pliegues al azar el modelo "predeciría" un look que ya vio.
    unicas = np.array(sorted(set(rondas)))
    rng.shuffle(unicas)
    pliegue_de = {r: i % PLIEGUES for i, r in enumerate(unicas)}
    pliegues = np.array([pliegue_de[r] for r in rondas])
    fuera = np.zeros(len(y))
    for k in range(PLIEGUES):
        tr, te = pliegues != k, pliegues == k
        mu, sd = X[tr].mean(0), X[tr].std(0)
        sd[sd == 0] = 1.0
        w = ajustar((X[tr] - mu) / sd, y[tr])
        fuera[te] = predecir(w, (X[te] - mu) / sd)
    return auc(y, fuera)


def main():
    datos = json.load(open(sys.argv[1]))
    y = np.array([1.0 if d["marca"] == "arriba" else 0.0 for d in datos])
    rondas = [d["ronda"] for d in datos]
    print(f"GUSTO · {len(datos)} looks · {int(y.sum())} 👍 / {int((1 - y).sum())} 👎 · {len(set(rondas))} rondas")

    vocab = {c: sorted({(d["brief"].get(c) or "") for d in datos} - {""}) for c in ("objective", "formality", "momento")}
    f_ctx = [contexto(d["brief"], vocab) for d in datos]
    f_cod = [rasgos_por_codigo(d["prendas"]) for d in datos]
    f_jev = [{f"jev_{k}": v for k, v in d["jev"].items()} for d in datos]

    une = lambda *gs: [{k: v for g in fila for k, v in g.items()} for fila in zip(*gs)]
    brazos = {
        "A0 contexto solo": f_ctx,
        "A1 contexto + código": une(f_ctx, f_cod),
        "A2 contexto + Jev": une(f_ctx, f_jev),
        "A3 contexto + código + Jev": une(f_ctx, f_cod, f_jev),
    }
    matrices = {n: matriz(f) for n, f in brazos.items()}

    # Los MISMOS repartos para los cuatro brazos: la comparación es pareada.
    resultados = {n: [] for n in brazos}
    for rep in range(REPETICIONES):
        for n, (X, _) in matrices.items():
            resultados[n].append(auc_por_rondas(X, y, rondas, np.random.default_rng(1000 + rep)))

    print(f"\nAUC fuera de muestra · {PLIEGUES} pliegues por RONDA · {REPETICIONES} repartos (0.50 = azar)")
    for n, v in resultados.items():
        print(f"  {n:30} {np.mean(v):.3f} ± {np.std(v):.3f}   ({matrices[n][0].shape[1]} rasgos)")

    a1, a2, a3 = (np.array(resultados[k]) for k in ("A1 contexto + código", "A2 contexto + Jev", "A3 contexto + código + Jev"))
    for etq, d in (("A3 − A1 (¿Jev AÑADE sobre el código?)", a3 - a1), ("A2 − A1 (¿Jev solo contra código solo?)", a2 - a1)):
        print(f"\n  {etq}: {d.mean():+.3f} ± {d.std():.3f}")

    mejor = max(np.mean(v) for v in resultados.values())
    d = a3 - a1
    print("\nVEREDICTO SEGÚN LA REGLA PRE-REGISTRADA")
    if mejor < PISO_AUC:
        print(f"  ✗ Ningún brazo llega a {PISO_AUC}: con estos rasgos NADIE predice su voto. La idea no está viva con estos datos.")
    elif d.mean() >= VENTAJA_MINIMA and d.mean() > 2 * d.std():
        print(f"  ✓ Jev PASA: añade {d.mean():+.3f} de AUC sobre el código, fuera del ruido.")
    else:
        print(f"  ✗ Jev NO pasa: sobre el código añade {d.mean():+.3f} (se pedía ≥ {VENTAJA_MINIMA} y > 2σ = {2 * d.std():.3f}).")
        print("    A igualdad gana el código: gratis, 0 ms, sin proveedor nuevo.")

    # Sólo para LEER, no para decidir: qué rasgos empujan el voto, con el modelo
    # ajustado sobre todo. Un coeficiente aquí no es evidencia — la evidencia es
    # el AUC de arriba.
    for n in ("A1 contexto + código", "A2 contexto + Jev"):
        X, claves = matrices[n]
        mu, sd = X.mean(0), X.std(0)
        sd[sd == 0] = 1.0
        w = ajustar((X - mu) / sd, y)[1:]
        orden = np.argsort(-np.abs(w))[:8]
        print(f"\n  lo que más pesa en {n} (+ = hacia 👍):")
        for j in orden:
            print(f"    {claves[j]:28} {w[j]:+.2f}")


main()


# ── AÑADIDOS DEL 2026-09-18, tras la crítica de un revisor externo ────────────
#
# Los tres son GRATIS (no vuelven a llamar a nadie) y dos de ellos contestan
# preguntas más grandes que la de Jev.


def pr_auc(y_pos, s):
    """Precisión media con los 👎 COMO POSITIVOS.

    Por qué hace falta además del ROC: el universo es 81% 👍, y en un problema
    tan desbalanceado el ROC-AUC se ve bien mientras el modelo sigue siendo
    inútil para lo único que importa — encontrar los looks que NO le gustan.
    El piso aquí no es 0.50: es la proporción de 👎 (~0.19).
    """
    orden = np.argsort(-s, kind="mergesort")
    yy = y_pos[orden]
    tp = np.cumsum(yy)
    prec = tp / np.arange(1, len(yy) + 1)
    return float((prec * yy).sum() / max(yy.sum(), 1))


def consistencia_del_usuario(datos):
    """EL TECHO DEL PROBLEMA: ¿cuánto se contradice Roberto a sí mismo?

    Idea del revisor externo, y es la más barata del día. Los pares espejo
    repiten el MISMO look (mismas prendas, mismo pedido) pidiendo voto dos
    veces. Si en esos duplicados él vota distinto, ese desacuerdo es ruido de la
    etiqueta y ningún modelo puede pasar de ahí. Perseguir 2 puntos de AUC por
    debajo de ese techo es perseguir ruido.
    """
    grupos = {}
    for d in datos:
        firma = (
            tuple(sorted(p["nombre"] for p in d["prendas"])),
            d["brief"].get("objective"),
            d["brief"].get("formality"),
            d["brief"].get("temp_c"),
        )
        grupos.setdefault(firma, []).append(d["marca"])
    repetidos = [v for v in grupos.values() if len(v) > 1]
    discordes = [v for v in repetidos if len(set(v)) > 1]
    print(f"\nCONSISTENCIA DE SUS PROPIOS VOTOS (el techo del problema)")
    print(f"  looks únicos: {len(grupos)} · vistos más de una vez: {len(repetidos)}")
    if repetidos:
        pct = 100 * len(discordes) / len(repetidos)
        print(f"  votó DISTINTO el mismo look en {len(discordes)}/{len(repetidos)} ({pct:.0f}%)")
        print(f"  → techo aproximado de acierto alcanzable: {100 - pct / 2:.0f}%")
    else:
        print("  no hay looks repetidos: no se puede estimar el ruido de la etiqueta")


def curva_de_aprendizaje(X, y, rondas):
    """¿CUÁNTOS VOTOS HACEN FALTA PARA CONOCER A ALGUIEN?

    La pregunta de PRODUCTO, no de modelo, y también es idea del revisor. Da
    igual que con 460 votos se prediga bien: una usuaria normal da ocho. Esto
    entrena con 20, 40, 80… y mide siempre contra el MISMO holdout de rondas
    apartadas, para que la respuesta no dependa de qué votos tocaron.
    """
    unicas = sorted(set(rondas))
    rng = np.random.default_rng(7)
    print(f"\nCURVA DE APRENDIZAJE · rasgos por código · holdout fijo de rondas apartadas")
    print(f"  {'votos':>6}  {'ROC-AUC':>8}  {'PR-AUC(👎)':>11}")
    for n_votos in (20, 40, 80, 150, 300):
        rocs, prs = [], []
        for rep in range(20):
            r = np.array(unicas)
            rng2 = np.random.default_rng(100 + rep)
            rng2.shuffle(r)
            corte = max(2, len(r) // 3)
            test_r, train_r = set(r[:corte]), set(r[corte:])
            te = np.array([x in test_r for x in rondas])
            tr_todos = np.where(np.array([x in train_r for x in rondas]))[0]
            if len(tr_todos) < n_votos or te.sum() < 10:
                continue
            tr = rng2.choice(tr_todos, n_votos, replace=False)
            if len(set(y[tr])) < 2 or len(set(y[te])) < 2:
                continue
            mu, sd = X[tr].mean(0), X[tr].std(0)
            sd[sd == 0] = 1.0
            w = ajustar((X[tr] - mu) / sd, y[tr])
            s = predecir(w, (X[te] - mu) / sd)
            rocs.append(auc(y[te], s))
            prs.append(pr_auc(1 - y[te], -s))
        if rocs:
            print(f"  {n_votos:>6}  {np.mean(rocs):>8.3f}  {np.mean(prs):>11.3f}")
    print(f"  {'(piso)':>6}  {0.500:>8.3f}  {float((1 - y).mean()):>11.3f}")


datos_ = json.load(open(sys.argv[1]))
y_ = np.array([1.0 if d["marca"] == "arriba" else 0.0 for d in datos_])
rondas_ = [d["ronda"] for d in datos_]
consistencia_del_usuario(datos_)
vocab_ = {c: sorted({(d["brief"].get(c) or "") for d in datos_} - {""}) for c in ("objective", "formality", "momento")}
X_cod, _ = matriz([{**contexto(d["brief"], vocab_), **rasgos_por_codigo(d["prendas"])} for d in datos_])
curva_de_aprendizaje(X_cod, y_, rondas_)
