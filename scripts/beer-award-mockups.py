"""Render the beer award skill mockups (synthetic data).

Usage: python3 beer-award-mockups.py OUTPUT_DIR
"""
import logging
import sys
from pathlib import Path

import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.colors import LinearSegmentedColormap

logging.getLogger("matplotlib.font_manager").setLevel(logging.ERROR)

OUT = Path(sys.argv[1] if len(sys.argv) > 1 else ".")
OUT.mkdir(parents=True, exist_ok=True)
rng = np.random.default_rng(7)

# Theme: reference palette from the dataviz skill (light mode)
SURFACE = "#fcfcfb"
INK = "#0b0b0b"
INK2 = "#52514e"
MUTED = "#898781"
GRID = "#e1e0d9"
AXIS = "#c3c2b7"
CONTEXT = "#d6d5ce"          # de-emphasized marks ("start with gray")
EMPH = "#2a78d6"             # slot 1 blue: the series that matters
EMPH2 = "#eb6834"            # slot 2 orange: a second named series
POS = "#e34948"              # diverging warm pole
NEG = "#2a78d6"              # diverging cool pole
SEQ = LinearSegmentedColormap.from_list(
    "seq", ["#f3f7fd", "#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#184f95", "#0d366b"])

plt.rcParams.update({
    "font.family": "sans-serif",
    "font.sans-serif": ["Helvetica Neue", "Helvetica", "Inter", "DejaVu Sans"],
    "font.size": 11,
    "text.color": INK,
    "axes.facecolor": SURFACE, "figure.facecolor": SURFACE, "savefig.facecolor": SURFACE,
    "axes.edgecolor": AXIS, "axes.linewidth": 0.8,
    "axes.labelcolor": INK2, "axes.labelsize": 11, "axes.labelpad": 8,
    "axes.spines.top": False, "axes.spines.right": False,
    "xtick.color": AXIS, "ytick.color": AXIS,
    "xtick.labelcolor": MUTED, "ytick.labelcolor": INK2,
    "xtick.labelsize": 10.5, "ytick.labelsize": 11,
    "xtick.major.size": 0, "ytick.major.size": 0, "xtick.major.pad": 6, "ytick.major.pad": 8,
    "grid.color": GRID, "grid.linewidth": 0.8,
    "lines.solid_capstyle": "round",
    "figure.dpi": 100, "savefig.dpi": 220,
})
NOTE = "Mockup, synthetic data. Source in production: official competition results, entrant lists, brewery tech sheets."


def hgrid(ax):
    ax.yaxis.grid(True)
    ax.set_axisbelow(True)
    ax.spines["left"].set_visible(False)


def vgrid(ax):
    ax.xaxis.grid(True)
    ax.set_axisbelow(True)
    ax.spines["left"].set_visible(False)


def finish(fig, title, subtitle, name, top=0.82, bottom=0.14, left=None):
    fig.subplots_adjust(top=top, bottom=bottom, **({"left": left} if left else {}))
    fig.text(0.015, 0.975, title, ha="left", va="top", fontsize=18, fontweight="bold", color=INK)
    fig.text(0.015, 0.975 - 0.075 * 5.0 / fig.get_figheight(), subtitle,
             ha="left", va="top", fontsize=12, color=INK2)
    fig.text(0.015, -0.035, NOTE, ha="left", va="top", fontsize=9, color=MUTED)
    fig.savefig(OUT / name, bbox_inches="tight", pad_inches=0.35)
    plt.close(fig)


# 01 dataset coverage report
comps = ["Great Lakes Regional Cup", "Pacific NW Brew Fest", "Northeast Brewers Open",
         "National Craft Awards", "World Beer Showcase"]
fields = ["Any ingredient", "Hops", "Malt", "Yeast", "Flavor notes", "Entrant list"]
cov = np.array([[82, 78, 61, 34, 88, 100], [76, 74, 52, 29, 81, 100], [71, 69, 48, 22, 79, 0],
                [64, 60, 44, 19, 72, 0], [58, 55, 39, 17, 66, 0]])
fig, ax = plt.subplots(figsize=(11, 4.8))
ax.imshow(cov, cmap=SEQ, vmin=0, vmax=110, aspect="auto")
for i in range(cov.shape[0]):
    for j in range(cov.shape[1]):
        v = cov[i, j]
        txt = ("Yes" if v else "No") if j == 5 else f"{v}%"
        ax.text(j, i, txt, ha="center", va="center", fontsize=12,
                color="white" if v >= 55 else INK)
