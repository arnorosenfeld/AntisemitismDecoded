# Jewish American Demographic Segment Analysis
## Political Center Scores and Comfort Ranges for Game Design

**Date:** 2026-03-19 (updated)
**Data Sources:**
- Pew Research Center, "Jewish Americans in 2020" Extended Dataset (n=5,881, weighted)
- JVRC National Jewish Survey, April 21 - May 1, 2025 (n~800, crosstabs)

---

## Final Game-Ready Scores

| Segment | US Center (0-100) | US Comfort (±) | Israel Center (0-100) | Israel Comfort (±) |
|---|---|---|---|---|
| **Orthodox** | 66 | ±29 | 65 | ±20 |
| **Conservative** | 44 | ±33 | 61 | ±18 |
| **Reform** | 33 | ±26 | 52 | ±23 |
| **Unaffiliated** | 39 | ±31 | 47 | ±24 |
| **Young Jews (18-29)** | 36 | ±30 | 45 | ±27 |
| **Older Jews (65+)** | 40 | ±33 | 55 | ±23 |

**Scale:** US Politics: 0 = far left, 50 = center, 100 = far right.
Israel Politics: 0 = very dovish/critical of Israel, 50 = center, 100 = very hawkish/pro-Israel.

**Comfort Range:** How far from the segment's center a position can be before the segment gets uncomfortable. Calculated as 1.5x weighted standard deviation of the individual-level composite score distribution.

**Israel score range: 45-65 (20 points)** — up from previous 47-61 (14 points).
**US score range: 33-66 (33 points).**

---

## Methodology Overview

