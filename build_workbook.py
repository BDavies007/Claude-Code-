#!/usr/bin/env python3
"""
Project85_CEO_Athlete_System.xlsx builder.

Generates a 24-week hybrid athlete coaching workbook for Barrie Davies (Bdog).
Start: Monday 2026-06-22. 15 sheets, formulas, conditional formatting,
dropdowns, frozen headers, wrapped text, iPad-friendly widths.
"""

import datetime as dt
from openpyxl import Workbook
from openpyxl.styles import (
    Font, PatternFill, Alignment, Border, Side, NamedStyle
)
from openpyxl.formatting.rule import (
    CellIsRule, ColorScaleRule, FormulaRule
)
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.utils import get_column_letter

# ----------------------------------------------------------------------------
# Palette (clean, coach-like)
# ----------------------------------------------------------------------------
NAVY    = "1F3A5F"   # headers
SLATE   = "2E5E4E"   # section accent (green)
TEAL    = "0E7C7B"
ORANGE  = "E07A1F"
RED     = "C0392B"
AMBER   = "F1C40F"
GREEN   = "27AE60"
LIGHT   = "EAF0F6"   # light blue band
LIGHT2  = "F4F7FA"   # zebra
CARD    = "DCE6F1"
WHITE   = "FFFFFF"
GREY    = "5D6D7E"
INK     = "1A1A1A"

THIN = Side(style="thin", color="BFC9D4")
BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)

H1 = Font(name="Calibri", size=22, bold=True, color=NAVY)
H2 = Font(name="Calibri", size=15, bold=True, color="FFFFFF")
H3 = Font(name="Calibri", size=12, bold=True, color=NAVY)
TH = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
BODY = Font(name="Calibri", size=11, color=INK)
BODY_B = Font(name="Calibri", size=11, bold=True, color=INK)
SMALL = Font(name="Calibri", size=10, color=GREY)
MUTED = Font(name="Calibri", size=11, italic=True, color=GREY)

FILL_NAVY  = PatternFill("solid", fgColor=NAVY)
FILL_SLATE = PatternFill("solid", fgColor=SLATE)
FILL_TEAL  = PatternFill("solid", fgColor=TEAL)
FILL_LIGHT = PatternFill("solid", fgColor=LIGHT)
FILL_LIGHT2 = PatternFill("solid", fgColor=LIGHT2)
FILL_CARD  = PatternFill("solid", fgColor=CARD)
FILL_WHITE = PatternFill("solid", fgColor=WHITE)
FILL_INPUT = PatternFill("solid", fgColor="FFF7E0")  # editable cells

WRAP_TOP = Alignment(wrap_text=True, vertical="top")
WRAP_CTR = Alignment(wrap_text=True, vertical="center")
CTR = Alignment(horizontal="center", vertical="center", wrap_text=True)
LEFT = Alignment(horizontal="left", vertical="center", wrap_text=True)
LEFT_TOP = Alignment(horizontal="left", vertical="top", wrap_text=True)

wb = Workbook()

# ----------------------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------------------
def title_block(ws, title, subtitle, span=8, fill=FILL_NAVY):
    """Big banner title at row 1-2."""
    ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=span)
    c = ws.cell(1, 1, title)
    c.font = Font(name="Calibri", size=20, bold=True, color="FFFFFF")
    c.fill = fill
    c.alignment = Alignment(horizontal="left", vertical="center", indent=1)
    ws.row_dimensions[1].height = 34
    ws.merge_cells(start_row=2, start_column=1, end_row=2, end_column=span)
    s = ws.cell(2, 1, subtitle)
    s.font = Font(name="Calibri", size=11, italic=True, color="FFFFFF")
    s.fill = PatternFill("solid", fgColor=SLATE)
    s.alignment = Alignment(horizontal="left", vertical="center", indent=1)
    ws.row_dimensions[2].height = 20

def section(ws, row, text, span=8, fill=FILL_SLATE):
    ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=span)
    c = ws.cell(row, 1, text)
    c.font = Font(name="Calibri", size=13, bold=True, color="FFFFFF")
    c.fill = fill
    c.alignment = Alignment(horizontal="left", vertical="center", indent=1)
    ws.row_dimensions[row].height = 24
    return row + 1

def header_row(ws, row, headers, fill=FILL_NAVY, height=26):
    for i, h in enumerate(headers, start=1):
        c = ws.cell(row, i, h)
        c.font = TH
        c.fill = fill
        c.alignment = CTR
        c.border = BORDER
    ws.row_dimensions[row].height = height

def set_widths(ws, widths):
    for i, w in enumerate(widths, start=1):
        ws.column_dimensions[get_column_letter(i)].width = w

def zebra(ws, r0, r1, ncols):
    for r in range(r0, r1 + 1):
        if (r - r0) % 2 == 1:
            for c in range(1, ncols + 1):
                ws.cell(r, c).fill = FILL_LIGHT2

# ----------------------------------------------------------------------------
# Wave / progression model
# ----------------------------------------------------------------------------
START = dt.date(2026, 6, 22)
WEEKS = 24
WAVE_NAMES = {1: "Accumulation", 2: "Progression", 3: "Peak Volume", 4: "Deload"}
WAVE_RPE = {1: "RPE 7 (2-3 RIR)", 2: "RPE 7-8 (2 RIR)",
            3: "RPE 8 (1-2 RIR)", 4: "RPE 5-6 (deload)"}
WAVE_STR = {
    1: "High volume base. Lock technique. 2-3 reps in reserve on all lifts.",
    2: "Add one set, 1-2 reps, or small load wherever last week was completed.",
    3: "Highest density / volume of the block. Cap effort at RPE 8.",
    4: "Cut strength volume ~40%. Keep movement quality high. Recover tissue.",
}
WAVE_END = {
    1: "Build aerobic base. 80% easy Zone 2, 20% quality.",
    2: "Extend easy volume; sharpen the 20% quality sessions.",
    3: "Peak endurance density; longest long ride & run of the block.",
    4: "Reduce endurance volume 40-50%. Short, sharp, fresh.",
}
WAVE_REC = {
    1: "8h sleep target. Daily mobility 10 min. Establish routine.",
    2: "Monitor HRV trend. Add 5 min breathwork on hard days.",
    3: "Protect sleep aggressively. Nap if HRV drops. Fuel hard sessions.",
    4: "Extra sleep, easy walks, massage/sauna. Re-test KPIs end of week.",
}

def wave_for_week(w):           # w is 1..24
    return ((w - 1) % 4) + 1