ax.set_xticks(np.arange(cov.shape[1] + 1) - 0.5, minor=True)
ax.set_yticks(np.arange(cov.shape[0] + 1) - 0.5, minor=True)
ax.grid(which="minor", color=SURFACE, linewidth=3)
ax.tick_params(which="minor", length=0)
ax.set_xticks(range(len(fields)), fields)
ax.xaxis.tick_top()
ax.tick_params(axis="x", labelcolor=INK2, labelsize=11)
ax.set_yticks(range(len(comps)), comps)
for s in ax.spines.values():
    s.set_visible(False)
finish(fig, "Hop and flavor data cover most winners; yeast and entrant lists are the gaps",
       "Share of medal winners with each attribute sourced, by competition", "01-dataset-coverage-report.png",
       top=0.74)

# 02 concentration curves, small multiples
fig, axes = plt.subplots(1, 3, figsize=(13, 5), sharey=True)
for ax, (scope, a, n) in zip(axes, [("Regional", 2.0, 420), ("National", 1.4, 900),
                                     ("International", 0.9, 2400)]):
    w = rng.lognormal(0, a, n)
    medals = rng.multinomial(int(n * 1.2), w / w.sum())
    m = np.sort(medals)[::-1]
    x = np.arange(1, n + 1) / n
    y = np.cumsum(m) / m.sum()
    hgrid(ax)
    ax.plot([0, 1], [0, 1], color=CONTEXT, lw=1.2)
    ax.plot(x, y, color=EMPH, lw=2.2)
    k = int(0.1 * n) - 1
    ax.plot(x[k], y[k], "o", color=EMPH, ms=8, mec=SURFACE, mew=2)
    ax.annotate(f"Top 10% of beers\nhold {y[k]*100:.0f}% of medals", (x[k], y[k]),
                xytext=(0.32, y[k] - 0.2), fontsize=11, color=INK,
                arrowprops=dict(arrowstyle="-", color=MUTED, lw=0.8))
    ax.set_title(scope, loc="left", fontsize=13, fontweight="bold", color=INK, pad=12)
    ax.set_xticks([0, 0.5, 1], ["0%", "50%", "100%"])
    ax.set_yticks([0, 0.25, 0.5, 0.75, 1], ["0%", "25%", "50%", "75%", "100%"])
    ax.set_xlim(-0.02, 1.02)
    ax.set_ylim(0, 1.03)
    ax.text(0.98, 0.04, "even spread", rotation=0, ha="right", fontsize=9.5, color=MUTED,
            transform=ax.transAxes)
axes[1].set_xlabel("Share of entered beers, most medals first")
axes[0].set_ylabel("Cumulative share of medals")
finish(fig, "Medals concentrate most in regional competitions",
       "How medals are spread across entered beers, by competition scope", "02-analysis-concentration-curves.png",
       top=0.76)

# 03 repeat winners vs chance
exp_mid = np.array([9, 11, 14, 22, 38])
exp_lo = exp_mid - np.array([4, 4, 5, 6, 8])
exp_hi = exp_mid + np.array([4, 5, 5, 7, 9])
obs = np.array([27, 24, 25, 28, 41])
fig, ax = plt.subplots(figsize=(11, 4.8))
vgrid(ax)
for i in range(len(comps)):
    ax.plot([exp_lo[i], exp_hi[i]], [i, i], color=GRID, lw=12, solid_capstyle="round")
    ax.plot([exp_mid[i]] * 2, [i - 0.17, i + 0.17], color=MUTED, lw=1.5)
    out = obs[i] > exp_hi[i]
    c = EMPH if out else INK2
    ax.plot(obs[i], i, "o", color=c, ms=10, mec=SURFACE, mew=2)
    ax.text(obs[i] + 1.1, i, f"{obs[i]}", va="center", fontsize=11, color=INK, fontweight="bold" if out else "normal")
ax.text(exp_lo[0], -0.42, "Expected by chance", fontsize=10, color=MUTED, va="bottom")
ax.text(obs[0] + 1.1, -0.42, "Observed", fontsize=10, color=EMPH, va="bottom")
ax.set_yticks(range(len(comps)), comps)
ax.invert_yaxis()
ax.set_xlim(0, 52)
ax.set_xlabel("Beers winning medals in three or more years")
finish(fig, "Repeat winners exceed chance in all three regional competitions",
       "Observed repeat winners against a 95% range from random draws of entrants",
       "03-analysis-repeat-winners-vs-chance.png", top=0.78)