### Blending Strategy
- **Denomination segments:** 70% Pew 2020 / 30% JVRC 2025
- **Age segments:** 60% Pew 2020 / 40% JVRC 2025 (Pew weighted higher because its age brackets — 18-29 and 65+ — more closely match the target definitions; JVRC's Under 35 and Over 64 are slightly wider/narrower)

### U.S. Political Center: Composite Formula
**50% PARTY + 50% IDEO**

PARTY mapping: Republican=80, Democrat=20, Independent/Other=50.
IDEO mapping: Very Conservative=90, Conservative=75, Moderate=50, Liberal=25, Very Liberal=10.

### Israel Political Center: Composite Formula (Updated)
**30% ATTISR + 25% ISUPP + 20% PEACE1 + 15% BDS2 + 10% COEX**

Five variables now used instead of four, with BDS2 (opinion on BDS movement) added as a direct hawkish/dovish indicator:

| Variable | Weight | Mapping |
|---|---|---|
| ATTISR (attachment) | 30% | Very attached=85, Somewhat=65, Not too=35, Not at all=10 |
| ISUPP (US support level) | 25% | Too supportive=15, About right=55, Not supportive enough=90 |
| PEACE1 (sincere peace effort) | 20% | Yes=65, No=40 |
| BDS2 (BDS opinion) | 15% | Support=15, Oppose=80 |
| COEX (coexistence possible) | 10% | Yes=40, No=65 |

**JVRC Israel formula:** 40% Attachment + 35% Military Action Framing + 25% Hostage Assessment

The mapping values were chosen to maximize the spread across segments while staying anchored to the directional meaning of each response. Key design choices:
- ATTISR gets the widest range (10-85) because attachment is the strongest differentiator across segments
- BDS2 has a strong directional signal: supporting BDS is very dovish (15), opposing is hawkish (80)
- PEACE1 and COEX have narrower ranges because they show less denominational variation
- The +3 Oct 7 adjustment has been removed — the JVRC blending already captures post-Oct 7 shifts

### Comfort Range Calculation
Comfort Range = 1.5 x weighted standard deviation of the composite score distribution (from Pew individual-level data). A wider SD means the group is more internally diverse, and thus tolerates a wider range of positions.

---

## Detailed Analysis by Segment

---

### 1. Orthodox Jews

**Pew 2020 sample:** n=462 | **JVRC 2025 sample:** n~72

#### U.S. Politics
**Pew:** PARTY=80% right-leaning, IDEO=66.5 center-right -> US composite = 63.4
**JVRC:** Harris therm=20, Trump therm=64 -> US score = 72.0
**Blended (70/30):** 66

#### Israel Politics

| Variable | Distribution | Component Score |
|---|---|---|
| ATTISR | Very 61.6%, Somewhat 19.9%, Not too 12.4%, Not at all 6.0% | 70.3 |
| ISUPP | Too supportive 11.1%, About right 69.4%, Not enough 19.5% | 57.4 |
| PEACE1 | Yes 61.0%, No 39.0% | 55.3 |
| BDS2 | Support 9.4%, Oppose 90.5% | 73.9 |
| COEX | Yes 38.4%, No 61.6% | 55.4 |

**Pew Israel Composite: 63.1** | **JVRC Israel: 69.1** | **Blended: 65**

Orthodox Jews are the most hawkish segment on every Israel variable. They have the highest attachment (62% very attached), strongest BDS opposition (91%), and most skepticism about coexistence (62% say no). JVRC data shows even stronger hawkish positioning with 77% prioritizing Israel's national security over Netanyahu's politics, and 70% believing hostages are more likely to be released (i.e., trusting Israeli military approach).

---

### 2. Conservative Jews

**Pew 2020 sample:** n=1,042 | **JVRC 2025 sample:** n~136

#### U.S. Politics
**Pew:** US composite = 43.9 | **JVRC:** US = 43.5 | **Blended: 44**

#### Israel Politics

| Variable | Distribution | Component Score |
|---|---|---|
| ATTISR | Very 42.1%, Somewhat 35.6%, Not too 17.6%, Not at all 4.7% | 65.5 |
| ISUPP | Too supportive 7.5%, About right 69.8%, Not enough 22.7% | 59.9 |
| PEACE1 | Yes 49.1%, No 50.9% | 52.3 |
| BDS2 | Support 9.2%, Oppose 90.8% | 74.0 |
| COEX | Yes 60.2%, No 39.8% | 49.9 |

**Pew Israel Composite: 61.2** | **JVRC Israel: 60.1** | **Blended: 61**

Conservative Jews are nearly as hawkish as Orthodox on BDS (91% oppose) and US support for Israel, but more moderate on attachment and coexistence. The Pew and JVRC scores converge remarkably closely (61.2 vs 60.1), suggesting stability in this segment's Israel positioning. JVRC shows 96% attached to Israel post-Oct 7 (up from ~78% in 2020).

---

### 3. Reform Jews

**Pew 2020 sample:** n=1,899 | **JVRC 2025 sample:** n~296

#### U.S. Politics
**Pew:** US composite = 34.5 | **JVRC:** US = 28.5 | **Blended: 33**

#### Israel Politics

| Variable | Distribution | Component Score |
|---|---|---|
| ATTISR | Very 22.0%, Somewhat 34.3%, Not too 30.6%, Not at all 13.2% | 53.0 |
| ISUPP | Too supportive 22.9%, About right 55.5%, Not enough 21.5% | 53.4 |
| PEACE1 | Yes 28.4%, No 71.6% | 47.1 |
| BDS2 | Support 16.7%, Oppose 83.4% | 69.2 |
| COEX | Yes 67.7%, No 32.3% | 48.1 |

**Pew Israel Composite: 53.8** | **JVRC Israel: 47.4** | **Blended: 52**

Reform Jews sit near the center on Israel. They are notably more dovish than Conservative/Orthodox on attachment (only 22% very attached vs 42-62%) and more critical of Israel's peace efforts (72% say no). However, they still oppose BDS at 83%, keeping them from the dovish extreme. The JVRC data pulls them further dovish (47.4) due to 67% Netanyahu unfavorability and only 23% trusting Israel's military framing.

---

### 4. Unaffiliated Jews

**Pew 2020 sample:** n=1,434 | **JVRC 2025 sample:** n~280

#### U.S. Politics
**Pew:** US composite = 41.8 | **JVRC:** US = 31.5 | **Blended: 39**

#### Israel Politics

| Variable | Distribution | Component Score |
|---|---|---|
| ATTISR | Very 13.5%, Somewhat 30.7%, Not too 29.3%, Not at all 26.6% | 44.3 |
| ISUPP | Too supportive 29.2%, About right 50.9%, Not enough 19.9% | 50.3 |
| PEACE1 | Yes 33.9%, No 66.1% | 48.5 |
| BDS2 | Support 33.1%, Oppose 66.8% | 58.4 |
| COEX | Yes 69.3%, No 30.7% | 47.7 |

**Pew Israel Composite: 49.1** | **JVRC Israel: 42.5** | **Blended: 47**

Unaffiliated Jews are the second-most dovish segment. They have the lowest attachment of any denominational group (only 14% very attached, 27% not at all) and the highest BDS support rate (33% — still a minority but notably higher than other groups). Their BDS opinion score (58.4) is 15 points below Orthodox/Conservative (74), which is the single biggest driver of differentiation in the new formula. JVRC shows 70% attributing military action to Netanyahu's politics rather than security.

---

### 5. Young Jews (18-29)

**Pew 2020 sample:** n=554 (AGE4CAT == '18-29') | **JVRC 2025 sample:** n~208 (Under 35)

#### U.S. Politics
**Pew:** US composite = 38.7 | **JVRC:** US = 31.0 | **Blended (60/40): 36**

#### Israel Politics

| Variable | Distribution | Component Score |
|---|---|---|
| ATTISR | Very 16.4%, Somewhat 24.9%, Not too 28.9%, Not at all 29.9% | 43.2 |
| ISUPP | Too supportive 33.9%, About right 39.2%, Not enough 26.9% | 50.8 |
| PEACE1 | Yes 27.4%, No 72.6% | 46.8 |
| BDS2 | Support 43.1%, Oppose 56.9% | 52.0 |
| COEX | Yes 73.5%, No 26.5% | 46.6 |

**Pew Israel Composite: 47.5** | **JVRC Israel: 41.4** | **Blended (60/40): 45**

Young Jews are the most dovish segment, driven primarily by two factors: (1) the highest BDS support rate at 43% (vs 9% for Orthodox), giving a BDS2 component of just 52.0 — 22 points below Orthodox; and (2) the lowest attachment at only 16% very attached with 30% not at all attached. The JVRC data pushes even more dovish (41.4), with only 23% framing military action as security-driven and 77% seeing it as driven by Netanyahu's politics — the most critical framing of any segment.

---

### 6. Older Jews (65+)

**Pew 2020 sample:** n=2,336 (AGE4CAT == '65+') | **JVRC 2025 sample:** n~216 (Over 64)

#### U.S. Politics
**Pew:** US composite = 42.9 | **JVRC:** US = 35.0 | **Blended (60/40): 40**

#### Israel Politics

| Variable | Distribution | Component Score |
|---|---|---|
| ATTISR | Very 25.9%, Somewhat 34.3%, Not too 23.3%, Not at all 16.5% | 54.2 |
| ISUPP | Too supportive 18.5%, About right 62.5%, Not enough 19.0% | 54.3 |
| PEACE1 | Yes 40.5%, No 59.5% | 50.1 |
| BDS2 | Support 12.2%, Oppose 87.8% | 72.1 |
| COEX | Yes 60.8%, No 39.2% | 49.8 |

**Pew Israel Composite: 55.6** | **JVRC Israel: 53.4** | **Blended (60/40): 55**

Older Jews are moderately hawkish, sitting between Conservative (61) and Reform (52). They have strong BDS opposition (88%) similar to Conservative Jews, but lower attachment than either Conservative or Orthodox segments. JVRC shows 79% attached, 45% prioritizing security framing, and 42% favorable toward Netanyahu — notably higher than younger cohorts.

---

## Key Observations for Game Design

1. **Israel scores now span 20 points (45-65)**, up from 14 points (47-61). The key driver of this wider spread is BDS2 — opinion on the BDS movement varies dramatically by segment (9% support among Orthodox vs 43% among Young Jews) and maps to a wide score range (15 vs 80).

2. **Orthodox is the outlier on both dimensions** — US politics (66, rightward) and Israel (65, hawkish). They are the only segment right of center on US politics.

3. **Young Jews (45) and Unaffiliated (47) cluster as the dovish pole**, while Orthodox (65) and Conservative (61) form the hawkish pole. Reform (52) and Older Jews (55) sit in the middle.

4. **The generational gap on Israel is 10 points** (Young 45 vs Older 55), reflecting real differences in attachment and BDS attitudes. This is narrower than the denominational gap (Orthodox 65 vs Unaffiliated 47 = 18 points).

5. **Comfort ranges are tighter than before** (18-27 for Israel, 26-33 for US), calculated purely from individual-level Pew data using 1.5x weighted standard deviation. Orthodox has the tightest Israel comfort range (±20), meaning they react most sharply to dovish moves. Young Jews have the widest (±27), reflecting their internal diversity.

6. **Conservative Jews are the pivot segment** — they sit at 44 on US politics (near center) and 61 on Israel (hawkish but not extreme). Their moderate US positioning combined with strong Israel hawkishness creates interesting gameplay tension.

---

## Changes from Previous Version

| Segment | Old Israel | New Israel | Change | Old US | New US | Change |
|---|---|---|---|---|---|---|
| Orthodox | 61 | 65 | +4 | 64 | 66 | +2 |
| Conservative | 61 | 61 | 0 | 44 | 44 | 0 |
| Reform | 51 | 52 | +1 | 32 | 33 | +1 |
| Unaffiliated | 47 | 47 | 0 | 36 | 39 | +3 |
| Young Jews | 47 | 45 | -2 | 35 | 36 | +1 |
| Older Jews | 54 | 55 | +1 | 41 | 40 | -1 |

Key formula changes:
- Added BDS2 (opinion on BDS, 15% weight) — this is the main driver of wider spread
- Adjusted ATTISR mapping to 85/65/35/10 (wider range than old 85/60/35/10)
- Adjusted ISUPP mapping to 15/55/90 (wider range than old 20/50/80)
- Adjusted PEACE1 mapping to 65/40 (directional: yes=hawkish, no=dovish)
- Adjusted COEX mapping to 40/65 (reversed: yes=dovish, no=hawkish)
- Removed the +3 Oct 7 adjustment (JVRC blending handles this)
- Changed denomination blending to 70% Pew / 30% JVRC (was 40/60)
- US formula simplified to 50% PARTY + 50% IDEO
- Comfort ranges recalculated from individual-level data using 1.5x weighted SD

---

## Variable Codebook Reference

### Pew 2020 Variables Used
- **BRANCH:** Jewish denomination (Orthodox, Conservative, Reform, etc.)
- **AGE4CAT:** Age in 4 categories (18-29, 30-49, 50-64, 65+)
- **PARTY:** Party identification (Republican, Democrat, Independent, Something Else)
- **IDEO:** Political ideology (1=Very Conservative to 5=Very Liberal)
- **ATTISR:** Emotional attachment to Israel (1=Very Attached to 4=Not At All)
- **ISUPP:** View on U.S. support level for Israel (Too supportive, About right, Not enough)
- **PEACE1:** Is Israel making sincere peace effort? (Yes/No)
- **BDS2:** Opinion on BDS movement (Strongly Support, Somewhat Support, Somewhat Oppose, Strongly Oppose)
- **COEX:** Can Israel and independent Palestine coexist? (Yes/No)
- **EXTWEIGHT:** Survey weight for population estimates

### JVRC 2025 Variables Used
- Harris/Trump Thermometer (0-100 scale, used for US political score)
- Attached to Israel (Very/Somewhat/Not too/Not at all)
- Military Action Considerations (Israel's national security vs Netanyahu's personal politics)
- Hostages (More likely released vs killed)

### Column Index for JVRC Crosstabs
Col 5=Reform, Col 6=Unaff/Other, Col 7=Conservative, Col 8=Orthodox, Col 25=Under 35, Col 27=Over 64
