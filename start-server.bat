@echo off
echo ========================================
echo   jsPsych Blur Experiment - Local Server
echo ========================================
echo.
echo Starting HTTP server on http://localhost:8000
echo.
echo Open this URL in Chrome/Edge to run the experiment.
echo Press Ctrl+C to stop the server.
echo.
python -m http.server 8000 --directory "%~dp0"
pause