# 04 ingredient enrichment, diverging
ing = ["Citra", "Mosaic", "American ale yeast", "Galaxy", "Oat malt", "Nelson Sauvin", "Pilsner malt",
       "Crystal 60", "Simcoe", "Munich malt", "Kveik", "English ale yeast", "Cascade", "Brett", "Chinook",
       "Crystal 120"]
lo = np.array([0.82, 0.65, 0.58, 0.34, 0.31, 0.12, -0.08, -0.15, -0.05, -0.22, -0.48, -0.40, -0.55, -0.70,
               -0.38, -0.92])
mid = lo + np.array([0.2, 0.2, 0.15, 0.25, 0.2, 0.3, 0.2, 0.25, 0.3, 0.2, 0.3, 0.2, 0.2, 0.25, 0.32, 0.25])
order = np.argsort(mid)
fig, ax = plt.subplots(figsize=(11, 7))
vgrid(ax)
for r, i in enumerate(order):
    l, m = lo[i], mid[i]
    h = m + (m - l)
    sig = l > 0 or h < 0
    col = (POS if m > 0 else NEG) if sig else CONTEXT
    ax.barh(r, m, color=col, height=0.62)
    ax.plot([l, h], [r, r], color=INK2, lw=1)
ax.axvline(0, color=INK2, lw=1)
ax.set_yticks(range(len(ing)), [ing[i] for i in order])
ax.set_xlim(-1.05, 1.3)
ax.set_xlabel("Log odds of appearing in winners versus entrants in the same category")
ax.text(0.03, 15.75, "More common among winners  →", color=POS, fontsize=11, ha="left", va="bottom")
ax.text(-0.03, 15.75, "←  Less common", color=NEG, fontsize=11, ha="right", va="bottom")
ax.set_ylim(-0.6, 16.4)
finish(fig, "Four hops, oat malt, and American ale yeast are overrepresented among winners",
       "Ingredient enrichment with 95% intervals; gray bars are not distinguishable from zero",
       "04-analysis-ingredient-enrichment.png", top=0.84)

# 05 slope: share of entrants to share of winners
pairs = {"Citra": (31, 58), "Mosaic": (24, 44), "American ale yeast": (40, 61), "Galaxy": (12, 21),
         "Simcoe": (26, 28), "Centennial": (22, 20), "Cascade": (28, 15), "English ale yeast": (19, 9),
         "Chinook": (14, 11)}
emph = {"Citra": EMPH, "Mosaic": EMPH, "American ale yeast": EMPH, "Cascade": EMPH2}
nudge_r = {"Galaxy": 22.6, "Centennial": 18.8}
fig, ax = plt.subplots(figsize=(9, 7.5))
for k, (a, b) in sorted(pairs.items(), key=lambda kv: kv[0] in emph):
    c = emph.get(k, CONTEXT)
    tc = emph.get(k, MUTED)
    lw = 2.6 if k in emph else 1.4
    ax.plot([0, 1], [a, b], color=c, lw=lw, marker="o", ms=6, mec=SURFACE, mew=1.5)
    fw = "bold" if k in emph else "normal"
    ax.text(-0.05, a, f"{k}  {a}%", ha="right", va="center", fontsize=11, color=tc, fontweight=fw)
    ax.text(1.05, nudge_r.get(k, b), f"{b}%  {k}", ha="left", va="center", fontsize=11, color=tc, fontweight=fw)
ax.set_xlim(-0.75, 1.75)
ax.set_xticks([0, 1], ["Share of entrants", "Share of winners"])
ax.tick_params(axis="x", labelcolor=INK2, labelsize=12)
ax.set_yticks([])
for s in ["left", "bottom"]:
    ax.spines[s].set_visible(False)
finish(fig, "Citra appears in 31% of IPA entries but 58% of IPA medals",
       "American IPA category, all competitions pooled, 2016 to 2025", "05-viz-slope-entrants-to-winners.png",
       top=0.86, bottom=0.1)

# 06 ingredient by year heatmap
years = list(range(2016, 2026))
rows = ["Citra", "Mosaic", "American ale yeast", "Galaxy", "Oat malt", "Simcoe", "Pilsner malt",
        "Munich malt", "Crystal 60", "Cascade", "English ale yeast", "Crystal 120"]
