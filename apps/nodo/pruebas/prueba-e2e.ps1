# Prueba de extremo a extremo del nodo: GoTrue emite el token, PostgREST lo acepta,
# y la RLS multi-tenant aísla a un bar de otro.
$AUTH = "http://127.0.0.1:55434"
$REST = "http://127.0.0.1:55433"

# OJO: desde la migracion 0078 el trigger handle_new_user SOLO crea empresa si el alta
# trae 'empresa_nombre' en los metadatos (asi las cuentas de operario y las invitaciones
# no generan tenants fantasma). GoTrue mapea el campo 'data' a raw_user_meta_data.
function Alta($email, $empresa) {
  $b = @{ email = $email; password = "Prueba1234!"; data = @{ empresa_nombre = $empresa } } | ConvertTo-Json
  try {
    $r = Invoke-RestMethod "$AUTH/signup" -Method Post -Body $b -ContentType "application/json" -TimeoutSec 10
    return $r.access_token
  } catch {
    # Write-Host, NO Write-Output: lo que sale por Output se COLARIA en el valor devuelto.
    Write-Host "  alta fallo ($email): $($_.ErrorDetails.Message)"
    return $null
  }
}

function Rest($tok, $ruta, $metodo = "Get", $body = $null) {
  $h = @{ Authorization = "Bearer $tok"; apikey = $tok; Prefer = "return=representation" }
  Invoke-RestMethod "$REST$ruta" -Method $metodo -Headers $h -Body $body -ContentType "application/json" -TimeoutSec 10
}

function Claims($tok) {
  $p = $tok.Split([char]46)[1]
  $p = $p.Replace('-', '+').Replace('_', '/')
  $p += '=' * ((4 - $p.Length % 4) % 4)
  return [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($p)) | ConvertFrom-Json
}

Write-Output "== Alta de dos bares distintos por GoTrue =="
# Correos unicos: GoTrue no deja dar de alta dos veces el mismo, y la prueba se repite.
$r = Get-Random -Maximum 999999
$tokA = Alta "uno$r@prueba.local" "Bar Uno"
$tokB = Alta "dos$r@prueba.local" "Bar Dos"
if (-not $tokA -or -not $tokB) { Write-Output "  sin tokens, aborto"; exit 1 }
Write-Output "  Bar Uno: token OK   Bar Dos: token OK"

Write-Output ""
Write-Output "== El JWT de GoTrue lleva el tenant? (hook 0011) =="
$c = Claims $tokA
Write-Output "  role              = $($c.role)"
Write-Output "  tenant_id         = $($c.tenant_id)"
Write-Output "  is_platform_admin = $($c.is_platform_admin)"

Write-Output ""
Write-Output "== Bar Uno crea una categoria via PostgREST =="
$cat = Rest $tokA "/category" "Post" (@{ nombre = "Bebidas del Bar Uno" } | ConvertTo-Json)
Write-Output "  creada: $($cat.nombre)"
Write-Output "  tenant: $($cat.tenant_id)"

Write-Output ""
Write-Output "== Aislamiento: que ve cada bar? =="
# @($null).Count vale 1 en PowerShell: hay que filtrar o una lista vacia parece tener 1.
$vistaA = @(Rest $tokA "/category?select=nombre" | Where-Object { $_ })
$vistaB = @(Rest $tokB "/category?select=nombre" | Where-Object { $_ })
Write-Output "  Bar Uno ve $($vistaA.Count): $(($vistaA.nombre) -join ', ')"
Write-Output "  Bar Dos ve $($vistaB.Count): $(($vistaB.nombre) -join ', ')"

Write-Output ""
if ($vistaA.Count -eq 1 -and $vistaB.Count -eq 0) {
  Write-Output "  RESULTADO: OK - la RLS aisla. Bar Dos NO ve lo de Bar Uno."
} else {
  Write-Output "  RESULTADO: MAL - el aislamiento no funciona."
}
