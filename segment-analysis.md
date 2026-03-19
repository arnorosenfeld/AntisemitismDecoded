# Jewish American Demographic Segment Analysis
## Political Center Scores and Comfort Ranges for Game Design

**Date:** 2026-03-19
**Data Sources:**
- Pew Research Center, "Jewish Americans in 2020" Extended Dataset (n=5,881, weighted)
- JVRC National Jewish Survey, April 21 - May 1, 2025 (n~800, crosstabs)

---

## Final Game-Ready Scores

| Segment | US Center (0-100) | US Comfort (±) | Israel Center (0-100) | Israel Comfort (±) |
|---|---|---|---|---|
| **Orthodox** | 64 | ±40 | 61 | ±28 |
| **Conservative** | 44 | ±45 | 61 | ±27 |
| **Reform** | 32 | ±37 | 51 | ±30 |
| **Unaffiliated** | 36 | ±45 | 47 | ±31 |
| **Young Jews (18-29)** | 35 | ±43 | 47 | ±32 |
| **Older Jews (65+)** | 41 | ±45 | 54 | ±30 |

**Scale:** US Politics: 0 = far left, 50 = center, 100 = far right.
Israel Politics: 0 = very dovish/critical of Israel, 50 = center, 100 = very hawkish/pro-Israel.

**Comfort Range:** How far from the segment's center a position can be before the segment gets uncomfortable. ±20 = narrow comfort zone; ±45 = very wide/tolerant.

---

## Methodology Overview

