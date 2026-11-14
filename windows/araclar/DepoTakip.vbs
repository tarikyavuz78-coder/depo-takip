' Depo Takip - masaustu baslatici
' Sunucu calismiyorsa baslatir, ardindan uygulamayi pencere olarak acar.
Option Explicit
Dim sh, fso, appDir, url, i
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
appDir = fso.GetParentFolderName(fso.GetParentFolderName(WScript.ScriptFullName))
url = "http://localhost:8765/"

Function ServerUp()
  On Error Resume Next
  Dim x
  Set x = CreateObject("MSXML2.ServerXMLHTTP.6.0")
  x.setTimeouts 1500, 1500, 1500, 1500
  x.Open "GET", url & "api/status", False
  x.Send
  ServerUp = (Err.Number = 0 And x.Status = 200)
  On Error GoTo 0
End Function

If Not ServerUp() Then
  Dim nodeExe
  nodeExe = appDir & "\node\node.exe"
  If Not fso.FileExists(nodeExe) Then nodeExe = "node"
  sh.Run """" & nodeExe & """ --no-warnings """ & appDir & "\server\server.js""", 0, False
  For i = 1 To 20
    WScript.Sleep 500
    If ServerUp() Then Exit For
  Next
End If

On Error Resume Next
sh.Run "msedge --app=" & url & " --window-size=1360,880", 1, False
If Err.Number <> 0 Then
  Err.Clear
  sh.Run "chrome --app=" & url, 1, False
  If Err.Number <> 0 Then
    Err.Clear
    sh.Run url, 1, False
  End If
End If
