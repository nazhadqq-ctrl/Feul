$WshShell = New-Object -ComObject WScript.Shell
$DesktopPath = [Environment]::GetFolderPath("Desktop")
$AppDir = $PSScriptRoot
$ShortcutPath = Join-Path $DesktopPath "Feul Station Pro.lnk"
$VbsPath = Join-Path $AppDir "FeulStation-Silent.vbs"
$IconPath = Join-Path $AppDir "assets\app.ico"

$Shortcut = $WshShell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = "wscript.exe"
$Shortcut.Arguments = "`"$VbsPath`""
$Shortcut.WorkingDirectory = $AppDir
$Shortcut.IconLocation = "$IconPath, 0"
$Shortcut.Description = "سیستەمی مۆدێرنی تۆمارکردنی بەنزینخانە - Feul Station Pro"
$Shortcut.Save()

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host " Desktop Shortcut Created Successfully! " -ForegroundColor Green
Write-Host " Path: $ShortcutPath" -ForegroundColor Yellow
Write-Host " Icon: $IconPath" -ForegroundColor Yellow
Write-Host "=========================================" -ForegroundColor Cyan
