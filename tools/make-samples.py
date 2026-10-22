#!/usr/bin/env python3
"""Erzeugt die Beispieldateien des Klickdummys (bereitgestellte Materialien, E-Mail-Anlagen und Beispielabgaben)
in pb_public/samples/. Aufruf: python3 tools/make-samples.py  (benötigt reportlab, python-docx, openpyxl)"""
import pathlib, random
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from docx import Document
from docx.shared import Pt
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side

OUT = pathlib.Path(__file__).resolve().parent.parent / "pb_public" / "samples"
AB = OUT / "abgaben"; AB.mkdir(parents=True, exist_ok=True)
CO = "FunSport Innovations GmbH · Sportparkallee 12 · 70173 Stuttgart"

def pdf(path, title, sender, lines, table=None, foot="Alle Angaben fiktiv – Beispieldatei für den Exam Klickdummy."):
    c = canvas.Canvas(str(path), pagesize=A4); W, H = A4
    c.setFont("Helvetica-Bold", 15); c.drawString(20*mm, H-25*mm, sender)
    c.setFont("Helvetica", 8); c.drawString(20*mm, H-32*mm, CO)
    c.setFont("Helvetica-Bold", 13); c.drawString(20*mm, H-50*mm, title)
    y = H-62*mm; c.setFont("Helvetica", 10.5)
    for l in lines:
        if l.startswith("**"): c.setFont("Helvetica-Bold", 10.5); l = l.strip("*")
        else: c.setFont("Helvetica", 10.5)
        c.drawString(20*mm, y, l); y -= 6*mm
    if table:
        y -= 4*mm; colw = [(W-40*mm)/len(table[0])]*len(table[0])
        for r, row in enumerate(table):
            x = 20*mm
            if r == 0: c.setFillColorRGB(.92, .92, .92); c.rect(20*mm, y-2*mm, W-40*mm, 7*mm, fill=1, stroke=0); c.setFillColorRGB(0, 0, 0)
            c.setFont("Helvetica-Bold" if r == 0 or str(row[0]).startswith("=") else "Helvetica", 10)
            for i, v in enumerate(row):
                v = str(v).lstrip("=")
                if i and r: c.drawRightString(x+colw[i]-3*mm, y, v)
                else: c.drawString(x+2*mm, y, v)
                x += colw[i]
            c.setStrokeColorRGB(.75, .75, .75); c.line(20*mm, y-2.5*mm, W-20*mm, y-2.5*mm); y -= 8*mm
    c.setFont("Helvetica-Oblique", 7.5); c.setFillColorRGB(.45, .45, .45); c.drawString(20*mm, 15*mm, foot)
    c.showPage(); c.save()

def xlsx(path, title, rows, widths=None, money_cols=()):
    wb = Workbook(); ws = wb.active; ws.title = "Tabelle1"
    ws["A1"] = title; ws["A1"].font = Font(bold=True, size=13)
    thin = Side(style="thin", color="BBBBBB")
    for r, row in enumerate(rows, start=3):
        for c, v in enumerate(row, start=1):
            cell = ws.cell(row=r, column=c, value=v)
            cell.border = Border(top=thin, bottom=thin, left=thin, right=thin)
            if r == 3: cell.font = Font(bold=True); cell.fill = PatternFill("solid", fgColor="EEEEEE")
            if c in money_cols and r > 3 and isinstance(v, (int, float)): cell.number_format = '#,##0.00 "€"'
    for i, w in enumerate(widths or [], start=1): ws.column_dimensions[chr(64+i)].width = w
    wb.save(path)

def docx(path, title, paras, table=None):
    d = Document(); st = d.styles["Normal"]; st.font.name = "Arial"; st.font.size = Pt(11)
    d.add_heading(title, level=1)
    for p in paras: d.add_paragraph(p)
    if table:
        t = d.add_table(rows=len(table), cols=len(table[0])); t.style = "Table Grid"
        for r, row in enumerate(table):
            for c, v in enumerate(row): t.cell(r, c).text = str(v)
    d.save(path)

eur = lambda v: f"{v:,.2f} €".replace(",", "X").replace(".", ",").replace("X", ".")

# ---------- Bereitgestellte Dateien / E-Mail-Anlagen ----------
pdf(OUT/"Angebot_BatteryWorld.pdf", "Angebot Nr. BW-2025-1187 – Lithium-Batterie-Packs", "BatteryWorld GmbH",
    ["Sehr geehrte Damen und Herren,", "wir bieten Ihnen an:", ""],
    [["Position", "Menge", "Einzelpreis", "Gesamt"], ["Lithium-Batterie-Pack LBP-36V", "300", eur(115), eur(34500)], ["Rabatt", "", "10 %", "−" + eur(3450)], ["Skonto (14 Tage)", "", "2 %", ""], ["Fracht und Verpackung", "", "", eur(450)], ["Lieferzeit", "", "", "2 Wochen"]])