base = np.array([35, 22, 50, 8, 12, 28, 30, 20, 22, 30, 20, 14])
trend = np.array([3, 3, 1.5, 1.5, 2, 0, 0, -0.5, -1, -1.8, -1.2, -1])
H = np.clip(base[:, None] + trend[:, None] * np.arange(10) + rng.normal(0, 2.5, (12, 10)), 0, 100)
fig, ax = plt.subplots(figsize=(12, 6.4))
ax.imshow(H, cmap=SEQ, vmin=0, vmax=75, aspect="auto")
for i in range(12):
    for j in range(10):
        ax.text(j, i, f"{H[i, j]:.0f}", ha="center", va="center", fontsize=10.5,
                color="white" if H[i, j] > 38 else INK)
ax.set_xticks(np.arange(11) - 0.5, minor=True)
ax.set_yticks(np.arange(13) - 0.5, minor=True)
ax.grid(which="minor", color=SURFACE, linewidth=2.5)
ax.tick_params(which="minor", length=0)
ax.set_xticks(range(10), years)
ax.set_yticks(range(12), rows)
for s in ax.spines.values():
    s.set_visible(False)
finish(fig, "Mosaic winners more than doubled in a decade while Cascade halved",
       "Percent of medal winners containing each ingredient, by year; rows sorted by overall enrichment",
       "06-viz-ingredient-heatmap.png", top=0.82)

# 07 IBU strip plots
cats = [("American IPA", 62, 12, 64, 5), ("American Pale Ale", 40, 9, 42, 4),
        ("Stout", 45, 14, 44, 10), ("German Pilsner", 32, 6, 33, 4)]
fig, axes = plt.subplots(4, 1, figsize=(11, 8), sharex=True, gridspec_kw={"hspace": 0.75})
for ax, (c, em, es, wm, ws) in zip(axes, cats):
    e = rng.normal(em, es, 160)
    w = rng.normal(wm, ws, 24)
    vgrid(ax)
    ax.scatter(e, rng.uniform(-0.3, 0.3, 160), s=16, color=CONTEXT, lw=0)
    ax.scatter(w, rng.uniform(-0.3, 0.3, 24), s=34, color=EMPH, edgecolor=SURFACE, lw=1)
    ax.set_yticks([])
    ax.set_ylim(-0.45, 0.45)
    ax.text(0, 1.08, c, transform=ax.transAxes, fontsize=12.5, fontweight="bold", color=INK, va="bottom")
    ax.text(1, 1.08, f"Spread (sd): entrants {es} IBU, winners {ws} IBU", transform=ax.transAxes,
            ha="right", va="bottom", fontsize=10.5, color=INK2)
axes[-1].set_xlabel("Bitterness (IBU)")
finish(fig, "Winners sit in a narrow bitterness band, except in stout",
       "Each dot is one beer: blue won a medal, gray entered and did not", "07-viz-ibu-winners-vs-entrants.png",
       top=0.84, bottom=0.1)

# 08 flavor clusters
centers = {"Tropical, resinous": (3.2, 3), "Bready, toasty": (-3.2, 3), "Roast, chocolate": (-3.2, -3),
           "Crisp, floral": (3.2, -3)}
fig, ax = plt.subplots(figsize=(10, 7.5))
for lab, (cx, cy) in centers.items():
    ax.scatter(rng.normal(cx, 1.0, 120), rng.normal(cy, 1.0, 120), s=16, color=CONTEXT, lw=0)
for lab, (cx, cy) in centers.items():
    hot = lab == "Tropical, resinous"
    tight, nwin = (0.35, 40) if hot else (0.7, 10)
    ax.scatter(rng.normal(cx, tight, nwin), rng.normal(cy, tight, nwin), s=40,
               color=EMPH if hot else INK2, edgecolor=SURFACE, lw=1)
    ax.text(cx, cy + 2.7, lab, ha="center", fontsize=12.5, fontweight="bold", color=EMPH if hot else INK)
ax.set_xticks([])
ax.set_yticks([])
ax.spines["left"].set_visible(False)
ax.spines["bottom"].set_visible(False)
ax.set_xlabel("Flavor similarity, dimension 1")
ax.set_ylabel("Dimension 2")
finish(fig, "Hazy and IPA winners collapse into one tropical flavor cluster",
       "Beers placed by similarity of flavor descriptors; blue and dark dots won medals, gray entered only",
       "08-viz-flavor-clusters.png", top=0.86, bottom=0.08)

# 09 bump chart
br = ["Ridgeline Brewing", "Copper Kettle Works", "North Fork Ales", "Harbor Light", "Oak and Ash",
      "Stonegate", "Little Wolf", "Mill Street Barrel"]
