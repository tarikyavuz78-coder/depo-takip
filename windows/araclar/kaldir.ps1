# Depo Takip — sunucu görevini ve güvenlik duvarı kuralını kaldırır. Veriler SİLİNMEZ.
$ErrorActionPreference = 'SilentlyContinue'
Stop-ScheduledTask -TaskName 'DepoTakip Sunucu'
Unregister-ScheduledTask -TaskName 'DepoTakip Sunucu' -Confirm:$false
Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
    Where-Object { $_.CommandLine -like '*server\server.js*' } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
& netsh.exe advfirewall firewall delete rule name="Depo Takip" | Out-Null
Remove-Item "$env:PUBLIC\Desktop\Depo Takip.lnk" -Force
Remove-Item "$env:ProgramData\Microsoft\Windows\Start Menu\Programs\Depo Takip.lnk" -Force
Write-Host "Depo Takip kaldırıldı. Verileriniz $env:ProgramData\DepoTakip klasöründe duruyor."
