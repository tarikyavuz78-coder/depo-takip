# Depo Takip - tum verileri sifirla (eski veriler silinmez, yedek klasorune tasinir)
$ErrorActionPreference = 'Stop'
$d = Join-Path $env:ProgramData 'DepoTakip'
$task = 'DepoTakip Sunucu'
Write-Host ''
Write-Host ' DEPO TAKIP - TUM VERILERI SIFIRLAMA' -ForegroundColor Yellow
Write-Host ' Tum stok kayitlari, hareketler, kullanicilar ve ayarlar sifirlanir.'
Write-Host ' Hammadde / urun / recete tanimlari Ekim 2026 Excel dosyasindan yeniden yuklenir.'
Write-Host ' Eski veriler SILINMEZ: C:\ProgramData\DepoTakip\sifirlama-yedek-... klasorune tasinir.'
Write-Host ''
$onay = Read-Host ' Devam etmek icin EVET yazip Enter tusuna basin'
if ($onay -ne 'EVET') { Write-Host ' Iptal edildi.'; return }
Stop-ScheduledTask -TaskName $task -ErrorAction SilentlyContinue
Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -like '*server\server.js*' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Start-Sleep -Seconds 2
$y = Join-Path $d ('sifirlama-yedek-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path $y | Out-Null
foreach ($f in 'depo2.db', 'depo2.db-wal', 'depo2.db-shm', 'depo.db') {
  $p = Join-Path $d $f
  if (Test-Path $p) { Move-Item -Path $p -Destination $y }
}
Start-ScheduledTask -TaskName $task
Write-Host ''
Write-Host " Sifirlama tamam. Eski veriler burada: $y" -ForegroundColor Green
Write-Host ' "Depo Takip" kisayolunu acin ve ilk kurulumu (yonetici hesabi) yeniden yapin.'
