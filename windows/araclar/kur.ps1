# Depo Takip — Windows sunucu kurulumu
# Yönetici olarak çalıştırılmalıdır (Kur.bat veya kurulum sihirbazı bunu otomatik yapar).
param(
    [string]$AppDir = (Split-Path -Parent $PSScriptRoot),
    [int]$Port = 8765,
    [switch]$NoShortcut
)
$ErrorActionPreference = 'Stop'
$TaskName = 'DepoTakip Sunucu'
function Bilgi($m) { Write-Host "  > $m" -ForegroundColor Cyan }

Write-Host ''
Write-Host '=== Depo Takip sunucu kurulumu ===' -ForegroundColor Green

# 1) Node.js'i bul (paketle gelen veya bilgisayarda kurulu olan)
$node = Join-Path $AppDir 'node\node.exe'
if (-not (Test-Path $node)) {
    $cmd = Get-Command node.exe -ErrorAction SilentlyContinue
    if ($cmd) { $node = $cmd.Source }
    else { throw 'Node.js bulunamadı. Lütfen https://nodejs.org adresinden "LTS" sürümünü (24.x) kurup tekrar deneyin.' }
}
$ver = (& $node -v).Trim().TrimStart('v')
$parts = $ver.Split('.') | ForEach-Object { [int]$_ }
if ($parts[0] -lt 22 -or ($parts[0] -eq 22 -and $parts[1] -lt 13)) {
    throw "Node.js $ver çok eski. En az 22.13 gerekli (önerilen: 24 LTS)."
}
Bilgi "Node.js $ver bulundu: $node"

# 2) Veri klasörü ve izinler
$data = Join-Path $env:ProgramData 'DepoTakip'
New-Item -ItemType Directory -Force -Path $data | Out-Null
& icacls.exe $data /grant '*S-1-5-32-545:(OI)(CI)M' /T /C /Q | Out-Null
Bilgi "Veri klasörü: $data"

# 3) Windows açılışında otomatik başlayan görev (kullanıcı oturum açmasa da çalışır)
$serverJs = Join-Path $AppDir 'server\server.js'
$action = New-ScheduledTaskAction -Execute $node -Argument "--no-warnings `"$serverJs`"" -WorkingDirectory $AppDir
$trigger = New-ScheduledTaskTrigger -AtStartup
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 999 `
    -RestartInterval (New-TimeSpan -Minutes 1) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
$principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null
Bilgi "Otomatik başlatma görevi oluşturuldu: $TaskName"

# 4) Güvenlik duvarı: telefonların bağlanabilmesi için port izni
& netsh.exe advfirewall firewall delete rule name="Depo Takip" | Out-Null
& netsh.exe advfirewall firewall add rule name="Depo Takip" dir=in action=allow protocol=TCP localport=$Port profile=any | Out-Null
Bilgi "Güvenlik duvarında TCP $Port portu açıldı"

# 5) Sunucuyu (yeniden) başlat
Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -like '*server\server.js*' } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1
Start-ScheduledTask -TaskName $TaskName

$ok = $false
for ($i = 0; $i -lt 20; $i++) {
    Start-Sleep -Milliseconds 700
    try { $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 "http://localhost:$Port/api/status"; if ($r.Content -like '*DepoTakip*') { $ok = $true; break } } catch { }
}
if ($ok) { Bilgi 'Sunucu çalışıyor.' } else { Write-Warning "Sunucu henüz yanıt vermedi. Ayrıntı için: $data\sunucu.log" }

# 6) Masaüstü ve Başlat menüsü kısayolları
if (-not $NoShortcut) {
    $ws = New-Object -ComObject WScript.Shell
    $targets = @("$env:PUBLIC\Desktop\Depo Takip.lnk", "$env:ProgramData\Microsoft\Windows\Start Menu\Programs\Depo Takip.lnk")
    foreach ($t in $targets) {
        $l = $ws.CreateShortcut($t)
        $l.TargetPath = "$env:WINDIR\System32\wscript.exe"
        $l.Arguments = "`"$AppDir\araclar\DepoTakip.vbs`""
        $l.IconLocation = "$AppDir\araclar\depotakip.ico"
        $l.Description = 'Depo Takip'
        $l.Save()
    }
    Bilgi 'Masaüstüne "Depo Takip" kısayolu eklendi'
}

# 7) Telefon bağlantı adresi
$ips = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' -and $_.InterfaceAlias -notmatch 'vEthernet|VMware|VirtualBox|Loopback' }
Write-Host ''
Write-Host 'Kurulum tamamlandı.' -ForegroundColor Green
Write-Host "Bu bilgisayarda: http://localhost:$Port"
foreach ($ip in $ips) { Write-Host ("Telefon için adres: http://{0}:{1}   ({2})" -f $ip.IPAddress, $Port, $ip.InterfaceAlias) -ForegroundColor Yellow }
Write-Host ''