def block_for_week(w):          # 1..6
    return ((w - 1) // 4) + 1

def ftp_target(w):
    # 215 -> 275 across 24 weeks, deload weeks ease back slightly
    base = 215 + (275 - 215) * (w - 1) / (WEEKS - 1)
    if wave_for_week(w) == 4 and w != WEEKS:
        base -= 3
    return round(base)

def weight_target(w):
    # 100 -> 85 across 24 weeks
    return round(100 - (100 - 85) * (w - 1) / (WEEKS - 1), 1)

def vo2_target(w):
    return round(41 + (50 - 41) * (w - 1) / (WEEKS - 1), 1)

def fivek_target(w):
    # 32:00 -> 26:00 (mid of 25-27) in seconds
    total = 32 * 60 - (32 * 60 - 26 * 60) * (w - 1) / (WEEKS - 1)
    m, s = divmod(int(round(total)), 60)
    return f"{m}:{s:02d}"

# Cycling power zones as % of FTP
def zones(ftp):
    return {
        "Z1 Recovery":   (int(ftp*0.50), int(ftp*0.55)),
        "Z2 Endurance":  (int(ftp*0.56), int(ftp*0.75)),
        "Z3 Tempo":      (int(ftp*0.76), int(ftp*0.90)),
        "Z4 Threshold":  (int(ftp*0.91), int(ftp*1.05)),
        "Z5 VO2 Max":    (int(ftp*1.06), int(ftp*1.20)),
        "Z6 Anaerobic":  (int(ftp*1.21), int(ftp*1.50)),
    }

# ----------------------------------------------------------------------------
# Daily template (Mon..Sun) -> structured content
# ----------------------------------------------------------------------------
# index 0 = Monday
DAY_TEMPLATE = [
    {  # Monday
        "name": "Monday",
        "focus": "Chest + Biceps",
        "workout": "Barbell bench, incline DB press, weighted dips, cable fly; EZ-bar curl, incline DB curl, cable curl. 4-5 exercises, 3-4 sets.",
        "endurance": "Zone 2 Cycle",
        "intensity": "Easy",
        "mobility": "Thoracic opener + pec stretch, 10 min",
        "mindful": "5 min box breathing",
        "travel": "Hotel: DB press + DB curls. No gym: deep push-ups, band curls, slow tempo.",
    },
    {  # Tuesday
        "name": "Tuesday",
        "focus": "Back + Triceps",
        "workout": "Weighted pull-ups, barbell row, lat pulldown, face pull; close-grip bench, rope pushdown, overhead extension. 3-4 sets.",
        "endurance": "VO2 Bike",
        "intensity": "Hard",
        "mobility": "Lat + lower-back decompression, 10 min",
        "mindful": "5 min gratitude journaling",
        "travel": "Hotel: DB row + bench dips. No gym: doorway rows, band pulldown, diamond push-ups.",
    },
    {  # Wednesday
        "name": "Wednesday",
        "focus": "Legs Volume",
        "workout": "Back squat, leg press, walking lunge, leg curl, calf raise. High volume, 3-4 sets, controlled tempo.",
        "endurance": "Easy Run",
        "intensity": "Easy",
        "mobility": "Hip flexor + ankle mobility, 10 min",
        "mindful": "5 min body scan",
        "travel": "Hotel: goblet squat + DB lunge. No gym: Bulgarian split squat, step-ups, tempo squats.",
    },
    {  # Thursday
        "name": "Thursday",
        "focus": "Shoulders",
        "workout": "Overhead press, DB lateral raise, rear-delt fly, upright row, shrugs. 3-4 sets, control on raises.",
        "endurance": "Threshold Cycle",
        "intensity": "Hard",
        "mobility": "Shoulder CARs + band dislocates, 10 min",
        "mindful": "5 min focus meditation",
        "travel": "Hotel: DB press + raises. No gym: pike push-ups, band laterals, backpack press.",
    },
    {  # Friday
        "name": "Friday",
        "focus": "Chest + Back Density",
        "workout": "Superset bench & row density blocks, incline press, chest-supported row, fly + pulldown. Short rest, high density.",
        "endurance": "Hybrid: Carries / Burpees / Lunges",
        "intensity": "Moderate",
        "mobility": "Full upper-body flush, 10 min",
        "mindful": "5 min intention setting",
        "travel": "Hotel: DB density supersets. No gym: push-up/row ladders + loaded carries with bags.",
    },
    {  # Saturday
        "name": "Saturday",
        "focus": "Legs + Posterior Chain",
        "workout": "Deadlift / RDL, front squat, hip thrust, Nordic curl, back extension. Heavy posterior-chain emphasis.",
        "endurance": "Long Ride",
        "intensity": "Long",
        "mobility": "Hamstring + glute release, 12 min",
        "mindful": "10 min outdoor mindfulness",
        "travel": "Hotel: DB RDL + hip thrust. No gym: single-leg RDL, hip bridges, long Zone 2 ride/run.",
    },
    {  # Sunday
        "name": "Sunday",
        "focus": "Arms + Core",
        "workout": "Barbell curl, hammer curl, skullcrusher, pushdown; hanging leg raise, plank, cable crunch, pallof press.",
        "endurance": "Long Run",
        "intensity": "Long",
        "mobility": "Spine + hip flow, 12 min",
        "mindful": "10 min reflection / week review",
        "travel": "Hotel: DB arms + core circuit. No gym: band curls, dips, planks, long easy run.",
    },
]

def coach_brief(weekday_idx, wave, ftp):
    z = zones(ftp)
    name = DAY_TEMPLATE[weekday_idx]["name"]
    rpe = WAVE_RPE[wave]
    if name == "Monday":
        zt = z["Z2 Endurance"]
        return f"{WAVE_NAMES[wave]} week. Push strength at {rpe}. Cycle Zone 2 {zt[0]}-{zt[1]}W, nose-breathing pace 40-60 min."
    if name == "Tuesday":
        zt = z["Z5 VO2 Max"]
        return f"VO2 intervals {zt[0]}-{zt[1]}W, e.g. 5-6x3min hard / 3min easy. Back work at {rpe}."
    if name == "Wednesday":
        return f"Leg volume day at {rpe}. Easy aerobic run after, conversational pace, keep HR low to aid recovery."
    if name == "Thursday":
        zt = z["Z4 Threshold"]
        return f"Threshold cycle {zt[0]}-{zt[1]}W, 2-3x10-15min. Shoulders at {rpe}; control lateral raises."
    if name == "Friday":
        return f"Density day: minimise rest, chase the pump at {rpe}. Hybrid finisher: carries, burpees, lunges 12-15 min."
    if name == "Saturday":
        zt = z["Z2 Endurance"]
        return f"Heavy posterior chain at {rpe}. Long ride Zone 2 {zt[0]}-{zt[1]}W, build duration through the block."
    # Sunday
    return f"Arms & core at {rpe}. Long run 80% easy, conversational. Reflect & log the week's wins."

def deload_adjust(text, wave):
    if wave == 4:
        return "DELOAD: " + text
    return text

# ============================================================================
# SHEET 1 — START HERE
# ============================================================================
ws = wb.active
ws.title = "START HERE"
set_widths(ws, [3, 26, 30, 30, 22, 18, 18, 18])
ws.sheet_view.showGridLines = False
title_block(ws, "PROJECT 85 — CEO ATHLETE SYSTEM",
            "24-Week Hybrid Performance Build  •  Barrie 'Bdog' Davies  •  Start Mon 22 Jun 2026", span=8)

r = 4
r = section(ws, r, "MISSION", span=8)
ws.merge_cells(start_row=r, start_column=2, end_row=r+2, end_column=8)
ws.cell(r, 2, ("Become a CEO-grade hybrid athlete: leaner, stronger, and more aerobically powerful. "
               "Drop to 85kg while building muscle and tendon density, lift a 275W FTP, and run a sub-27 5km — "
               "all on a travel-proof system that survives a full gym, a hotel gym, or no gym at all. "
               "Train daily with varying intensity, recover deliberately, and compound small wins for 24 weeks."))
ws.cell(r, 2).alignment = WRAP_TOP
ws.cell(r, 2).font = BODY
ws.row_dimensions[r].height = 18
r += 3

r = section(ws, r, "BASELINE  →  TARGET", span=8)
header_row(ws, r, ["", "Metric", "Baseline", "Target", "Window", "", "", ""])
r += 1
baseline_rows = [
    ("Body weight", "100 kg", "85 kg", "24 weeks"),
    ("FTP (cycling)", "215 W", "275 W", "24 weeks"),
    ("FTP / kg", "2.15 W/kg", "3.24 W/kg", "derived"),
    ("VO2 Max", "41", "50+", "24 weeks"),
    ("5 km run", "32:00", "25:00 - 27:00", "24 weeks"),
    ("Bench press", "105 kg", "Maintain 105 kg+", "ongoing"),
    ("Back squat", "140 kg", "Maintain 140 kg+", "ongoing"),
]
for metric, base, tgt, win in baseline_rows:
    ws.cell(r, 2, metric).font = BODY_B
    ws.cell(r, 3, base).font = BODY
    ws.cell(r, 4, tgt).font = BODY
    ws.cell(r, 5, win).font = MUTED
    for c in range(2, 9):
        ws.cell(r, c).border = BORDER
        ws.cell(r, c).alignment = LEFT
    r += 1
r += 1

r = section(ws, r, "HOW TO USE THIS WORKBOOK", span=8)
how = [
    "1. Open the Inputs sheet and confirm your baseline numbers and targets. Everything downstream reads from here.",
    "2. Check the Executive Dashboard each Monday for your live KPIs and where you stand vs target.",
    "3. Follow the Daily Plan — one row per day for 168 days. Each row tells you exactly what to train.",
    "4. Log every session in the Daily Log: mark Completed (Yes / No / Partial / Travel Alt) and your RPE.",
    "5. Travelling? Use the Travel Playbook and the Travel Alternative column for hotel-gym or no-gym swaps.",
    "6. Every Sunday, fill the Weekly Coach Review to capture KPIs, compliance, and next-week adjustments.",
    "7. Reference sheets (Workout Briefs, Cycling 80-20, Running 80-20, Hybrid, Exercise Library) explain the why.",
    "8. Yellow cells are editable inputs. Coloured cells (intensity / compliance / recovery) are auto-formatted.",
]
for line in how:
    ws.merge_cells(start_row=r, start_column=2, end_row=r, end_column=8)
    ws.cell(r, 2, line).font = BODY
    ws.cell(r, 2).alignment = WRAP_TOP
    ws.row_dimensions[r].height = 16
    r += 1
r += 1

r = section(ws, r, "THE 4-WEEK WAVE (REPEATED 6 TIMES)", span=8)
header_row(ws, r, ["", "Week", "Phase", "Strength", "Endurance", "RPE Cap", "", ""])
r += 1
for w in (1, 2, 3, 4):
    ws.cell(r, 2, f"Week {w}").font = BODY_B
    ws.cell(r, 3, WAVE_NAMES[w]).font = BODY_B
    ws.cell(r, 4, WAVE_STR[w]).font = BODY
    ws.cell(r, 5, WAVE_END[w]).font = BODY
    ws.cell(r, 6, WAVE_RPE[w]).font = BODY
    for c in range(2, 9):
        ws.cell(r, c).border = BORDER
        ws.cell(r, c).alignment = LEFT
    ws.row_dimensions[r].height = 40
    r += 1

ws.freeze_panes = "A3"

# ============================================================================
# SHEET 2 — Inputs
# ============================================================================
ws = wb.create_sheet("Inputs")
set_widths(ws, [3, 30, 18, 18, 40])
ws.sheet_view.showGridLines = False
title_block(ws, "INPUTS", "Edit the yellow cells. The whole workbook reads from here.", span=5)

r = 4
r = section(ws, r, "ATHLETE", span=5)
inputs_athlete = [
    ("Athlete name", "Barrie 'Bdog' Davies", "Who we are building"),
    ("Program start (Monday)", START, "Day 1 of Week 1"),
    ("Program length (weeks)", 24, "6 x 4-week waves"),
    ("Training days / week", 7, "Daily varying intensity"),
]
header_row(ws, r, ["", "Variable", "Value", "", "Note"])
r += 1
INPUT_REF = {}
for var, val, note in inputs_athlete:
    ws.cell(r, 2, var).font = BODY_B
    c = ws.cell(r, 3, val); c.font = BODY_B; c.fill = FILL_INPUT
    if isinstance(val, dt.date):
        c.number_format = "ddd dd mmm yyyy"
    ws.cell(r, 5, note).font = MUTED
    for cc in range(2, 6):
        ws.cell(r, cc).border = BORDER
        ws.cell(r, cc).alignment = LEFT
    r += 1
r += 1

r = section(ws, r, "BASELINE  &  TARGETS", span=5)
header_row(ws, r, ["", "Metric", "Baseline", "Target", "Note"])
r += 1
# remember rows for FTP/kg formula references
metric_rows = {}
metrics = [
    ("weight", "Body weight (kg)", 100, 85, "Fat loss + recomposition"),
    ("ftp", "FTP (W)", 215, 275, "+60W in 24 weeks"),
    ("vo2", "VO2 Max", 41, 50, "Target 50+"),
    ("fivek", "5km time (mm:ss)", "32:00", "26:00", "Target window 25-27 min"),
    ("bench", "Bench press (kg)", 105, 110, "Maintain 105kg+"),
    ("squat", "Back squat (kg)", 140, 145, "Maintain 140kg+"),
    ("sleep", "Sleep target (h)", 8, 8, "Recovery anchor"),
    ("hrv", "HRV baseline (ms)", 65, 75, "Trend, not absolute"),
]
for key, name, base, tgt, note in metrics:
    ws.cell(r, 2, name).font = BODY_B
    cb = ws.cell(r, 3, base); cb.font = BODY_B; cb.fill = FILL_INPUT; cb.alignment = CTR
    ct = ws.cell(r, 4, tgt); ct.font = BODY_B; ct.fill = FILL_INPUT; ct.alignment = CTR
    ws.cell(r, 5, note).font = MUTED
    for cc in range(2, 6):
        ws.cell(r, cc).border = BORDER
        if cc == 5 or cc == 2:
            ws.cell(r, cc).alignment = LEFT
    metric_rows[key] = r
    r += 1
r += 1

# Derived FTP/kg with formulas
r = section(ws, r, "DERIVED (auto)", span=5)
header_row(ws, r, ["", "Metric", "Baseline", "Target", "Note"])
r += 1
wt_r = metric_rows["weight"]; ftp_r = metric_rows["ftp"]
ws.cell(r, 2, "FTP / kg (W/kg)").font = BODY_B
fb = ws.cell(r, 3, f"=C{ftp_r}/C{wt_r}"); fb.number_format = "0.00"; fb.alignment = CTR; fb.font = BODY_B
ft = ws.cell(r, 4, f"=D{ftp_r}/D{wt_r}"); ft.number_format = "0.00"; ft.alignment = CTR; ft.font = BODY_B
ws.cell(r, 5, "= FTP / body weight").font = MUTED
for cc in range(2, 6):
    ws.cell(r, cc).border = BORDER
INPUT_FTPKG_BASE = f"Inputs!C{r}"
INPUT_FTPKG_TGT = f"Inputs!D{r}"
r += 1
ws.cell(r, 2, "Total weight to lose (kg)").font = BODY_B
wl = ws.cell(r, 3, f"=C{wt_r}-D{wt_r}"); wl.number_format = "0.0"; wl.alignment = CTR; wl.font = BODY_B
ws.cell(r, 4, f"=ROUND((C{wt_r}-D{wt_r})/24,2)").alignment = CTR
ws.cell(r, 4).number_format = "0.00"
ws.cell(r, 5, "Target ~per week (col D)").font = MUTED
for cc in range(2, 6):
    ws.cell(r, cc).border = BORDER
r += 1

# store references for dashboard
REF = {
    "weight_base": f"Inputs!C{metric_rows['weight']}",
    "weight_tgt": f"Inputs!D{metric_rows['weight']}",
    "ftp_base": f"Inputs!C{metric_rows['ftp']}",
    "ftp_tgt": f"Inputs!D{metric_rows['ftp']}",
    "vo2_base": f"Inputs!C{metric_rows['vo2']}",
    "vo2_tgt": f"Inputs!D{metric_rows['vo2']}",
    "fivek_base": f"Inputs!C{metric_rows['fivek']}",
    "fivek_tgt": f"Inputs!D{metric_rows['fivek']}",
    "bench_base": f"Inputs!C{metric_rows['bench']}",
    "squat_base": f"Inputs!C{metric_rows['squat']}",
    "sleep_tgt": f"Inputs!D{metric_rows['sleep']}",
    "hrv_base": f"Inputs!C{metric_rows['hrv']}",
    "ftpkg_base": INPUT_FTPKG_BASE,
    "ftpkg_tgt": INPUT_FTPKG_TGT,
}
ws.freeze_panes = "A3"

# ============================================================================
# SHEET 3 — Executive Dashboard
# ============================================================================
ws = wb.create_sheet("Executive Dashboard")
set_widths(ws, [3, 24, 16, 16, 16, 14, 30])
ws.sheet_view.showGridLines = False
title_block(ws, "EXECUTIVE DASHBOARD",
            "Live KPIs — update 'Current' (yellow) weekly. Targets pull from Inputs.", span=7)

r = 4
r = section(ws, r, "PERFORMANCE KPIs", span=7)
header_row(ws, r, ["", "KPI", "Baseline", "Current", "Target", "% to goal", "Status / Notes"])
r += 1
kpi_start = r
kpis = [
    ("Body weight (kg)", REF["weight_base"], 100, REF["weight_tgt"], "down"),
    ("FTP (W)", REF["ftp_base"], 215, REF["ftp_tgt"], "up"),
    ("FTP / kg (W/kg)", REF["ftpkg_base"], None, REF["ftpkg_tgt"], "up"),
    ("VO2 Max", REF["vo2_base"], 41, REF["vo2_tgt"], "up"),
    ("5km time", REF["fivek_base"], None, REF["fivek_tgt"], "downtime"),
    ("Bench press (kg)", REF["bench_base"], 105, REF["bench_base"], "up"),
    ("Back squat (kg)", REF["squat_base"], 140, REF["squat_base"], "up"),
]
for name, base_ref, cur, tgt_ref, direction in kpis:
    ws.cell(r, 2, name).font = BODY_B
    cb = ws.cell(r, 3, f"={base_ref}")
    cb.alignment = CTR; cb.font = BODY
    cc = ws.cell(r, 4)  # Current — editable yellow
    cc.fill = FILL_INPUT; cc.alignment = CTR; cc.font = BODY_B
    ct = ws.cell(r, 5, f"={tgt_ref}")
    ct.alignment = CTR; ct.font = BODY
    if name in ("Body weight (kg)", "FTP (W)", "VO2 Max", "Bench press (kg)", "Back squat (kg)"):
        cb.number_format = "0.0"; ct.number_format = "0.0"
    if name == "FTP / kg (W/kg)":
        cb.number_format = "0.00"; ct.number_format = "0.00"
    # % to goal formula (guard divide by zero)
    pcell = ws.cell(r, 6)
    if direction in ("up",):
        pcell.value = (f'=IF(ISNUMBER(D{r}),IF((E{r}-C{r})=0,1,'
                       f'MAX(0,MIN(1,(D{r}-C{r})/(E{r}-C{r})))),"")')
    elif direction == "down":
        pcell.value = (f'=IF(ISNUMBER(D{r}),IF((C{r}-E{r})=0,1,'
                       f'MAX(0,MIN(1,(C{r}-D{r})/(C{r}-E{r})))),"")')
    else:
        pcell.value = '"—"'
        pcell.value = "—"
    pcell.number_format = "0%"
    pcell.alignment = CTR; pcell.font = BODY_B
    ws.cell(r, 7, "Enter current value weekly").font = MUTED
    for col in range(2, 8):
        ws.cell(r, col).border = BORDER
    r += 1
kpi_end = r - 1

# Conditional formatting on % to goal (col F)
ws.conditional_formatting.add(
    f"F{kpi_start}:F{kpi_end}",
    ColorScaleRule(start_type="num", start_value=0, start_color=RED,
                   mid_type="num", mid_value=0.5, mid_color=AMBER,
                   end_type="num", end_value=1, end_color=GREEN))
r += 1

# Recovery & lifestyle KPIs
r = section(ws, r, "RECOVERY & CONSISTENCY", span=7)
header_row(ws, r, ["", "Metric", "Baseline", "Current", "Target", "Trend", "Guidance"])
r += 1
rec_start = r
rec = [
    ("Compliance (%)", "", 95, "up", "Sessions completed vs planned. Aim 90%+."),
    ("Sleep (h/night)", "", REF["sleep_tgt"], "up", "8h anchors fat loss & FTP gains."),
    ("HRV (ms)", REF["hrv_base"], 75, "up", "Watch the 7-day trend, not single days."),
    ("Resting HR (bpm)", "", 50, "down", "Should drift down as aerobic base builds."),
    ("Recovery score (1-10)", "", 8, "up", "<5 = swap to travel-alt or deload day."),
]
for name, base_ref, tgt, direction, guide in rec:
    ws.cell(r, 2, name).font = BODY_B
    if base_ref:
        ws.cell(r, 3, f"={base_ref}").alignment = CTR
    cc = ws.cell(r, 4); cc.fill = FILL_INPUT; cc.alignment = CTR; cc.font = BODY_B
    ws.cell(r, 5, tgt if not isinstance(tgt, str) else f"={tgt}").alignment = CTR
    tr = ws.cell(r, 6); tr.alignment = CTR; tr.fill = FILL_INPUT  # editable arrow/score
    ws.cell(r, 7, guide).font = MUTED
    for col in range(2, 8):
        ws.cell(r, col).border = BORDER
    ws.cell(r, 2).alignment = LEFT
    ws.cell(r, 7).alignment = LEFT
    r += 1
rec_end = r - 1

# Conditional formatting: compliance & recovery
ws.conditional_formatting.add(
    f"D{rec_start}:D{rec_start}",  # compliance %
    CellIsRule(operator="greaterThanOrEqual", formula=["90"],
               fill=PatternFill("solid", fgColor="C6EFCE")))
ws.conditional_formatting.add(
    f"D{rec_start}:D{rec_start}",
    CellIsRule(operator="lessThan", formula=["75"],
               fill=PatternFill("solid", fgColor="FFC7CE")))
ws.conditional_formatting.add(
    f"D{rec_end}:D{rec_end}",  # recovery score 1-10
    ColorScaleRule(start_type="num", start_value=1, start_color=RED,
                   mid_type="num", mid_value=5, mid_color=AMBER,
                   end_type="num", end_value=10, end_color=GREEN))
r += 1

r = section(ws, r, "THIS WEEK", span=7)
ws.merge_cells(start_row=r, start_column=2, end_row=r, end_column=3)
ws.cell(r, 2, "Current week #").font = BODY_B
cw = ws.cell(r, 4); cw.fill = FILL_INPUT; cw.alignment = CTR; cw.font = BODY_B; cw.value = 1
ws.cell(r, 5, "Phase").font = BODY_B
ph = ws.cell(r, 6)
ph.value = (f'=IF(D{r}="","",CHOOSE(MOD(D{r}-1,4)+1,'
            f'"Accumulation","Progression","Peak Volume","Deload"))')
ph.alignment = CTR; ph.font = BODY_B
for col in range(2, 8):
    ws.cell(r, col).border = BORDER
r += 1
ws.cell(r, 2, "Top focus this week").font = BODY_B
ws.merge_cells(start_row=r, start_column=3, end_row=r, end_column=7)
fc = ws.cell(r, 3); fc.fill = FILL_INPUT; fc.alignment = LEFT
fc.value = "e.g. Protect sleep, hit all Zone 2 watts, +1 set on bench"
for col in range(2, 8):
    ws.cell(r, col).border = BORDER
ws.row_dimensions[r].height = 22
ws.freeze_panes = "A3"

# ============================================================================
# SHEET 4 — 24 Week Roadmap
# ============================================================================
ws = wb.create_sheet("24 Week Roadmap")
set_widths(ws, [6, 8, 14, 13, 12, 13, 40, 40, 34])
ws.sheet_view.showGridLines = False
title_block(ws, "24-WEEK ROADMAP",
            "One row per week. 6 blocks x 4-week wave (Accumulation, Progression, Peak, Deload).", span=9)
r = 4
header_row(ws, r, ["Wk", "Block", "Phase", "Weight kg", "FTP W", "FTP/kg",
                   "Strength Strategy", "Endurance Strategy", "Recovery Guidance"])
ws.row_dimensions[r].height = 30
data_start = r + 1
for w in range(1, WEEKS + 1):
    rr = r + w
    wave = wave_for_week(w)
    blk = block_for_week(w)
    wt = weight_target(w)
    ftp = ftp_target(w)
    ws.cell(rr, 1, w).alignment = CTR
    ws.cell(rr, 2, f"B{blk}").alignment = CTR
    ws.cell(rr, 3, WAVE_NAMES[wave]).alignment = CTR
    ws.cell(rr, 4, wt).alignment = CTR
    ws.cell(rr, 5, ftp).alignment = CTR
    fk = ws.cell(rr, 6, f"=E{rr}/D{rr}"); fk.number_format = "0.00"; fk.alignment = CTR
    ws.cell(rr, 7, WAVE_STR[wave]).alignment = LEFT_TOP
    ws.cell(rr, 8, WAVE_END[wave]).alignment = LEFT_TOP
    ws.cell(rr, 9, WAVE_REC[wave]).alignment = LEFT_TOP
    for c in range(1, 10):
        ws.cell(rr, c).border = BORDER
        ws.cell(rr, c).font = BODY
    ws.cell(rr, 3).font = BODY_B
    ws.row_dimensions[rr].height = 34
data_end = r + WEEKS

# Color phases
phase_fills = {
    "Accumulation": "DCE6F1",
    "Progression": "D5E8D4",
    "Peak Volume": "FCE4D6",
    "Deload": "EDEDED",
}
for w in range(1, WEEKS + 1):
    rr = r + w
    ws.cell(rr, 3).fill = PatternFill("solid", fgColor=phase_fills[WAVE_NAMES[wave_for_week(w)]])
ws.freeze_panes = "A5"

# ============================================================================
# SHEET 5 — Daily Plan (168 rows)
# ============================================================================
ws = wb.create_sheet("Daily Plan")
set_widths(ws, [6, 6, 13, 11, 18, 44, 24, 12, 22, 20, 30, 44, 13, 8, 22])
ws.sheet_view.showGridLines = False
title_block(ws, "DAILY PLAN — 168 DAYS",
            "From Mon 22 Jun 2026. One row per day. Log completion, RPE & notes on the right.", span=15)
r = 4
headers = ["Day", "Wk", "Date", "Weekday", "Strength Focus", "Workout",
           "Endurance / HIIT", "Intensity", "Mobility", "Mindfulness",
           "Travel Alternative", "Coach Brief", "Completed", "RPE", "Notes"]
header_row(ws, r, headers)
ws.row_dimensions[r].height = 30
dp_start = r + 1
for d in range(168):
    rr = dp_start + d
    date = START + dt.timedelta(days=d)
    weekday_idx = date.weekday()  # 0 = Monday
    w = d // 7 + 1
    wave = wave_for_week(w)
    ftp = ftp_target(w)
    t = DAY_TEMPLATE[weekday_idx]
    ws.cell(rr, 1, d + 1).alignment = CTR
    ws.cell(rr, 2, w).alignment = CTR
    dc = ws.cell(rr, 3, date); dc.number_format = "ddd dd mmm"; dc.alignment = CTR
    ws.cell(rr, 4, t["name"]).alignment = CTR
    ws.cell(rr, 5, t["focus"]).alignment = LEFT_TOP
    ws.cell(rr, 6, deload_adjust(t["workout"], wave)).alignment = LEFT_TOP
    ws.cell(rr, 7, t["endurance"]).alignment = LEFT_TOP
    intensity = t["intensity"] if wave != 4 else "Easy"
    ws.cell(rr, 8, intensity).alignment = CTR
    ws.cell(rr, 9, t["mobility"]).alignment = LEFT_TOP
    ws.cell(rr, 10, t["mindful"]).alignment = LEFT_TOP
    ws.cell(rr, 11, t["travel"]).alignment = LEFT_TOP
    ws.cell(rr, 12, coach_brief(weekday_idx, wave, ftp)).alignment = LEFT_TOP
    # log cells (editable)
    cc = ws.cell(rr, 13); cc.fill = FILL_INPUT; cc.alignment = CTR
    rp = ws.cell(rr, 14); rp.fill = FILL_INPUT; rp.alignment = CTR
    nt = ws.cell(rr, 15); nt.fill = FILL_INPUT; nt.alignment = LEFT_TOP
    for c in range(1, 16):
        ws.cell(rr, c).border = BORDER
        ws.cell(rr, c).font = BODY
    ws.cell(rr, 5).font = BODY_B
    ws.row_dimensions[rr].height = 50
dp_end = dp_start + 167

# Zebra by week band (alternate weeks lightly)
for d in range(168):
    rr = dp_start + d
    w = d // 7 + 1
    if w % 2 == 0:
        for c in range(1, 13):
            if ws.cell(rr, c).fill.fgColor.rgb in (None, "00000000"):
                ws.cell(rr, c).fill = FILL_LIGHT2

# Intensity conditional formatting (col H)
int_col = f"H{dp_start}:H{dp_end}"
for val, color in [("Hard", "F8CBAD"), ("Moderate", "FFE699"),
                   ("Easy", "C6E0B4"), ("Long", "BDD7EE")]:
    ws.conditional_formatting.add(
        int_col,
        CellIsRule(operator="equal", formula=[f'"{val}"'],
                   fill=PatternFill("solid", fgColor=color)))

# Completion conditional formatting (col M)
comp_col = f"M{dp_start}:M{dp_end}"
ws.conditional_formatting.add(comp_col, CellIsRule(operator="equal", formula=['"Yes"'],
    fill=PatternFill("solid", fgColor="C6EFCE")))
ws.conditional_formatting.add(comp_col, CellIsRule(operator="equal", formula=['"No"'],
    fill=PatternFill("solid", fgColor="FFC7CE")))
ws.conditional_formatting.add(comp_col, CellIsRule(operator="equal", formula=['"Partial"'],
    fill=PatternFill("solid", fgColor="FFEB9C")))
ws.conditional_formatting.add(comp_col, CellIsRule(operator="equal", formula=['"Travel Alt"'],
    fill=PatternFill("solid", fgColor="BDD7EE")))

# Data validations
dv_comp = DataValidation(type="list", formula1='"Yes,No,Partial,Travel Alt"', allow_blank=True)
dv_rpe = DataValidation(type="whole", operator="between", formula1="1", formula2="10", allow_blank=True)
ws.add_data_validation(dv_comp)
ws.add_data_validation(dv_rpe)
dv_comp.add(f"M{dp_start}:M{dp_end}")
dv_rpe.add(f"N{dp_start}:N{dp_end}")

ws.freeze_panes = "E5"

# ============================================================================
# SHEET 6 — Workout Briefs
# ============================================================================
ws = wb.create_sheet("Workout Briefs")
set_widths(ws, [16, 22, 26, 40, 30, 16, 34, 30, 34])
ws.sheet_view.showGridLines = False
title_block(ws, "WORKOUT BRIEFS",
            "The 'why' behind each training day — objective, adaptation, main work, overload, RPE, swaps.", span=9)
r = 4
header_row(ws, r, ["Day", "Objective", "Adaptation Target", "Main Work",
                   "Overload Strategy", "RPE", "Travel Alternative",
                   "No-Gym Alternative", "Coaching Notes"])
ws.row_dimensions[r].height = 30
briefs = [
    ("Mon — Chest + Biceps + Zone 2",
     "Build pressing strength & arm size while flushing legs with easy aerobic work.",
     "Pec & bicep hypertrophy; mitochondrial density (Zone 2).",
     "Bench, incline DB press, weighted dips, cable fly; EZ curl, incline curl, cable curl. Zone 2 ride 40-60 min.",
     "Add load on bench when 4x6 completed at RPE7; add a set to curls in Week 2.",
     "RPE 7-8 lifts; Zone 2 nose-breathing",
     "Hotel gym: DB bench + DB curls, same sets.",
     "Deep deficit push-ups, band curls, slow 4-sec tempo; brisk Zone 2 walk/jog.",
     "Keep cycle truly easy — it is recovery + base, not a second hard day."),
    ("Tue — Back + Triceps + VO2 Bike",
     "Develop vertical & horizontal pulling and drive VO2 max with bike intervals.",
     "Lat/upper-back hypertrophy; VO2 max & anaerobic power.",
     "Weighted pull-ups, barbell row, pulldown, face pull; CG bench, pushdown, OH extension. VO2: 5-6x3min @ 106-120% FTP / 3min easy.",
     "Progress pull-up load or reps; shorten interval recoveries in Peak week.",
     "RPE 8 on lifts; intervals 9/10 hard",
     "Hotel gym: DB row + bench dips; bike intervals on any stationary bike.",
     "Doorway/band rows, diamond push-ups; hill sprint repeats for VO2 stimulus.",
     "Fully recover between VO2 reps so you can hit the watts each interval."),
    ("Wed — Legs Volume + Easy Run",
     "Accumulate leg volume for size & work capacity; aerobic run to aid recovery.",
     "Quad/glute hypertrophy; aerobic base & running economy.",
     "Back squat, leg press, walking lunge, leg curl, calf raise (3-4 sets). Easy run 30-50 min conversational.",
     "Add reps before load on squat; build run duration 5 min/week.",
     "RPE 7 lifts; run Zone 2 easy",
     "Hotel gym: goblet squat, DB lunge, leg curl machine.",
     "Bulgarian split squat, step-ups, tempo squats; easy outdoor run.",
     "If legs are smoked, drop run to brisk walk — never skip the easy aerobic stimulus."),
    ("Thu — Shoulders + Threshold Cycle",
     "Build round, strong shoulders; raise functional threshold power.",
     "Deltoid hypertrophy; lactate threshold / FTP.",
     "OHP, lateral raise, rear-delt fly, upright row, shrugs. Threshold: 2-3x10-15min @ 91-105% FTP.",
     "Add load to OHP; extend threshold blocks by 2-3 min as fitness rises.",
     "RPE 8 lifts; threshold 'comfortably hard'",
     "Hotel gym: DB press + raises; threshold on stationary bike.",
     "Pike push-ups, band laterals, backpack press; sustained hill tempo on foot.",
     "Threshold should feel hard but controlled — you could speak only in short phrases."),
    ("Fri — Chest + Back Density + Hybrid",
     "Pack in pressing & pulling density, then finish with hybrid conditioning.",
     "Upper-body hypertrophy via density; work capacity & grip.",
     "Bench/row supersets, incline press, chest-supported row, fly + pulldown. Finisher: carries, burpees, lunges 12-15 min.",
     "Cut rest periods week to week; add rounds to the hybrid finisher.",
     "RPE 8 density; finisher 'sustainably hard'",
     "Hotel gym: DB density supersets + DB carries.",
     "Push-up/row ladders, loaded-bag carries, burpees, walking lunges.",
     "No rower — use carries, burpees and lunges for the conditioning stimulus."),
    ("Sat — Legs + Posterior Chain + Long Ride",
     "Train the posterior chain heavy, then build aerobic endurance on the bike.",
     "Hamstring/glute/back strength; aerobic endurance & fat oxidation.",
     "Deadlift/RDL, front squat, hip thrust, Nordic curl, back extension. Long ride Zone 2, build to 2-3h.",
     "Add load on deadlift in Progression; add 15-20 min to long ride weekly.",
     "RPE 7-8 lifts; ride Zone 2 endurance",
     "Hotel gym: DB RDL + hip thrust; long stationary ride.",
     "Single-leg RDL, hip bridges, back extensions; long Zone 2 ride or run.",
     "Fuel the long ride (carbs + fluids) — under-fuelling stalls fat loss via overreaching."),
    ("Sun — Arms + Core + Long Run",
     "Finish the week with arm pump, core strength and a long aerobic run.",
     "Arm hypertrophy; core stability; aerobic endurance.",
     "Barbell/hammer curl, skullcrusher, pushdown; hanging leg raise, plank, cable crunch, pallof. Long run 60-90 min easy.",
     "Add a set to arms; build long run 5-10 min/week, cap weekly mileage jumps at 10%.",
     "RPE 7 arms/core; run Zone 2 easy",
     "Hotel gym: DB arms + core circuit; long treadmill run.",
     "Band curls, dips, planks, pallof with band; long easy outdoor run.",
     "Long run is 80% of your easy volume — keep it genuinely easy to avoid injury."),
]
for i, b in enumerate(briefs):
    rr = r + 1 + i
    for c, val in enumerate(b, start=1):
        cell = ws.cell(rr, c, val)
        cell.alignment = LEFT_TOP
        cell.border = BORDER
        cell.font = BODY
    ws.cell(rr, 1).font = BODY_B
    ws.row_dimensions[rr].height = 92
    if i % 2 == 1:
        for c in range(1, 10):
            ws.cell(rr, c).fill = FILL_LIGHT2
ws.freeze_panes = "A5"

# ============================================================================
# SHEET 7 — Strength Progression
# ============================================================================
ws = wb.create_sheet("Strength Progression")
set_widths(ws, [4, 22, 14, 26, 26, 26, 26, 30])
ws.sheet_view.showGridLines = False
title_block(ws, "STRENGTH PROGRESSION",
            "Weekly wave strategy for core lifts + high-volume hypertrophy. 6 blocks x 4 weeks.", span=8)
r = 4
r = section(ws, r, "CORE LIFTS — WAVE LOADING (% of working max)", span=8)
header_row(ws, r, ["", "Lift", "Goal", "Wk1 Accumulation", "Wk2 Progression",
                   "Wk3 Peak", "Wk4 Deload", "Coaching Cue"])
r += 1
lifts = [
    ("Bench Press", "Maintain 105kg+ / grow", "4x6 @ 72-75%", "5x5 @ 77-80%",
     "5x5 @ 82-85% (RPE8)", "3x5 @ 65%", "Leg drive, controlled eccentric, full lockout."),
    ("Back Squat", "Maintain 140kg+ / grow", "4x6 @ 70%", "4x6 @ 75%",
     "5x5 @ 80% (RPE8)", "3x5 @ 60%", "Brace hard, depth below parallel, drive knees out."),
    ("Deadlift", "Posterior chain strength", "3x5 @ 70%", "4x4 @ 77%",
     "4x3 @ 85% (RPE8)", "2x5 @ 60%", "Neutral spine, push the floor away, lock hips."),
    ("Overhead Press", "Shoulder strength/size", "4x6 @ 70%", "5x5 @ 75%",
     "5x4 @ 82% (RPE8)", "3x5 @ 60%", "Glutes tight, bar over mid-foot, full lockout."),
    ("Weighted Pull-up", "Vertical pull strength", "4x6 added load", "4x8 / +load",
     "5x5 heavy (RPE8)", "3x6 bodyweight", "Full hang to chin over bar, control descent."),
]
for i, lf in enumerate(lifts):
    rr = r + i
    ws.cell(rr, 2, lf[0]).font = BODY_B
    for c in range(3, 9):
        ws.cell(rr, c, lf[c - 2]).font = BODY
    for c in range(2, 9):
        ws.cell(rr, c).border = BORDER
        ws.cell(rr, c).alignment = LEFT_TOP
    ws.row_dimensions[rr].height = 40
    if i % 2 == 1:
        for c in range(2, 9):
            ws.cell(rr, c).fill = FILL_LIGHT2
r += len(lifts) + 1

r = section(ws, r, "HIGH-VOLUME HYPERTROPHY (accessory engine)", span=8)
header_row(ws, r, ["", "Pattern", "Weekly Sets", "Rep Range", "Tempo / Method",
                   "Progression Rule", "Travel Swap", "Notes"])
r += 1
hyp = [
    ("Horizontal Push", "12-18", "8-15", "3-1-1, chase pump", "Add set/reps weekly until 18, then +load",
     "DB/Push-up variations", "Chest density Fri"),
    ("Horizontal Pull", "12-18", "8-15", "Squeeze 1s at peak", "Add reps before load",
     "DB row / band row", "Back thickness focus"),
    ("Vertical Push", "9-15", "8-15", "Strict, no momentum", "Progress lateral-raise volume",
     "Pike push-up / band", "Cap with deload"),
    ("Vertical Pull", "9-15", "6-12", "Full ROM", "Add load on weighted pull-up",
     "Band pulldown", "Lat width"),
    ("Quad", "12-18", "8-20", "Controlled, deep", "Reps before load on press/lunge",
     "Split squat / step-up", "Volume Wed"),
    ("Hamstring/Glute", "10-16", "8-15", "Slow eccentric", "Add Nordic reps / hip-thrust load",
     "Single-leg RDL / bridge", "Posterior chain Sat"),
    ("Arms (bi/tri)", "12-20", "8-15", "Constant tension", "Add a set in Wk2, drop in Wk4",
     "Band curls / dips", "Sunday arm day"),
    ("Core", "10-16", "8-20", "Anti-rotation focus", "Add load/duration weekly",
     "Plank / pallof band", "Daily option"),
]
for i, h in enumerate(hyp):
    rr = r + i
    ws.cell(rr, 2, h[0]).font = BODY_B
    for c in range(3, 9):
        ws.cell(rr, c, h[c - 2]).font = BODY
    for c in range(2, 9):
        ws.cell(rr, c).border = BORDER
        ws.cell(rr, c).alignment = LEFT_TOP
    ws.row_dimensions[rr].height = 32
    if i % 2 == 1:
        for c in range(2, 9):
            ws.cell(rr, c).fill = FILL_LIGHT2
r += len(hyp) + 1
ws.merge_cells(start_row=r, start_column=2, end_row=r, end_column=8)
ws.cell(r, 2, ("Deload weeks: cut strength volume ~40% (drop sets, keep a little intensity). "
               "Progressive overload = add a set, a rep, or a small load only where the prior week was completed cleanly.")).font = MUTED
ws.cell(r, 2).alignment = WRAP_TOP
ws.row_dimensions[r].height = 30
ws.freeze_panes = "A5"

# ============================================================================
# SHEET 8 — Cycling 80-20
# ============================================================================
ws = wb.create_sheet("Cycling 80-20")
set_widths(ws, [4, 20, 14, 16, 16, 22, 40])
ws.sheet_view.showGridLines = False
title_block(ws, "CYCLING — 80/20 POLARISED",
            "Power zones anchored to FTP 215W (baseline). ~80% easy Zone 2, ~20% hard.", span=7)
r = 4
r = section(ws, r, "POWER ZONES @ FTP 215W", span=7)
header_row(ws, r, ["", "Zone", "% FTP", "Watts @215", "Watts @275", "Feel", "Use"])
r += 1
zb = zones(215)
zt = zones(275)
zinfo = [
    ("Z1 Recovery", "50-55%", "Spinning, fully easy", "Warm-up, cooldown, recovery spins"),
    ("Z2 Endurance", "56-75%", "All-day, nose-breathing", "Bulk of weekly volume; Mon ride & Sat long ride"),
    ("Z3 Tempo", "76-90%", "Steady, working", "Sparingly — bridge efforts, sweet spot touches"),
    ("Z4 Threshold", "91-105%", "Comfortably hard", "Thursday threshold 2-3x10-15min"),
    ("Z5 VO2 Max", "106-120%", "Hard, breathless", "Tuesday VO2 5-6x3min"),
    ("Z6 Anaerobic", "121-150%", "Sprint / max", "Short neuromuscular bursts only"),
]
for i, (zn, pct, feel, use) in enumerate(zinfo):
    rr = r + i
    lo_b, hi_b = zb[zn]; lo_t, hi_t = zt[zn]
    ws.cell(rr, 2, zn).font = BODY_B
    ws.cell(rr, 3, pct).alignment = CTR
    ws.cell(rr, 4, f"{lo_b}-{hi_b} W").alignment = CTR
    ws.cell(rr, 5, f"{lo_t}-{hi_t} W").alignment = CTR
    ws.cell(rr, 6, feel)
    ws.cell(rr, 7, use)
    for c in range(2, 8):
        ws.cell(rr, c).border = BORDER
        ws.cell(rr, c).font = BODY if c != 2 else BODY_B
        if c in (6, 7):
            ws.cell(rr, c).alignment = LEFT_TOP
    ws.row_dimensions[rr].height = 26
# colour zone rows
zone_colors = ["E2EFDA", "C6E0B4", "FFE699", "F8CBAD", "F4B183", "E06666"]
for i in range(len(zinfo)):
    ws.cell(r + i, 2).fill = PatternFill("solid", fgColor=zone_colors[i])
r += len(zinfo) + 1

r = section(ws, r, "KEY SESSIONS", span=7)
header_row(ws, r, ["", "Session", "Day", "Structure", "Target Zone", "Duration", "Progression"])
r += 1
sessions = [
    ("Zone 2 Base", "Mon", "Steady aerobic, hold watts, cadence 85-95", "Z2 120-161W", "40-75 min", "Add 5-10 min/week"),
    ("VO2 Max", "Tue", "5-6 x 3 min hard / 3 min easy", "Z5 228-258W", "45-60 min", "Add a rep or trim recovery"),
    ("Threshold", "Thu", "2-3 x 10-15 min", "Z4 196-226W", "50-70 min", "Extend interval length"),
    ("Long Ride", "Sat", "Continuous endurance, fuel hourly", "Z2 120-161W", "90-180 min", "Add 15-20 min/week"),
]
for i, s in enumerate(sessions):
    rr = r + i
    ws.cell(rr, 2, s[0]).font = BODY_B
    for c in range(3, 8):
        ws.cell(rr, c, s[c - 2]).font = BODY
    for c in range(2, 8):
        ws.cell(rr, c).border = BORDER
        ws.cell(rr, c).alignment = LEFT_TOP
    ws.row_dimensions[rr].height = 30
    if i % 2 == 1:
        for c in range(2, 8):
            ws.cell(rr, c).fill = FILL_LIGHT2
r += len(sessions) + 1
ws.merge_cells(start_row=r, start_column=2, end_row=r, end_column=7)
ws.cell(r, 2, ("80/20 rule: ~80% of weekly riding time in Zone 2, ~20% in Z4-Z5. As FTP rises through the block, "
               "re-test every 4 weeks and recompute zones (watts in the '@275' column show the end-state targets).")).font = MUTED
ws.cell(r, 2).alignment = WRAP_TOP
ws.row_dimensions[r].height = 30
ws.freeze_panes = "A5"

# ============================================================================
# SHEET 9 — Running 80-20
# ============================================================================
ws = wb.create_sheet("Running 80-20")
set_widths(ws, [4, 18, 12, 26, 20, 18, 40])
ws.sheet_view.showGridLines = False
title_block(ws, "RUNNING — 80/20 + INJURY-PROOFING",
            "Build to a sub-27 5km. ~80% easy, ~20% quality. Cap mileage jumps at 10%/week.", span=7)
r = 4
r = section(ws, r, "RUN TYPES", span=7)
header_row(ws, r, ["", "Type", "% Volume", "Purpose", "Pace / Effort", "Day", "Progression"])
r += 1
runs = [
    ("Easy", "~70%", "Aerobic base, recovery, economy", "Conversational, Zone 2", "Wed",
     "Add 5 min/week; keep it truly easy"),
    ("Long", "~15%", "Endurance, fat oxidation, durability", "Easy-steady Zone 2", "Sun",
     "Add 5-10 min/week, cap +10% total"),
    ("Tempo", "~8%", "Lactate threshold, sustained speed", "Comfortably hard", "rotate",
     "Extend from 2x8 to 1x25 min"),
    ("Speed / VO2", "~7%", "Top-end speed, VO2 max, 5km pace", "Hard intervals", "rotate",
     "400/800m reps; add reps weekly"),
]
for i, rn in enumerate(runs):
    rr = r + i
    ws.cell(rr, 2, rn[0]).font = BODY_B
    for c in range(3, 8):
        ws.cell(rr, c, rn[c - 2]).font = BODY
    for c in range(2, 8):
        ws.cell(rr, c).border = BORDER
        ws.cell(rr, c).alignment = LEFT_TOP
    ws.row_dimensions[rr].height = 32
    if i % 2 == 1:
        for c in range(2, 8):
            ws.cell(rr, c).fill = FILL_LIGHT2
r += len(runs) + 1

r = section(ws, r, "5KM PROGRESSION (target by block)", span=7)
header_row(ws, r, ["", "Block", "Weeks", "5km Target", "Focus", "", ""])
r += 1
for blk in range(1, 7):
    rr = r + blk - 1
    wk_last = blk * 4
    ws.cell(rr, 2, f"Block {blk}").font = BODY_B
    ws.cell(rr, 3, f"{(blk-1)*4+1}-{blk*4}").alignment = CTR
    ws.cell(rr, 4, fivek_target(wk_last)).alignment = CTR
    focus = ["Aerobic base, form drills", "Easy volume up, light strides",
             "Tempo introduction", "Threshold blocks",
             "VO2 / 5km-pace reps", "Sharpen & test sub-27"][blk - 1]
    ws.merge_cells(start_row=rr, start_column=5, end_row=rr, end_column=7)
    ws.cell(rr, 5, focus).font = BODY
    for c in range(2, 8):
        ws.cell(rr, c).border = BORDER
        ws.cell(rr, c).alignment = CTR
    ws.cell(rr, 5).alignment = LEFT
    if blk % 2 == 0:
        for c in range(2, 8):
            ws.cell(rr, c).fill = FILL_LIGHT2
r += 6 + 1

r = section(ws, r, "INJURY-RISK GUIDANCE", span=7)
inj = [
    "Hold the 10% rule: never raise total weekly running volume by more than ~10% week to week.",
    "Keep 80% of runs genuinely easy — most running injuries come from too much intensity, too soon.",
    "Run on legs that are recovered: if HRV is down or recovery <5/10, swap quality for easy or rest.",
    "Strength work (Wed legs, Sat posterior chain) is injury insurance — do not skip it on heavy run weeks.",
    "Rotate two pairs of shoes, replace every ~600-800km, and prioritise calf/Achilles & hip mobility.",
    "Any sharp or escalating pain = stop. Substitute cycling/swim and reassess; never run through it.",
]
for line in inj:
    ws.merge_cells(start_row=r, start_column=2, end_row=r, end_column=7)
    ws.cell(r, 2, "•  " + line).font = BODY
    ws.cell(r, 2).alignment = WRAP_TOP
    ws.row_dimensions[r].height = 16
    r += 1
ws.freeze_panes = "A5"

# ============================================================================
# SHEET 10 — Hybrid System
# ============================================================================
ws = wb.create_sheet("Hybrid System")
set_widths(ws, [4, 22, 30, 18, 22, 40])
ws.sheet_view.showGridLines = False
title_block(ws, "HYBRID SYSTEM",
            "Carries, kettlebells, conditioning circuits & hybrid simulation. No rower required.", span=6)
r = 4
r = section(ws, r, "LOADED CARRIES", span=6)
header_row(ws, r, ["", "Carry", "How", "Load", "Distance / Time", "Adaptation"])
r += 1
carries = [
    ("Farmer's Carry", "DBs/KBs/handles at sides, tall posture", "Heavy", "4 x 40m",
     "Grip, traps, core, work capacity"),
    ("Front Rack Carry", "KBs/DBs racked at shoulders, brace", "Moderate", "4 x 30m",
     "Core stability, upper-back, breathing"),
    ("Suitcase Carry", "One-side load, resist lean", "Moderate", "3 x 30m/side",
     "Anti-lateral-flexion core, obliques"),
    ("Overhead Carry", "DB/KB locked overhead", "Light", "3 x 20m/side",
     "Shoulder stability, midline"),
    ("Sandbag/Bag Carry", "Bear hug a bag or backpack", "Heavy", "4 x 40m",
     "Travel-proof full-body carry"),
]
for i, cr in enumerate(carries):
    rr = r + i
    ws.cell(rr, 2, cr[0]).font = BODY_B
    for c in range(3, 7):
        ws.cell(rr, c, cr[c - 2]).font = BODY
    for c in range(2, 7):
        ws.cell(rr, c).border = BORDER
        ws.cell(rr, c).alignment = LEFT_TOP
    ws.row_dimensions[rr].height = 28
    if i % 2 == 1:
        for c in range(2, 7):
            ws.cell(rr, c).fill = FILL_LIGHT2
r += len(carries) + 1

r = section(ws, r, "KETTLEBELL & CONDITIONING CIRCUITS", span=6)
header_row(ws, r, ["", "Circuit", "Movements", "Format", "Duration", "Notes"])
r += 1
circuits = [
    ("KB Strength-Cardio", "Swing, goblet squat, clean & press, snatch", "EMOM / 40:20",
     "12-16 min", "Hinge power + conditioning, no rower needed"),
    ("Hybrid Finisher (Fri)", "Carries, burpees, walking lunges", "3-4 rounds",
     "12-15 min", "Sustainably hard; the week's signature conditioning"),
    ("Bodyweight Burner", "Burpees, push-ups, air squats, mtn climbers", "AMRAP",
     "10-12 min", "No-gym / hotel-room option"),
    ("Tabata Intervals", "Pick 1-2 moves (KB swing / burpee)", "20:10 x 8",
     "4-8 min", "Short, sharp metabolic hit"),
    ("Stair / Hill Repeats", "Carry or sprint stairs/hills", "8-12 reps",
     "15-20 min", "Loaded carries up, easy walk down"),
]
for i, c in enumerate(circuits):
    rr = r + i
    ws.cell(rr, 2, c[0]).font = BODY_B
    for cc in range(3, 7):
        ws.cell(rr, cc, c[cc - 2]).font = BODY
    for cc in range(2, 7):
        ws.cell(rr, cc).border = BORDER
        ws.cell(rr, cc).alignment = LEFT_TOP
    ws.row_dimensions[rr].height = 30
    if i % 2 == 1:
        for cc in range(2, 7):
            ws.cell(rr, cc).fill = FILL_LIGHT2
r += len(circuits) + 1

r = section(ws, r, "HYBRID SIMULATION (test your engine)", span=6)
ws.merge_cells(start_row=r, start_column=2, end_row=r+3, end_column=6)
sim = ("Every 4 weeks, run a hybrid test to track work capacity:\n"
       "•  Strength-endurance: 5 rounds of 10 KB swings + 10 push-ups + 40m farmer carry for time.\n"
       "•  Engine: 20 min AMRAP — 200m run / 8 burpees / 12 walking lunges.\n"
       "•  Log total rounds / time and compare each block. No rower — running, carries and burpees cover conditioning.")
ws.cell(r, 2, sim).font = BODY
ws.cell(r, 2).alignment = WRAP_TOP
ws.row_dimensions[r].height = 18
ws.freeze_panes = "A5"

# ============================================================================
# SHEET 11 — Travel Playbook
# ============================================================================
ws = wb.create_sheet("Travel Playbook")
set_widths(ws, [4, 22, 40, 40, 40])
ws.sheet_view.showGridLines = False
title_block(ws, "TRAVEL PLAYBOOK",
            "Never miss a session. Full gym, hotel gym, no gym — plus fatigue substitutions.", span=5)
r = 4
header_row(ws, r, ["", "Training Day", "Full Gym", "Hotel Gym", "No Gym / Room"])
r += 1
travel = [
    ("Mon — Chest+Bi+Z2",
     "Barbell bench, dips, cable fly, EZ curls + Zone 2 bike",
     "DB bench/incline, DB curls + stationary bike Zone 2",
     "Deficit push-ups, band curls, tempo work + brisk Zone 2 walk/jog"),
    ("Tue — Back+Tri+VO2",
     "Weighted pull-ups, rows, pushdowns + bike VO2 intervals",
     "DB rows, bench dips + bike intervals",
     "Doorway/band rows, diamond push-ups + hill sprint repeats"),
    ("Wed — Legs+Easy Run",
     "Squat, leg press, lunge, curl + easy run",
     "Goblet squat, DB lunge, leg curl + treadmill easy run",
     "Bulgarian split squat, step-ups, tempo squats + outdoor easy run"),
    ("Thu — Shoulders+Thresh",
     "OHP, laterals, rear delts + bike threshold",
     "DB press & raises + bike threshold",
     "Pike push-ups, band laterals, backpack press + hill tempo"),
    ("Fri — Density+Hybrid",
     "Bench/row supersets + carries/burpees/lunges",
     "DB density supersets + DB carries/burpees",
     "Push-up/row ladders + bag carries, burpees, lunges"),
    ("Sat — Legs PC+Long Ride",
     "Deadlift/RDL, hip thrust, Nordic + long ride",
     "DB RDL, hip thrust + long stationary ride",
     "Single-leg RDL, hip bridges + long Zone 2 ride or run"),
    ("Sun — Arms+Core+Long Run",
     "Curls, extensions, core + long run",
     "DB arms + core circuit + treadmill long run",
     "Band curls, dips, planks + long easy outdoor run"),
]
for i, t in enumerate(travel):
    rr = r + i
    ws.cell(rr, 2, t[0]).font = BODY_B
    for c in range(3, 6):
        ws.cell(rr, c, t[c - 2]).font = BODY
    for c in range(2, 6):
        ws.cell(rr, c).border = BORDER
        ws.cell(rr, c).alignment = LEFT_TOP
    ws.row_dimensions[rr].height = 46
    if i % 2 == 1:
        for c in range(2, 6):
            ws.cell(rr, c).fill = FILL_LIGHT2
r += len(travel) + 1

r = section(ws, r, "FATIGUE SUBSTITUTIONS (recovery <5/10 or HRV down)", span=5)
header_row(ws, r, ["", "Situation", "Swap To", "Why", "Keep"])
r += 1
fatigue = [
    ("Very low recovery", "Mobility + 20-30 min Zone 2 walk", "Protect the nervous system", "Sleep, hydration, protein"),
    ("Poor sleep (<6h)", "Drop top sets, cut volume 30-40%", "Avoid injury & junk fatigue", "Technique & easy aerobic"),
    ("Travel / jet-lag", "No-gym bodyweight + carries", "Maintain habit & stimulus", "Daily mobility & light"),
    ("Niggle / minor pain", "Swap painful pattern for pain-free", "Train around, not through", "Unaffected movements"),
    ("Sickness", "Rest or gentle walk only", "Recover fully before loading", "Hydration & sleep"),
]
for i, f in enumerate(fatigue):
    rr = r + i
    ws.cell(rr, 2, f[0]).font = BODY_B
    for c in range(3, 6):
        ws.cell(rr, c, f[c - 2]).font = BODY
    for c in range(2, 6):
        ws.cell(rr, c).border = BORDER
        ws.cell(rr, c).alignment = LEFT_TOP
    ws.row_dimensions[rr].height = 30
    if i % 2 == 1:
        for c in range(2, 6):
            ws.cell(rr, c).fill = FILL_LIGHT2
ws.freeze_panes = "A5"

# ============================================================================
# SHEET 12 — Exercise Library
# ============================================================================
ws = wb.create_sheet("Exercise Library")
set_widths(ws, [4, 24, 30, 26, 26, 26, 34])
ws.sheet_view.showGridLines = False
title_block(ws, "EXERCISE LIBRARY",
            "Every movement, its purpose, gym/hotel/no-gym equivalents and progression rule.", span=7)
r = 4
header_row(ws, r, ["", "Exercise", "Purpose", "Full Gym", "Hotel Gym", "No Gym", "Progression Rule"])
ws.row_dimensions[r].height = 28
lib = [
    ("Bench Press", "Horizontal press strength/size", "Barbell bench", "DB bench press", "Deficit push-up", "+2.5kg when 4x6 @ RPE7"),
    ("Incline DB Press", "Upper chest", "Incline DB press", "Incline DB press", "Feet-elevated push-up", "Add reps then load"),
    ("Weighted Dip", "Lower chest, triceps", "Dip belt", "Bench dip + pause", "Chair/parallel dips", "Add load weekly"),
    ("Cable Fly", "Chest isolation/pump", "Cable fly", "DB fly", "Band fly", "Add reps, constant tension"),
    ("Pull-up", "Vertical pull, lats", "Weighted pull-up", "Assisted/BW pull-up", "Doorway/towel row", "Add load or reps"),
    ("Barbell Row", "Horizontal pull, back thickness", "Barbell row", "DB row", "Band/backpack row", "+load when reps hit top"),
    ("Lat Pulldown", "Vertical pull volume", "Lat pulldown", "Band pulldown", "Band pulldown", "Add reps then load"),
    ("Face Pull", "Rear delts, shoulder health", "Cable face pull", "Band face pull", "Band pull-apart", "Daily-able, add reps"),
    ("Overhead Press", "Shoulder strength", "Barbell OHP", "DB press", "Backpack press", "+2.5kg when 5x5 clean"),
    ("Lateral Raise", "Side delts, width", "DB/cable raise", "DB raise", "Band lateral", "Add reps, strict form"),
    ("Back Squat", "Quad/glute strength", "Barbell squat", "Goblet squat", "Bulgarian split squat", "Reps before load"),
    ("Leg Press", "Quad volume", "Leg press", "DB squat", "Tempo squat / step-up", "Add load weekly"),
    ("Walking Lunge", "Unilateral legs", "Barbell/DB lunge", "DB lunge", "Bodyweight/loaded lunge", "Add distance/load"),
    ("Deadlift", "Posterior chain strength", "Barbell deadlift", "DB RDL", "Single-leg RDL", "+5kg in Progression wk"),
    ("Romanian Deadlift", "Hamstrings/glutes", "Barbell RDL", "DB RDL", "Single-leg RDL", "Slow eccentric, add load"),
    ("Hip Thrust", "Glute power", "Barbell hip thrust", "DB hip thrust", "Single-leg hip bridge", "Add load/reps"),
    ("Nordic Curl", "Hamstring eccentric", "Nordic/leg curl", "Partner/band Nordic", "Sliding leg curl", "Add reps slowly"),
    ("Calf Raise", "Calves, Achilles", "Standing calf raise", "DB calf raise", "Single-leg calf raise", "Add reps then load"),
    ("Barbell/DB Curl", "Biceps", "Barbell curl", "DB curl", "Band curl", "Add a set in wk2"),
    ("Skullcrusher", "Triceps", "EZ skullcrusher", "DB extension", "Band/bench dips", "Add reps then load"),
    ("Hanging Leg Raise", "Lower core", "Hanging leg raise", "Lying leg raise", "Lying leg raise", "Add reps / add load"),
    ("Plank / Pallof", "Anti-extension/rotation core", "Cable pallof", "Band pallof", "Plank holds", "Add time/load"),
    ("Loaded Carry", "Grip, core, work capacity", "Farmer handles", "DB/KB carry", "Bag/backpack carry", "Add load/distance"),
    ("Kettlebell Swing", "Hinge power, conditioning", "KB swing", "DB swing", "Backpack swing/jump", "Add reps/load"),
    ("Burpee", "Full-body conditioning", "Burpee", "Burpee", "Burpee", "Add reps / pace"),
]
for i, e in enumerate(lib):
    rr = r + 1 + i
    ws.cell(rr, 2, e[0]).font = BODY_B
    for c in range(3, 8):
        ws.cell(rr, c, e[c - 2]).font = BODY
    for c in range(2, 8):
        ws.cell(rr, c).border = BORDER
        ws.cell(rr, c).alignment = LEFT_TOP
    ws.row_dimensions[rr].height = 26
    if i % 2 == 1:
        for c in range(2, 8):
            ws.cell(rr, c).fill = FILL_LIGHT2
ws.freeze_panes = "A5"

# ============================================================================
# SHEET 13 — Daily Log
# ============================================================================
ws = wb.create_sheet("Daily Log")
set_widths(ws, [6, 6, 13, 12, 22, 16, 8, 12, 12, 10, 10, 34])
ws.sheet_view.showGridLines = False
title_block(ws, "DAILY LOG",
            "Editable training log. Dropdowns for completion & RPE. Pulls dates/focus from the plan.", span=12)
r = 4
header_row(ws, r, ["Day", "Wk", "Date", "Weekday", "Planned Focus", "Completed",
                   "RPE", "Weight kg", "Sleep h", "HRV", "Mood", "Notes"])
ws.row_dimensions[r].height = 28
log_start = r + 1
for d in range(168):
    rr = log_start + d
    date = START + dt.timedelta(days=d)
    weekday_idx = date.weekday()
    w = d // 7 + 1
    t = DAY_TEMPLATE[weekday_idx]
    ws.cell(rr, 1, d + 1).alignment = CTR
    ws.cell(rr, 2, w).alignment = CTR
    dc = ws.cell(rr, 3, date); dc.number_format = "ddd dd mmm"; dc.alignment = CTR
    ws.cell(rr, 4, t["name"]).alignment = CTR
    ws.cell(rr, 5, f"{t['focus']} + {t['endurance']}").alignment = LEFT
    for c in range(6, 12):
        ws.cell(rr, c).fill = FILL_INPUT
        ws.cell(rr, c).alignment = CTR
    ws.cell(rr, 12).alignment = LEFT_TOP
    for c in range(1, 13):
        ws.cell(rr, c).border = BORDER
        if not ws.cell(rr, c).font.bold:
            ws.cell(rr, c).font = BODY
    ws.row_dimensions[rr].height = 20
log_end = log_start + 167

# dropdowns
dv_comp2 = DataValidation(type="list", formula1='"Yes,No,Partial,Travel Alt"', allow_blank=True)
dv_rpe2 = DataValidation(type="whole", operator="between", formula1="1", formula2="10", allow_blank=True)
dv_mood = DataValidation(type="list", formula1='"Great,Good,OK,Tired,Drained"', allow_blank=True)
for dv in (dv_comp2, dv_rpe2, dv_mood):
    ws.add_data_validation(dv)
dv_comp2.add(f"F{log_start}:F{log_end}")
dv_rpe2.add(f"G{log_start}:G{log_end}")
dv_mood.add(f"K{log_start}:K{log_end}")

# conditional formatting
comp2 = f"F{log_start}:F{log_end}"
ws.conditional_formatting.add(comp2, CellIsRule(operator="equal", formula=['"Yes"'],
    fill=PatternFill("solid", fgColor="C6EFCE")))
ws.conditional_formatting.add(comp2, CellIsRule(operator="equal", formula=['"No"'],
    fill=PatternFill("solid", fgColor="FFC7CE")))
ws.conditional_formatting.add(comp2, CellIsRule(operator="equal", formula=['"Partial"'],
    fill=PatternFill("solid", fgColor="FFEB9C")))
ws.conditional_formatting.add(comp2, CellIsRule(operator="equal", formula=['"Travel Alt"'],
    fill=PatternFill("solid", fgColor="BDD7EE")))
ws.conditional_formatting.add(f"G{log_start}:G{log_end}",
    ColorScaleRule(start_type="num", start_value=1, start_color="C6EFCE",
                   mid_type="num", mid_value=6, mid_color="FFEB9C",
                   end_type="num", end_value=10, end_color="F8696B"))
ws.freeze_panes = "A5"

# ============================================================================
# SHEET 14 — Weekly Coach Review
# ============================================================================
ws = wb.create_sheet("Weekly Coach Review")
set_widths(ws, [4, 26, 16, 16, 16, 16, 40])
ws.sheet_view.showGridLines = False
title_block(ws, "WEEKLY COACH REVIEW",
            "Fill every Sunday. Track KPIs, compliance & set next-week adjustments. Repeat for 24 weeks.", span=7)
r = 4
header_row(ws, r, ["Wk", "Phase", "Weight kg", "FTP W", "Compliance %", "Avg RPE", "Notes / Adjustments"])
ws.row_dimensions[r].height = 26
rev_start = r + 1
for w in range(1, WEEKS + 1):
    rr = rev_start + w - 1
    wave = wave_for_week(w)
    ws.cell(rr, 1, w).alignment = CTR
    ws.cell(rr, 2, WAVE_NAMES[wave]).alignment = CTR
    ws.cell(rr, 2).fill = PatternFill("solid", fgColor=phase_fills[WAVE_NAMES[wave]])
    for c in range(3, 8):
        ws.cell(rr, c).fill = FILL_INPUT
    ws.cell(rr, 7).alignment = LEFT_TOP
    for c in range(1, 8):
        ws.cell(rr, c).border = BORDER
        if c != 2:
            ws.cell(rr, c).font = BODY
            if c < 7:
                ws.cell(rr, c).alignment = CTR
    ws.cell(rr, 2).font = BODY_B
    ws.row_dimensions[rr].height = 30
rev_end = rev_start + WEEKS - 1
ws.conditional_formatting.add(f"E{rev_start}:E{rev_end}",
    CellIsRule(operator="greaterThanOrEqual", formula=["90"],
               fill=PatternFill("solid", fgColor="C6EFCE")))
ws.conditional_formatting.add(f"E{rev_start}:E{rev_end}",
    CellIsRule(operator="lessThan", formula=["75"],
               fill=PatternFill("solid", fgColor="FFC7CE")))
ws.conditional_formatting.add(f"F{rev_start}:F{rev_end}",
    ColorScaleRule(start_type="num", start_value=4, start_color="C6EFCE",
                   mid_type="num", mid_value=7, mid_color="FFEB9C",
                   end_type="num", end_value=10, end_color="F8696B"))

# review prompt block
r = rev_end + 2
r = section(ws, r, "WEEKLY REVIEW PROMPTS", span=7)
prompts = [
    "Did I hit 90%+ of planned sessions? If not, what got in the way and how do I fix it?",
    "Are the core lifts progressing (set / rep / load) without RPE creeping past the cap?",
    "Is the 80/20 split holding — most easy, a little hard? Or am I drifting into grey-zone training?",
    "How is recovery trending (sleep, HRV, resting HR, mood)? Do I need an early deload?",
    "Weight & FTP vs roadmap target — ahead, on track, or behind? One adjustment for next week.",
]
for p in prompts:
    ws.merge_cells(start_row=r, start_column=2, end_row=r, end_column=7)
    ws.cell(r, 2, "•  " + p).font = BODY
    ws.cell(r, 2).alignment = WRAP_TOP
    ws.row_dimensions[r].height = 16
    r += 1
ws.freeze_panes = "A5"

# ============================================================================
# SHEET 15 — Claude Code Prompt
# ============================================================================
ws = wb.create_sheet("Claude Code Prompt")
set_widths(ws, [4, 110])
ws.sheet_view.showGridLines = False
title_block(ws, "CLAUDE CODE PROMPT", "The exact brief used to generate this workbook.", span=2)
PROMPT_TEXT = """Claude Code Prompt — Project 85 CEO Athlete System

You are Claude Code. Build a production-quality Excel workbook named `Project85_CEO_Athlete_System.xlsx`.

Create a 24-week hybrid athlete coaching workbook starting Monday 2026-06-22 for Barrie Davies (Bdog).

## Baseline and Targets
- Weight: 100kg -> 85kg
- FTP: 215W -> 275W
- VO2 Max: 41 -> 50+
- 5km: 32:00 -> 25:00-27:00
- Bench: 105kg, maintain 105kg+
- Squat: 140kg, maintain 140kg+

## Training Philosophy
- Progressive overload for strength and hypertrophy.
- 80/20 endurance model for running and cycling.
- Daily varying intensity to balance recovery and progress.
- High-volume strength sessions to add muscle and tendon density.
- Travel-proof alternatives for full gym, hotel gym, and no gym.
- Daily mobility and mindfulness.

## Weekly Structure
- Monday: Chest + Biceps + Zone 2 Cycle.
- Tuesday: Back + Triceps + VO2 Bike.
- Wednesday: Legs Volume + Easy Run.
- Thursday: Shoulders + Threshold Cycle.
- Friday: Chest + Back Density + Hybrid Carries/Burpees/Lunges.
- Saturday: Legs + Posterior Chain + Long Ride.
- Sunday: Arms + Core + Long Run.

## 4-Week Wave, Repeated 6 Times
- Week 1 Accumulation: high volume, RPE 7, 2-3 reps in reserve.
- Week 2 Progression: add one set, reps, or small load where prior week completed.
- Week 3 Peak Volume: highest density, RPE cap 8.
- Week 4 Deload: reduce strength volume 40%, endurance volume 40-50%.

## Required Workbook Sheets
1. START HERE: mission, baseline, targets, how to use.
2. Inputs: editable baseline variables and targets.
3. Executive Dashboard: KPIs including weight, FTP, FTP/kg, VO2, 5km, bench, squat, compliance, sleep, HRV, recovery.
4. 24 Week Roadmap: one row per week with phase, weight target, FTP target, strength strategy, endurance strategy, recovery guidance.
5. Daily Plan: 168 rows, one per day from 2026-06-22, with strength focus, workout, endurance/HIIT, intensity, mobility, mindfulness, travel alternative, coach brief, completion/RPE/notes.
6. Workout Briefs: detailed objectives, adaptation target, main work, overload strategy, RPE, travel alternatives, no-gym alternatives, coaching notes.
7. Strength Progression: weekly wave strategy for core lifts and high-volume hypertrophy.
8. Cycling 80-20: Zone 2, VO2, Threshold, Long Ride; include power targets based on FTP 215.
9. Running 80-20: Easy, Speed, Long, Tempo; include progression and injury-risk guidance.
10. Hybrid System: carries, kettlebells, conditioning circuits, hybrid simulation; no rower.
11. Travel Playbook: full gym, hotel gym, no gym, fatigue substitutions.
12. Exercise Library: exercise, purpose, gym/hotel/no-gym equivalents, progression rule.
13. Daily Log: editable training log with dropdowns for Completed Yes/No/Partial/Travel Alt and RPE 1-10.
14. Weekly Coach Review: weekly KPI and adjustment template.
15. Claude Code Prompt: include this prompt.

## Styling and Functionality
- Add formulas for FTP/kg and target progressions where practical.
- Use conditional formatting for intensity, compliance, and recovery.
- Freeze headers.
- Wrap text.
- Use sensible widths.
- Make the layout iPad-friendly.
- Keep it clean, coach-like, and practical."""
r = 4
for line in PROMPT_TEXT.split("\n"):
    cell = ws.cell(r, 2, line)
    cell.alignment = LEFT_TOP
    if line.startswith("## "):
        cell.font = H3
    elif line.startswith("Claude Code Prompt"):
        cell.font = BODY_B
    elif line and line[0].isdigit() and "." in line[:3]:
        cell.font = BODY
    else:
        cell.font = BODY
    ws.row_dimensions[r].height = 15
    r += 1
ws.freeze_panes = "A3"

# ----------------------------------------------------------------------------
# Workbook-level properties & save
# ----------------------------------------------------------------------------
wb.properties.title = "Project 85 — CEO Athlete System"
wb.properties.creator = "Project 85 Coaching"
wb.properties.subject = "24-Week Hybrid Athlete Program"

# Tab colours
tab_colors = {
    "START HERE": NAVY, "Inputs": TEAL, "Executive Dashboard": SLATE,
    "24 Week Roadmap": NAVY, "Daily Plan": ORANGE, "Workout Briefs": TEAL,
    "Strength Progression": SLATE, "Cycling 80-20": NAVY, "Running 80-20": TEAL,
    "Hybrid System": SLATE, "Travel Playbook": ORANGE, "Exercise Library": NAVY,
    "Daily Log": ORANGE, "Weekly Coach Review": SLATE, "Claude Code Prompt": GREY,
}
for name, color in tab_colors.items():
    wb[name].sheet_properties.tabColor = color

wb.active = wb["START HERE"]
out = "/home/user/Claude-Code-/Project85_CEO_Athlete_System.xlsx"
wb.save(out)
print("Saved:", out)
print("Sheets:", wb.sheetnames)
