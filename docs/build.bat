@echo off
cd /d "%~dp0"
echo Compilando documentacion MAG7 Tracker...
pdflatex -interaction=nonstopmode mag7_doc.tex
pdflatex -interaction=nonstopmode mag7_doc.tex
echo.
echo Listo! Abre mag7_doc.pdf para ver el resultado.
pause