pdf(OUT/"Angebot_Innovatech.pdf", "Angebot Nr. IT-55021 – Lithium-Batterie-Packs", "InnovaTech GmbH",
    ["Sehr geehrte Damen und Herren,", "vielen Dank für Ihre Anfrage. Unser Angebot:", ""],
    [["Position", "Menge", "Einzelpreis", "Gesamt"], ["Lithium-Batterie-Pack Typ L36", "300", eur(113), eur(33900)], ["Rabatt", "", "5 %", "−" + eur(1695)], ["Skonto (10 Tage)", "", "3 %", ""], ["Lieferung", "", "", "frei Haus"], ["Lieferzeit", "", "", "4 Wochen"]])
pdf(OUT/"Kalkulationsschema.pdf", "Kalkulationsschema Bezugskalkulation", "FunSport Innovations GmbH",
    ["  Listeneinkaufspreis", "– Liefererrabatt", "= Zieleinkaufspreis", "– Liefererskonto", "= Bareinkaufspreis", "+ Bezugskosten", "**= Bezugspreis (Einstandspreis)"])
pdf(OUT/"Preisliste_Rollmaster.pdf", "Preisliste 2025 – Kugellager", "Rollmaster AG",
    ["Gültig ab 01.01.2025, Preise netto zzgl. USt.", ""],
    [["Artikel", "Typ", "ab 1 Stk.", "ab 500 Stk."], ["Rillenkugellager", "608-2RS", "0,48 €", "0,44 €"], ["Rillenkugellager", "6000-2RS", "0,95 €", "0,87 €"], ["Mengenrabatt", "", "", "8 %"], ["Zahlungsziel", "", "", "30 Tage netto"]])
pdf(OUT/"Anforderungen_Netzwerk.pdf", "Anforderungen Netzwerk neuer Standort", "FunSport Innovations GmbH",
    ["Adressbereich: 192.168.40.0/24", "Verwaltung: 50 Hosts · Produktion: 25 Hosts · Gäste: 10 Hosts", "Gäste-WLAN nur Internetzugriff, Verwaltung darf auf Produktion zugreifen.", "Dokumentation: Netz-ID, Broadcast, erster/letzter Host je Subnetz, Firewall-Regelwerk mit Begründung."])
xlsx(OUT/"Vorlage_Angebotsvergleich.xlsx", "Quantitativer Angebotsvergleich (Vorlage)",
     [["Position", "BatteryWorld GmbH", "InnovaTech GmbH"], ["Listeneinkaufspreis", None, None], ["– Rabatt", None, None], ["= Zieleinkaufspreis", None, None], ["– Skonto", None, None], ["= Bareinkaufspreis", None, None], ["+ Bezugskosten", None, None], ["= Bezugspreis", None, None]], [28, 22, 22], (2, 3))
xlsx(OUT/"Lieferantenliste.xlsx", "Lieferantenliste Kugellager",
     [["Lieferant", "Ort", "Ansprechpartner", "E-Mail", "Zahlungsbedingungen"], ["Rollmaster AG", "Schweinfurt", "Vertrieb", "vertrieb@rollmaster.de", "30 Tage netto"], ["KugelTec GmbH", "Mannheim", "Innendienst", "info@kugeltec.de", "14 Tage 2 % Skonto"], ["BearingPro KG", "Nürnberg", "Verkauf", "sales@bearingpro.de", "Vorkasse 3 % Skonto"]], [18, 14, 16, 24, 20])
def vergleich(disc_b=10, fr_b=450):
    b4, c4 = 34500, 33900; b5, c5 = b4*disc_b/100, c4*0.05; b6, c6 = b4-b5, c4-c5; b7, c7 = b6*0.02, c6*0.03; b8, c8 = b6-b7, c6-c7; b10, c10 = b8+fr_b, c8
    return [["Position", "BatteryWorld GmbH", "InnovaTech GmbH", "Formel (Spalte B)"], ["Listeneinkaufspreis", b4, c4, "Wert"], ["– Rabatt", b5, c5, f"Formel: B4*{disc_b}%"], ["= Zieleinkaufspreis", b6, c6, "Formel: B4-B5"], ["– Skonto", b7, c7, "Formel: B6*2%"], ["= Bareinkaufspreis", b8, c8, "Formel: B6-B7"], ["+ Bezugskosten", fr_b, 0, "Wert"], ["= Bezugspreis", b10, c10, "Formel: B8+B9"], ["Günstiger", "BatteryWorld" if b10 < c10 else "InnovaTech", "", 'Formel: WENN(B10<C10;"BatteryWorld";"InnovaTech")']]
xlsx(OUT/"Angebotsvergleich.xlsx", "Quantitativer Angebotsvergleich", vergleich(), [26, 20, 20, 40], (2, 3))

