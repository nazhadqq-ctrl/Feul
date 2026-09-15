Add-Type -AssemblyName System.Drawing
$pngPath = Join-Path $PSScriptRoot "assets\icon.png"
$icoPath = Join-Path $PSScriptRoot "assets\app.ico"
$publicIcoPath = Join-Path $PSScriptRoot "public\assets\app.ico"

$bmp = [System.Drawing.Bitmap]::FromFile($pngPath)
$size = 256
$thumb = New-Object System.Drawing.Bitmap $size, $size
$g = [System.Drawing.Graphics]::FromImage($thumb)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.DrawImage($bmp, 0, 0, $size, $size)
$hIcon = $thumb.GetHicon()
$icon = [System.Drawing.Icon]::FromHandle($hIcon)

$fs = [System.IO.File]::OpenWrite($icoPath)
$icon.Save($fs)
$fs.Close()

Copy-Item $icoPath -Destination $publicIcoPath -Force

$g.Dispose()
$thumb.Dispose()
$bmp.Dispose()
Write-Host "ICO created at $icoPath and $publicIcoPath"
