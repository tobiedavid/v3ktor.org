# Shared pieces

Code that more than one V3KTOR app runs. Each app holds a copy, so it stays a single file that works offline; `tools/shared.js` keeps the copies the same.

- **`nutrition.js`**: the Nutrition rules. The nutrient list (names and short lines in English and French), the daily needs from a person's answers (Health Canada's Dietary Reference Intakes, the pregnancy and lactation columns, the vegetarian adjustment, smoking, protein per kg, rough calories, the upper limits, caffeine and alcohol limits), and the bands (empty, low, okay, full, over). Also the answers the needs rest on (sex, age, weight, kind of day, and smoking, drinking most days, pregnancy, breastfeeding, vegetarian or vegan): the questions (`ASK`), the line that sums them up, the buttons for the wrench's sheet, and their shared copy in the phone's browser storage (`v3k.profile.v1`: the answers and when they last changed; the newer one wins). Used by The Patch; the Food Trial Log and the Threshold Log come next.

To change a piece: edit it here, then

    node tools/shared.js --write     # copies it into every app that uses it
    node tools/stamp_cache.js        # so phones pick up the new version
    node tests/run.js

A change that moves someone's needs fails `tests/patch/needs.test.js` on purpose. If the change is meant, record the new figures with `node tests/patch/needs.test.js --record` and say why in the commit.
