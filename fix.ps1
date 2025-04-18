$content = Get-Content app.js -Raw
$secondIndex = $content.IndexOf("function validateGeometry(geometry)", $content.IndexOf("function validateGeometry(geometry)")+1)
if ($secondIndex -ne -1) {
    $endIndex = $content.IndexOf("}", $content.IndexOf("function fixGeometryBounds(geometry)", $secondIndex))+1
    $newContent = $content.Substring(0, $secondIndex) + "// Using existing validateGeometry and fixGeometryBounds functions defined earlier" + $content.Substring($endIndex)
    $newContent | Set-Content app.js -NoNewline
    Write-Host "Fixed file: app.js - Removed duplicate validateGeometry and fixGeometryBounds functions"
} else {
    Write-Host "No duplicate functions found."
}