### Blending Strategy
- **Denomination segments:** 40% Pew 2020 / 60% JVRC 2025 (JVRC weighted higher for currency)
- **Age segments (updated 2026-03-19):** 60% Pew 2020 / 40% JVRC 2025 (Pew weighted higher because its age brackets — 18-29 and 65+ — more closely match the target definitions; JVRC's Under 35 and Over 64 are slightly wider/narrower)
- **+3 adjustment** added to all Israel scores to account for post-Oct 7 hawkish shift not fully captured by attachment questions alone

### U.S. Political Center: Composite Formula
**50% IDEO + 30% PARTYSUM + 20% PRESAPP**

IDEO is weighted highest because it's a direct self-identification. PARTYSUM captures partisan lean. PRESAPP (Trump approval in Pew 2020 / Trump job approval in JVRC 2025) is a behavioral proxy.

### Israel Political Center: Composite Formula
**Pew: 35% ATTISR + 30% ISUPP + 20% PEACE1 + 15% COEX**
**JVRC: 50% Israel Attachment + 50% Netanyahu Favorability**

The Pew formula uses four complementary questions. The JVRC formula uses the two most directional available variables.

### Comfort Range Calculation
Comfort Range = 1.5 x weighted standard deviation of the composite score distribution (from Pew individual-level data). A wider SD means the group is more internally diverse, and thus tolerates a wider range of positions.

---

## Detailed Analysis by Segment

---

### 1. Orthodox Jews

**Pew 2020 sample:** n=446, weighted n=569,446
**JVRC 2025 sample:** n~72

#### U.S. Politics

**IDEO distribution (Pew 2020, weighted):**
| Ideology | % |
|---|---|
| Very Conservative | 16.0% |
| Conservative | 47.8% |
| Moderate | 26.2% |
| Liberal | 6.2% |
| Very Liberal | 3.8% |

Score mapping: Very Conservative=100, Conservative=75, Moderate=50, Liberal=25, Very Liberal=0
**IDEO Score: 66.5** (SD=23.6)

**PARTYSUM distribution (Pew 2020):**
| Party | % |
|---|---|
| DEM/Lean DEM | 20.6% |
| DK/No Lean | 5.0% |
| REP/Lean REP | 74.4% |

Score mapping: DEM=15, DK=50, REP=85
**PARTYSUM Score: 68.8** (SD=28.4)

**PRESAPP — Trump Approval (Pew 2020):**
| Response | % |
|---|---|
| Strongly Approve | 53.6% |
| Somewhat Approve | 23.1% |
| Somewhat Disapprove | 3.9% |
| Strongly Disapprove | 19.4% |

Score mapping: SA=90, SomA=70, SomD=30, SD=10
**PRESAPP Score: 67.6** (SD=31.1)

**Pew US Composite:** 0.50(66.5) + 0.30(68.8) + 0.20(67.6) = **67.4**
**Pew US Comfort Range:** 1.5 x (0.50(23.6) + 0.30(28.4) + 0.20(31.1)) = **±40**

**JVRC 2025 Cross-Reference:**
- Ideology: Liberal 16%, Moderate 27%, Conservative 55% → Score: 59.9
- Party ID (2-way): Dem 25%, Ind 24%, Rep 51% → Score: 59.1
- Trump Approval: 75% approve, 25% disapprove → Score: 70.0
- **JVRC US Composite: 61.7**

**Shift Analysis:** The JVRC data shows Orthodox Jews slightly less conservative than 2020 (61.7 vs 67.4). This may reflect some Orthodox discomfort with Trump's second term or sampling variation.

**Final Blended US Score: 64** (40% x 67.4 + 60% x 61.7 = 64.0)

#### Israel Politics

**ATTISR — Attachment to Israel (Pew 2020):**
| Response | % |
|---|---|
| Very Attached | 61.1% |
| Somewhat Attached | 20.1% |
| Not Too Attached | 12.7% |
| Not At All Attached | 6.1% |

Score mapping: VA=85, SA=60, NTA=35, NAAA=10
**ATTISR Score: 69.1** (SD=23.1)

**ISUPP — U.S. Support Level for Israel (Pew 2020):**
| Response | % |
|---|---|
| Too Supportive | 11.3% |
| About Right | 69.7% |
| Not Supportive Enough | 19.0% |

Score mapping: Too=20, Right=50, Not Enough=80
**ISUPP Score: 52.3** (SD=16.4)

**PEACE1 — Israel Making Sincere Peace Effort? (Pew 2020):**
| Response | % |
|---|---|
| Yes | 60.9% |
| No | 39.1% |

Score mapping: Yes=70 (pro-Israel), No=30 (critical)
**PEACE1 Score: 54.3** (SD=19.5)

**COEX — Can Israel and Independent Palestine Coexist? (Pew 2020):**
| Response | % |
|---|---|
| Yes, can coexist | 38.6% |
| No, cannot coexist | 61.4% |

Score mapping: Yes=45, No=70
**COEX Score: 60.4** (SD=12.2)

**Pew Israel Composite:** 0.35(69.1) + 0.30(52.3) + 0.20(54.3) + 0.15(60.4) = **59.8**
**Pew Israel Comfort Range:** 1.5 x composite SD = **±28**

**JVRC 2025 Cross-Reference:**
- Israel Attachment: 77% attached, 23% not → Score: 60.8
- Netanyahu Favorability: 63% fav, 22% unfav → Score: 52.8
- **JVRC Israel Composite: 56.8**

**Final Blended Israel Score:** 0.40(59.8) + 0.60(56.8) + 3 (Oct 7 adj) = **61**

---

### 2. Conservative Jews

**Pew 2020 sample:** n=1,001, weighted n=1,131,925
**JVRC 2025 sample:** n~136

#### U.S. Politics

**IDEO distribution (Pew 2020, weighted):**
| Ideology | % |
|---|---|
| Very Conservative | 8.3% |
| Conservative | 19.4% |
| Moderate | 35.7% |
| Liberal | 28.6% |
| Very Liberal | 8.0% |

**IDEO Score: 47.8** (SD=26.5)

**PARTYSUM distribution:**
| Party | % |
|---|---|
| DEM/Lean DEM | 66.4% |
| DK/No Lean | 2.3% |
| REP/Lean REP | 31.3% |

**PARTYSUM Score: 37.7** (SD=32.3)

**PRESAPP — Trump Approval:**
| Response | % |
|---|---|
| Strongly Approve | 22.5% |
| Somewhat Approve | 10.3% |
| Somewhat Disapprove | 13.7% |
| Strongly Disapprove | 53.5% |

**PRESAPP Score: 36.9** (SD=33.8)

**Pew US Composite:** 0.50(47.8) + 0.30(37.7) + 0.20(36.9) = **42.6**
**Pew US Comfort Range:** **±45**

**JVRC 2025:**
- Ideology: Liberal 32%, Moderate 36%, Conservative 30% → Score: 49.5
- Party: Dem 49%, Ind 23%, Rep 28% → Score: 42.7
- Trump: 35% approve, 65% disapprove → Score: 38.0
- **JVRC US Composite: 45.1**

**Final Blended US Score: 44** (40% x 42.6 + 60% x 45.1)

#### Israel Politics

**ATTISR:** VA 41.9%, SA 36.6%, NTA 17.7%, NAAA 3.8% → **Score: 64.2** (SD=21.2)
**ISUPP:** Too 7.7%, Right 70.3%, Not Enough 22.0% → **Score: 54.3** (SD=15.8)
**PEACE1:** Yes 49.3%, No 50.7% → **Score: 49.7** (SD=20.0)
**COEX:** Yes 61.0%, No 39.0% → **Score: 54.8** (SD=12.2)

**Pew Israel Composite: 56.9** | **Comfort: ±27**

**JVRC 2025:**
- Attachment: 96% attached (!) → Score: 68.4
- Netanyahu: 49% fav, 47% unfav → Score: 48.5
- **JVRC Israel Composite: 58.5**

Note: The dramatic jump in Conservative Jewish attachment to Israel (from Pew's ~78% to JVRC's 96%) strongly reflects the post-Oct 7 rally effect.

**Final Blended Israel Score:** 0.40(56.9) + 0.60(58.5) + 3 = **61**

---

### 3. Reform Jews

**Pew 2020 sample:** n=1,874, weighted n=2,406,760
**JVRC 2025 sample:** n~296

#### U.S. Politics

**IDEO distribution (Pew 2020, weighted):**
| Ideology | % |
|---|---|
| Very Conservative | 1.3% |
| Conservative | 6.9% |
| Moderate | 35.9% |
| Liberal | 39.6% |
| Very Liberal | 16.4% |

**IDEO Score: 34.3** (SD=22.1)

**PARTYSUM:** DEM 79.4%, DK 1.9%, REP 18.7% → **Score: 28.7** (SD=27.4)
**PRESAPP:** SA 8.3%, SomA 10.5%, SomD 8.7%, SD 72.5% → **Score: 24.7** (SD=27.0)

**Pew US Composite: 30.7** | **Comfort: ±37**

**JVRC 2025:**
- Ideology: Liberal 50%, Moderate 37%, Conservative 10% → Score: 39.7
- Party: Dem 69%, Ind 22%, Rep 9% → Score: 29.0
- Trump: 18% approve, 82% disapprove → Score: 24.4
- **JVRC US Composite: 33.4**

**Final Blended US Score: 32** (40% x 30.7 + 60% x 33.4)

#### Israel Politics

**ATTISR:** VA 21.7%, SA 34.6%, NTA 30.7%, NAAA 12.9% → **Score: 51.3** (SD=24.0)
**ISUPP:** Too 23.2%, Right 55.5%, Not Enough 21.3% → **Score: 49.4** (SD=20.0)
**PEACE1:** Yes 28.3%, No 71.7% → **Score: 41.3** (SD=18.0)
**COEX:** Yes 68.0%, No 32.0% → **Score: 53.0** (SD=11.7)

**Pew Israel Composite: 49.0** | **Comfort: ±30**

**JVRC 2025:**
- Attachment: 69% attached → Score: 57.6
- Netanyahu: 27% fav, 67% unfav → Score: 37.0
- **JVRC Israel Composite: 47.3**

Reform Jews show mixed Israel signals: attachment rose post-Oct 7, but Netanyahu unfavorability is very high (67%). The Israel score stays near center.

**Final Blended Israel Score:** 0.40(49.0) + 0.60(47.3) + 3 = **51**

---

### 4. Unaffiliated Jews

**Pew 2020 sample:** n=1,688, weighted n=3,356,868 (includes "Just Jewish", secular, culturally Jewish, atheist/agnostic, not practicing)
**JVRC 2025 sample:** n~280

#### U.S. Politics

**IDEO distribution (Pew 2020, weighted):**
| Ideology | % |
|---|---|
| Very Conservative | 5.1% |
| Conservative | 11.8% |
| Moderate | 34.6% |
| Liberal | 28.9% |
| Very Liberal | 19.6% |

**IDEO Score: 38.5** (SD=27.2)

**PARTYSUM:** DEM 63.4%, DK 2.7%, REP 33.9% → **Score: 39.6** (SD=32.9)
**PRESAPP:** SA 17.8%, SomA 14.3%, SomD 10.4%, SD 57.6% → **Score: 34.9** (SD=32.8)

**Pew US Composite: 38.1** | **Comfort: ±45**

**JVRC 2025:**
- Ideology: Liberal 55%, Moderate 32%, Conservative 10% → Score: 38.4
- Party: Dem 61%, Ind 29%, Rep 10% → Score: 32.1
- Trump: 19% approve, 81% disapprove → Score: 25.2
- **JVRC US Composite: 33.9**

**Note:** Unaffiliated Jews are center-left but have a VERY wide comfort range (±45). This is the most internally diverse denominational segment.

**Final Blended US Score: 36** (40% x 38.1 + 60% x 33.9)

#### Israel Politics

**ATTISR:** VA 12.7%, SA 30.1%, NTA 30.6%, NAAA 26.5% → **Score: 42.3** (SD=24.9)
**ISUPP:** Too 31.4%, Right 50.1%, Not Enough 18.6% → **Score: 46.2** (SD=20.8)
**PEACE1:** Yes 32.5%, No 67.5% → **Score: 43.0** (SD=18.7)
**COEX:** Yes 69.1%, No 30.9% → **Score: 52.7** (SD=11.6)

**Pew Israel Composite: 45.1** | **Comfort: ±31**

**JVRC 2025:**
- Attachment: 54% attached → Score: 51.6
- Netanyahu: 26% fav, 68% unfav → Score: 36.5
- **JVRC Israel Composite: 44.1**

**Final Blended Israel Score:** 0.40(45.1) + 0.60(44.1) + 3 = **47**

---

### 5. Young Jews (18-29)

**Bracket change (2026-03-19):** Narrowed from 18-39 to Pew 18-29 + JVRC Under 35 to better capture the youngest cohort's distinct political profile. Weighting is 60% Pew (larger n, narrower bracket match) / 40% JVRC (more current but bracket is Under 35, slightly wider).

**Pew 2020 sample:** n=554, weighted n=1,916,708 (AGE4CAT == '18-29' only —)
**JVRC 2025 sample:** n~208 (Under 35)

#### U.S. Politics

**IDEO distribution (Pew 2020, weighted):**
| Ideology | % |
|---|---|
| Very Conservative | 3.9% |
| Conservative | 9.8% |
| Moderate | 35.1% |
| Liberal | 28.4% |
| Very Liberal | 22.8% |

**IDEO Score: 35.9** (SD=26.6)

**PARTYSUM:** DEM 66.4%, DK 4.2%, REP 29.4% → **Score: 37.0** (SD=31.7)
**PRESAPP:** SA 9.7%, SomA 13.1%, SomD 15.5%, SD 61.7% → **Score: 28.8** (SD=28.4)

**Pew US Composite: 34.8** | **Comfort: ±43**

**JVRC 2025 (Under 35):**
- Ideology: Liberal 66%, Moderate 19%, Conservative 12% → Score: 36.1
- Party: Dem 64%, Ind 24%, Rep 12% → Score: 31.8
- Trump: 16% approve, 84% disapprove → Score: 36.4
- **JVRC US Composite: 34.9**

The narrower 18-29 Pew bracket and the JVRC Under 35 data converge closely, both showing a solidly center-left cohort.

**Final Blended US Score: 35** (60% x 34.8 + 40% x 34.9)

#### Israel Politics

**ATTISR:** VA 16.4%, SA 24.9%, NTA 28.9%, NAAA 29.9% → **Score: 41.9** (SD=26.5)
**ISUPP:** Score: 47.9 (SD=23.3)
**PEACE1:** Yes 27.4%, No 72.6% → **Score: 41.0** (SD=17.8)
**COEX:** Yes 73.5%, No 26.5% → **Score: 51.6** (SD=11.0)

**Pew Israel Composite: 45.0** | **Comfort: ±32**

**JVRC 2025:**
- Attachment: 55% attached → Score: 47.0
- Netanyahu: 20% fav, 73% unfav → Score: 36.5
- **JVRC Israel Composite: 41.7**

Young Jews (18-29) are the most dovish/critical segment on Israel, with the highest Netanyahu unfavorability (73%) and lowest attachment (55%). The narrower bracket shows even lower Israel attachment than the old 18-39 range.

**Final Blended Israel Score:** 0.60(45.0) + 0.40(41.7) + 3 (Oct 7 adj) = **47**

---

### 6. Older Jews (65+)

**Bracket change (2026-03-19):** Narrowed from 50+ to Pew 65+ + JVRC Over 64 to focus on the retirement-age cohort. Weighting is 60% Pew (larger n, bracket match) / 40% JVRC (more current, bracket aligns well).

**Pew 2020 sample:** n=2,336, weighted n=2,406,454 (AGE4CAT == '65+')
**JVRC 2025 sample:** n~216 (Over 64)

#### U.S. Politics

**IDEO distribution (Pew 2020, weighted):**
| Ideology | % |
|---|---|
| Very Conservative | 6.1% |
| Conservative | 18.3% |
| Moderate | 32.9% |
| Liberal | 30.8% |
| Very Liberal | 11.9% |

**IDEO Score: 44.0** (SD=26.9)

**PARTYSUM:** DEM 61.7%, DK 6.0%, REP 32.3% → **Score: 39.7** (SD=32.3)
**PRESAPP:** SA 24.2%, SomA 10.2%, SomD 6.3%, SD 59.4% → **Score: 36.7** (SD=35.0)

**Pew US Composite: 41.2** | **Comfort: ±45**

**JVRC 2025 (Over 64):**
- Ideology: Liberal 38%, Moderate 44%, Conservative 17% → Score: 44.7
- Party: Dem 61%, Ind 22%, Rep 16% → Score: 33.8
- Trump: 28% approve, 72% disapprove → Score: 41.2
- **JVRC US Composite: 40.7**

**Final Blended US Score: 41** (60% x 41.2 + 40% x 40.7)

#### Israel Politics

**ATTISR:** VA 25.9%, SA 34.3%, NTA 23.3%, NAAA 16.5% → **Score: 52.4** (SD=25.7)
**ISUPP:** Score: 50.2 (SD=18.4)
**PEACE1:** Yes 40.5%, No 59.5% → **Score: 46.2** (SD=19.6)
**COEX:** Yes 60.8%, No 39.2% → **Score: 54.8** (SD=12.2)

**Pew Israel Composite: 50.9** | **Comfort: ±30**

**JVRC 2025:**
- Attachment: 79% attached → Score: 56.6
- Netanyahu: 42% fav, 53% unfav → Score: 47.1
- **JVRC Israel Composite: 51.9**

Older Jews (65+) are more hawkish/pro-Israel than younger Jews, with notably higher attachment (79% vs 55%) and Netanyahu favorability (42% vs 20%).

**Final Blended Israel Score:** 0.60(50.9) + 0.40(51.9) + 3 (Oct 7 adj) = **54**

---

## Key Observations for Game Design

1. **Orthodox is the outlier on US politics** (64 vs. 32-44 for all others). Every other segment clusters center-left. This creates real gameplay tension when an Orthodox segment is present.

2. **Israel is less polarized by denomination than US politics.** The full range is 47-61 (14 points) vs. 32-64 (32 points) for US politics. This means Israel positions are less likely to alienate any single group.

3. **Conservative Jews (denomination) are politically moderate** — they sit at 44 on US (near true center) with the second-widest comfort range (±45). They're the "median voter" segment.

4. **Comfort ranges are wide across the board** (27-46 points). This reflects genuine internal diversity within every Jewish segment. No group is monolithic.

5. **Young Jews (18-29) are the most liberal AND most dovish** on Israel — but their wide comfort range (±32 on Israel, ±43 on US) means they can tolerate a range of positions.

6. **The biggest denominational gap on Israel is Orthodox/Conservative vs. Unaffiliated/Young** (61 vs. 47 — a 14-point gap). On US politics, the gap is much larger: Orthodox (64) vs. Reform (32) — a 32-point gap.

7. **Post-Oct 7 effects are visible in the JVRC data:** Conservative denomination Jews jumped to 96% Israel-attached (from ~78% in Pew 2020). But high Netanyahu unfavorability across non-Orthodox groups means the hawkish shift is complex — people are more attached to Israel but critical of its current leadership.

---

## Variable Codebook Reference

### Pew 2020 Variables Used
- **BRANCH:** Jewish denomination (Orthodox, Conservative, Reform, etc.)
- **AGE4CAT:** Age in 4 categories (18-29, 30-49, 50-64, 65+)
- **IDEO:** Political ideology (1=Very Conservative to 5=Very Liberal)
- **PARTYSUM:** Party summary (REP/Lean REP, DEM/Lean DEM, DK/No Lean)
- **PRESAPP:** Presidential (Trump) approval (1=Strongly Approve to 4=Strongly Disapprove)
- **ATTISR:** Emotional attachment to Israel (1=Very Attached to 4=Not At All)
- **ISUPP:** View on U.S. support level for Israel (Too supportive, About right, Not enough)
- **PEACE1:** Is Israel making sincere peace effort? (Yes/No)
- **COEX:** Can Israel and independent Palestine coexist? (Yes/No)
- **EXTWEIGHT:** Survey weight for population estimates

### JVRC 2025 Variables Used
- Ideology (Liberal / Moderate / Conservative)
- 2-way Party ID (Dem / Ind / Rep)
- Trump Job Approval (Approve / Disapprove)
- Attached to Israel (Attached / Not Attached)
- Netanyahu Favorability (Favorable / Unfavorable)

### Column Index for JVRC Crosstabs
Col 5=Reform, Col 6=Unaff/Other, Col 7=Conservative, Col 8=Orthodox, Col 25=Under 35, Col 27=Over 64
