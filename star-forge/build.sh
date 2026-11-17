#!/bin/sh
# Собирает архив для загрузки в консоль Яндекс Игр
cd "$(dirname "$0")"
mkdir -p dist && rm -f dist/star-forge-game.zip
zip -q dist/star-forge-game.zip index.html style.css game.js
echo "Готово: star-forge/dist/star-forge-game.zip"