# ---------- Beispielabgaben (Prüflinge mit Abgaben) ----------
GRADED = [("Kuhnert", "Tanja"), ("Niebuhr", "Maya"), ("Mattern", "Kaja"), ("Trautwein", "Elif"), ("Birkholz", "Carsten"), ("Lohse", "Olaf"), ("Dittrich", "Fenja"), ("Ahlers", "Malte"), ("Ehrlicher", "Wiebke")]
random.seed(7)
for idx, (l, f) in enumerate(GRADED):
    disc = [10, 10, 8, 10][idx % 4]; fr = [450, 450, 400, 450][idx % 3]
    zep = 34500 * (1 - disc / 100); bar = zep * 0.98; bez = bar + fr
    rows = [["Pos.", "Bezeichnung", "Betrag"], ["1", "Listeneinkaufspreis (300 × 115,00 €)", eur(34500)], ["2", f"– Rabatt {disc} %", "−" + eur(34500 - zep)], ["3", "= Zieleinkaufspreis", eur(zep)], ["4", "– Skonto 2 %", "−" + eur(zep - bar)], ["5", "= Bareinkaufspreis", eur(bar)], ["6", "+ Bezugskosten", eur(fr)], ["=7", "= Bezugspreis", eur(bez)]]
    fmt = ["pdf", "docx", "xlsx"][idx % 3]
    name = f"Kalkulation_{l}.{fmt}"
    if fmt == "pdf": pdf(AB/name, "Bezugskalkulation 300 Lithium-Batterie-Packs", f"{f} {l}", ["Grundlage: Angebot BatteryWorld GmbH", ""], rows)
    elif fmt == "docx": docx(AB/name, "Bezugskalkulation 300 Lithium-Batterie-Packs", [f"Erstellt von {f} {l}", "Grundlage: Angebot der BatteryWorld GmbH (günstigster Bezugspreis)."], [[c.lstrip("=") for c in r] for r in rows] + [["", "Ergebnis", "BatteryWorld ist günstiger"]])
    else: xlsx(AB/name, f"Bezugskalkulation – {f} {l}", [["Pos.", "Bezeichnung", "Betrag"], [1, "Listeneinkaufspreis", 34500], [2, f"– Rabatt {disc} %", 34500 - zep], [3, "= Zieleinkaufspreis", zep], [4, "– Skonto 2 %", zep - bar], [5, "= Bareinkaufspreis", bar], [6, "+ Bezugskosten", fr], [7, "= Bezugspreis", bez]], [8, 30, 18], (3,))
    # E-Mail-Anhang 1.1
    xlsx(AB/f"Angebotsvergleich_{l}.xlsx", f"Angebotsvergleich – {f} {l}", vergleich(disc, fr), [26, 20, 20, 40], (2, 3))
    # Direkt hochgeladene Abgabe 2.3 (Nachkalkulation) für die ersten vier
    if idx < 4:
        fmt2 = ["xlsx", "pdf", "docx", "xlsx"][idx]
        n2 = f"Nachkalkulation_{l}.{fmt2}"
        tb = [["Position", "Plan", "Ist", "Abweichung"], ["Materialkosten", eur(30879), eur(31240), "+" + eur(361)], ["Fertigungslöhne", eur(12400), eur(13150), "+" + eur(750)], ["Gemeinkosten", eur(6200), eur(6050), "−" + eur(150)], ["=Selbstkosten", eur(49479), eur(50440), "+" + eur(961)]]
        if fmt2 == "pdf": pdf(AB/n2, "Nachkalkulation Auftrag Speedster", f"{f} {l}", ["Ursache: höhere Lohnkosten durch Mehrarbeit, Materialpreissteigerung.", ""], tb)
        elif fmt2 == "docx": docx(AB/n2, "Nachkalkulation Auftrag Speedster", [f"{f} {l}", "Die Selbstkosten liegen um 961,00 € über der Vorkalkulation."], tb)
        else: xlsx(AB/n2, "Nachkalkulation Auftrag Speedster", [["Position", "Plan", "Ist", "Abweichung"], ["Materialkosten", 30879, 31240, 361], ["Fertigungslöhne", 12400, 13150, 750], ["Gemeinkosten", 6200, 6050, -150], ["Selbstkosten", 49479, 50440, 961]], [22, 14, 14, 14], (2, 3, 4))
print("Beispieldateien erzeugt in", OUT)

# ---------- Netzplan (Bild) ----------
from PIL import Image, ImageDraw
img = Image.new("RGB", (900, 520), "white"); d = ImageDraw.Draw(img)
box = lambda x, y, t, c: (d.rounded_rectangle([x, y, x+170, y+60], 10, outline=c, width=3), d.text((x+12, y+22), t, fill="black"))
box(365, 30, "Internet / Router", "#145a74"); box(365, 150, "Firewall", "#a8201a"); box(365, 270, "Core-Switch", "#145a74")
box(80, 410, "VLAN 10 Verwaltung (50)", "#3a6b12"); box(365, 410, "VLAN 20 Produktion (25)", "#3a6b12"); box(650, 410, "VLAN 30 Gäste (10)", "#6a2bb5")
for a, b in [((450, 90), (450, 150)), ((450, 210), (450, 270)), ((450, 330), (165, 410)), ((450, 330), (450, 410)), ((450, 330), (735, 410))]: d.line([a, b], fill="#3d3b38", width=3)
d.text((20, 20), "Netzplan FunSport Innovations GmbH – neuer Standort (192.168.40.0/24)", fill="black")
img.save(OUT/"Netzplan_FunSport.png")
print("Netzplan erzeugt")
