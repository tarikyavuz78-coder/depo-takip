; Depo Takip — Windows kurulum sihirbazı (Inno Setup 6)
; GitHub Actions bu dosyayı derler; elle derlemek için: iscc windows\DepoTakip.iss

#define AppVer GetEnv("DEPO_VERSION")
#if AppVer == ""
  #define AppVer "2.1.0"
#endif

[Setup]
AppId={{6E8B1F0A-3C1D-4D5E-9A7B-DE70A7A1C001}
AppName=Depo Takip
AppVersion={#AppVer}
AppPublisher=Depo Takip
DefaultDirName={autopf}\DepoTakip
DefaultGroupName=Depo Takip
DisableProgramGroupPage=yes
PrivilegesRequired=admin
OutputDir=..\dist
OutputBaseFilename=DepoTakip-Kurulum-{#AppVer}
SetupIconFile=araclar\depotakip.ico
UninstallDisplayIcon={app}\araclar\depotakip.ico
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
CloseApplications=no

[Languages]
Name: "turkish"; MessagesFile: "compiler:Languages\Turkish.isl"

[Tasks]
Name: "desktopicon"; Description: "Masaüstüne kısayol oluştur"; GroupDescription: "Ek seçenekler:"

[Dirs]
Name: "{commonappdata}\DepoTakip"; Permissions: users-modify

[Files]
Source: "..\build\node\node.exe"; DestDir: "{app}\node"; Flags: ignoreversion
Source: "..\server\*"; DestDir: "{app}\server"; Flags: ignoreversion recursesubdirs
Source: "..\public\*"; DestDir: "{app}\public"; Flags: ignoreversion recursesubdirs
Source: "araclar\*"; DestDir: "{app}\araclar"; Flags: ignoreversion
Source: "..\docs\*"; DestDir: "{app}\belgeler"; Flags: ignoreversion recursesubdirs

[Icons]
Name: "{group}\Depo Takip"; Filename: "{sys}\wscript.exe"; Parameters: """{app}\araclar\DepoTakip.vbs"""; IconFilename: "{app}\araclar\depotakip.ico"
Name: "{group}\Kullanım Kılavuzu"; Filename: "{app}\belgeler\KULLANIM-KILAVUZU.html"
Name: "{group}\Veri ve Yedek Klasörü"; Filename: "{commonappdata}\DepoTakip"
Name: "{group}\Depo Takip'i Kaldır"; Filename: "{uninstallexe}"
Name: "{commondesktop}\Depo Takip"; Filename: "{sys}\wscript.exe"; Parameters: """{app}\araclar\DepoTakip.vbs"""; IconFilename: "{app}\araclar\depotakip.ico"; Tasks: desktopicon

[Run]
Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\araclar\kur.ps1"" -AppDir ""{app}"" -NoShortcut"; Flags: runhidden waituntilterminated; StatusMsg: "Sunucu hizmeti kuruluyor ve başlatılıyor..."
Filename: "{sys}\wscript.exe"; Parameters: """{app}\araclar\DepoTakip.vbs"""; Description: "Depo Takip'i şimdi aç"; Flags: postinstall nowait skipifsilent

[UninstallRun]
Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\araclar\kaldir.ps1"""; Flags: runhidden waituntilterminated; RunOnceId: "DepoTakipKaldir"

[Code]
function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  R: Integer;
begin
  { Güncelleme sırasında çalışan sunucuyu durdur ki dosyalar değiştirilebilsin }
  Exec(ExpandConstant('{sys}\schtasks.exe'), '/End /TN "DepoTakip Sunucu"', '', SW_HIDE, ewWaitUntilTerminated, R);
  Exec('powershell.exe', '-NoProfile -Command "Get-CimInstance Win32_Process -Filter ""Name=''node.exe''"" | Where-Object { $_.CommandLine -like ''*server\server.js*'' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"', '', SW_HIDE, ewWaitUntilTerminated, R);
  Result := '';
end;
