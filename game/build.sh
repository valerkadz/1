#!/bin/sh
# Собирает архив для загрузки в консоль Яндекс Игр
cd "$(dirname "$0")"
mkdir -p dist
rm -f dist/iskra-game.zip
zip -q dist/iskra-game.zip index.html style.css game.js
echo "Готово: game/dist/iskra-game.zip"
