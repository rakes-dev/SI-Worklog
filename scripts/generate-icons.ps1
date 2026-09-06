Add-Type -AssemblyName System.Drawing

$root = 'C:\Users\Rakesh\Desktop\SI-Worklog'
$srcPath = Join-Path $root 'public\assets\images\app_logo.png'
$iconsDir = Join-Path $root 'public\icons'

$src = [System.Drawing.Image]::FromFile($srcPath)
Write-Host "Source logo: $($src.Width)x$($src.Height)"

function New-Icon {
    param([int]$Size, [double]$PadRatio, [string]$OutPath, [bool]$Opaque)
    $bmp = New-Object System.Drawing.Bitmap($Size, $Size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $bgColor = if ($Opaque) { [System.Drawing.Color]::White } else { [System.Drawing.Color]::Transparent }
    $g.Clear($bgColor)
    # Content box: square canvas, logo centered and scaled to fit PadRatio of the canvas
    $content = [int][Math]::Floor($Size * $PadRatio)
    $scale = [Math]::Min($content / $src.Width, $content / $src.Height)
    $w = [int][Math]::Floor($src.Width * $scale)
    $h = [int][Math]::Floor($src.Height * $scale)
    $x = [int][Math]::Floor(($Size - $w) / 2)
    $y = [int][Math]::Floor(($Size - $h) / 2)
    $g.DrawImage($src, $x, $y, $w, $h)
    $g.Dispose()
    $bmp.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host "Created: $OutPath ($Size x $Size)"
}

# Standard PWA / TWA icons (any purpose) - slight margin, transparent corners
New-Icon -Size 192 -PadRatio 0.92 -OutPath (Join-Path $iconsDir 'icon-192.png') -Opaque $false
New-Icon -Size 512 -PadRatio 0.92 -OutPath (Join-Path $iconsDir 'icon-512.png') -Opaque $false

# Maskable icon: content must sit inside the 80% safe zone -> opaque background + big padding
New-Icon -Size 512 -PadRatio 0.68 -OutPath (Join-Path $iconsDir 'maskable-512.png') -Opaque $true

# iOS apple-touch-icon: opaque (iOS renders transparency as black), 180x180
New-Icon -Size 180 -PadRatio 0.92 -OutPath (Join-Path $iconsDir 'apple-touch-icon.png') -Opaque $true

# favicon.ico (32x32)
$bmp = New-Object System.Drawing.Bitmap(32, 32)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.Clear([System.Drawing.Color]::White)
$scale = [Math]::Min(28 / $src.Width, 28 / $src.Height)
$w = [int][Math]::Floor($src.Width * $scale)
$h = [int][Math]::Floor($src.Height * $scale)
$g.DrawImage($src, [int]((32 - $w) / 2), [int]((32 - $h) / 2), $w, $h)
$g.Dispose()
$hIcon = $bmp.GetHicon()
$icon = [System.Drawing.Icon]::FromHandle($hIcon)
$fs = [System.IO.File]::Create((Join-Path $root 'public\favicon.ico'))
$icon.Save($fs)
$fs.Dispose()
$icon.Dispose()
$bmp.Dispose()
Write-Host "Created: public\favicon.ico (32x32)"

$src.Dispose()
Write-Host "Done."