cols = []
for t in range(10):
    score = rng.normal(0, 1.2, 8)
    score[0] = -5 + t * 1.2 if t < 5 else 10
    score[1] = 3 - t * 0.3 + rng.normal(0, 0.5)
    cols.append(np.argsort(np.argsort(-score)) + 1)
ranks = np.array(cols).T
fig, ax = plt.subplots(figsize=(12, 6))
for i in list(range(2, 8)) + [1, 0]:
    c = EMPH if i == 0 else (EMPH2 if i == 1 else CONTEXT)
    lw = 3 if i < 2 else 1.4
    ax.plot(years, ranks[i], color=c, lw=lw, marker="o", ms=7 if i < 2 else 5, mec=SURFACE, mew=1.5, zorder=3 if i < 2 else 2)
    ax.text(2025.35, ranks[i, -1], br[i], va="center", fontsize=11,
            color=c if i < 2 else MUTED, fontweight="bold" if i < 2 else "normal")
ax.invert_yaxis()
ax.set_yticks(range(1, 9), [f"#{r}" for r in range(1, 9)])
ax.tick_params(axis="y", labelcolor=MUTED)
ax.spines["left"].set_visible(False)
ax.set_xticks(years)
ax.set_xlim(2015.6, 2027.9)
finish(fig, "Ridgeline Brewing has held first place since 2021",
       "Brewery rank by medals won, Great Lakes Regional Cup, top eight breweries",
       "09-viz-brewery-rank-bump.png", top=0.82)

# 10 medals per entry
bnames = ["Ridgeline Brewing", "Copper Kettle Works", "North Fork Ales", "Harbor Light", "Oak and Ash",
          "Stonegate", "Little Wolf", "Mill Street Barrel", "Blue Heron", "Old Quarry", "Fieldstone",
          "Lantern Hill", "Twin Rivers", "Granite Peak", "Cedar Row"]
v = np.sort(rng.uniform(0.08, 0.3, 15))[::-1]
v[:3] = [0.61, 0.52, 0.47]
fig, ax = plt.subplots(figsize=(10, 7))
vgrid(ax)
for r, (b, x) in enumerate(zip(bnames, v)):
    top3 = r < 3
    c = EMPH if top3 else MUTED
    ax.plot([0, x], [r, r], color=EMPH if top3 else CONTEXT, lw=2 if top3 else 1.4)
    ax.plot(x, r, "o", color=c, ms=8, mec=SURFACE, mew=1.5)
    ax.text(x + 0.013, r, f"{x:.2f}", va="center", fontsize=10.5, color=INK if top3 else INK2,
            fontweight="bold" if top3 else "normal")
ax.set_yticks(range(15), bnames)
for t, lab in enumerate(ax.get_yticklabels()):
    if t < 3:
        lab.set_color(INK)
        lab.set_fontweight("bold")
ax.invert_yaxis()
ax.set_xlim(0, 0.72)
ax.set_xlabel("Medals per beer entered, 2016 to 2025")
finish(fig, "Three breweries win a medal on about half of what they enter",
       "Top 15 breweries by medals per entry, all regional competitions pooled",
       "10-viz-medals-per-entry.png", top=0.85)

# 11 price before and after a medal
pre = rng.normal(100, 6, 14)
post = pre + rng.normal(9, 6, 14)
lift = post.mean() - pre.mean()
fig, ax = plt.subplots(figsize=(9, 7))
hgrid(ax)
for a, b in zip(pre, post):
    ax.plot([0, 1], [a, b], color=CONTEXT, lw=1.4, marker="o", ms=5, mec=SURFACE, mew=1)
ax.plot([0, 1], [pre.mean(), post.mean()], color=EMPH, lw=3.2, marker="o", ms=9, mec=SURFACE, mew=2)
ax.text(1.06, post.mean(), f"Average\n+{lift:.0f}%", va="center", color=EMPH, fontsize=12, fontweight="bold")
ax.text(1.06, max(post), "One beer", va="center", color=MUTED, fontsize=10)
ax.set_xticks([0, 1], ["Year before medal", "Year after medal"])
ax.tick_params(axis="x", labelcolor=INK2, labelsize=11.5)
ax.tick_params(axis="y", labelcolor=MUTED)
ax.set_xlim(-0.25, 1.4)
ax.set_ylabel("Shelf price index (year before = 100)")
finish(fig, f"Gold medal beers raise shelf price about {lift:.0f}% the next year",
       "Gold medal winners with retail price data, one line per beer",
       "11-viz-marketing-price-after-medal.png", top=0.84)
print("done", OUT)
