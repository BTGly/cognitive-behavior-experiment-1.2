Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  jsPsych Blur Experiment - Local Server" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Starting HTTP server on http://localhost:8000" -ForegroundColor Yellow
Write-Host ""
Write-Host "Open this URL in Chrome/Edge to run the experiment." -ForegroundColor Yellow
Write-Host ""
$port = 8000
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Start()
Write-Host "Server started. Press Ctrl+C to stop." -ForegroundColor Green
$dir = $PSScriptRoot
while ($listener.IsListening) {
    $context = $listener.GetContext()
    $request = $context.Request
    $response = $context.Response
    $localPath = $request.Url.LocalPath.TrimStart('/')
    if ([string]::IsNullOrEmpty($localPath)) { $localPath = "index.html" }
    $fullPath = Join-Path $dir $localPath
    if (Test-Path -LiteralPath $fullPath -PathType Leaf) {
        $content = [System.IO.File]::ReadAllBytes($fullPath)
        $ext = [System.IO.Path]::GetExtension($fullPath)
        $mime = @{
            '.html' = 'text/html; charset=utf-8'
            '.js' = 'application/javascript; charset=utf-8'
            '.css' = 'text/css; charset=utf-8'
            '.png' = 'image/png'
            '.csv' = 'text/csv; charset=utf-8'
            '.json' = 'application/json'
        }
        $contentType = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { 'application/octet-stream' }
        $response.ContentType = $contentType
        $response.OutputStream.Write($content, 0, $content.Length)
    } else {
        $response.StatusCode = 404
        $errorBytes = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
        $response.OutputStream.Write($errorBytes, 0, $errorBytes.Length)
    }
    $response.Close()
}
