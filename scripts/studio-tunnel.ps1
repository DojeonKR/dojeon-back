# EC2 Postgres SSH 터널 (Prisma Studio용)
# 사용: .\scripts\studio-tunnel.ps1 -KeyPath "C:\path\to\key.pem" -Host 3.36.201.255
param(
  [Parameter(Mandatory = $true)]
  [string] $KeyPath,
  [string] $Ec2Host = '3.36.201.255',
  [string] $User = 'ubuntu',
  [int] $LocalPort = 5433,
  [int] $RemotePort = 5432
)

Write-Host "터널: 127.0.0.1:${LocalPort} -> ${Ec2Host}:${RemotePort}"
Write-Host "이 창을 연 채로 다른 터미널에서: npm run studio:remote"
ssh -i $KeyPath -L "${LocalPort}:127.0.0.1:${RemotePort}" "${User}@${Ec2Host}"
