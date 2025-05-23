$content = Get-Content app.js -Raw
if ($content.Contains("// Helper functions for geometry validation")) {
    $startIndex = $content.IndexOf("// Helper functions for geometry validation")
    $endIndex = $content.IndexOf("}", $startIndex)
    $endIndex = $content.IndexOf("}", $endIndex + 1) + 1
    $newContent = $content.Substring(0, $startIndex) + "// Using existing validateGeometry and fixGeometryBounds functions defined earlier" + $content.Substring($endIndex)
    $newContent | Set-Content app.js -NoNewline
    Write-Host "Fixed syntax error in app.js by removing duplicate function code."
} else {
    Write-Host "No validation helper functions found, no changes needed."
}
