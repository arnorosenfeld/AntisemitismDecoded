#!/bin/bash
# Build script: assembles game source files into a single HTML file
set -e

OUTDIR="dist"
mkdir -p "$OUTDIR"

# Read components
TEMPLATE=$(cat game/template.html)
DATA=$(cat game/data.json)
ENGINE=$(cat game/engine.js)
STYLE=$(cat game/style.css)

# Build the single-file HTML
cat > "$OUTDIR/game.html" <<'HTMLEOF'
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Antisemitism Decoded: The Game</title>
<link href="https://fonts.googleapis.com/css2?family=Merriweather:ital,wght@0,400;0,700;0,900;1,400&family=Merriweather+Sans:wght@400;600;700&display=swap" rel="stylesheet">
<style>
HTMLEOF

cat game/style.css >> "$OUTDIR/game.html"

cat >> "$OUTDIR/game.html" <<'HTMLEOF'
</style>
</head>
<body>
HTMLEOF

cat game/template.html >> "$OUTDIR/game.html"

cat >> "$OUTDIR/game.html" <<'HTMLEOF'
<script>
var GAME_DATA = 
HTMLEOF

cat game/data.json >> "$OUTDIR/game.html"

cat >> "$OUTDIR/game.html" <<'HTMLEOF'
;
HTMLEOF

cat game/engine.js >> "$OUTDIR/game.html"

cat >> "$OUTDIR/game.html" <<'HTMLEOF'
</script>
</body>
</html>
HTMLEOF

echo "Build successful: $OUTDIR/game.html ($(wc -c < "$OUTDIR/game.html") bytes)"
