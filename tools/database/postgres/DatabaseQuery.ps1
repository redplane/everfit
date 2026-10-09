<#
.SYNOPSIS
  Small PostgreSQL helper for listing tables, describing table structure, and viewing data.

.REQUIREMENTS
  PostgreSQL psql CLI must be installed and available on PATH.

.USAGE
  .\DatabaseQuery.ps1 -Action ListTables
  .\DatabaseQuery.ps1 -Action DescribeTable -Table users
  .\DatabaseQuery.ps1 -Action GetData -Table users -Limit 25
  .\DatabaseQuery.ps1 -Action Query -Sql "select now();"

.ENV FILE
  By default the script reads .env from the same directory as this script.
#>

[CmdletBinding()]
param(
    [ValidateSet('ListTables', 'DescribeTable', 'GetData', 'Query')]
    [string]$Action = 'ListTables',

    [string]$Table,

    [int]$Limit = 50,

    [string]$Sql,

    [string]$EnvFile = (Join-Path $PSScriptRoot '.env')
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Import-EnvFile {
    param([Parameter(Mandatory)][string]$Path)

    if (-not (Test-Path -LiteralPath $Path)) {
        throw "Env file not found: $Path"
    }

    Get-Content -LiteralPath $Path | ForEach-Object {
        $line = $_.Trim()
        if ($line.Length -eq 0 -or $line.StartsWith('#')) { return }

        $parts = $line -split '=', 2
        if ($parts.Count -ne 2) { return }

        $name = $parts[0].Trim()
        $value = $parts[1].Trim()

        if ($value.Length -ge 2) {
            $first = $value.Substring(0, 1)
            $last = $value.Substring($value.Length - 1, 1)
            if (($first -eq '"' -and $last -eq '"') -or ($first -eq "'" -and $last -eq "'")) {
                $value = $value.Substring(1, $value.Length - 2)
            }
        }

        [Environment]::SetEnvironmentVariable($name, $value, 'Process')
    }
}

function Get-RequiredEnv {
    param([Parameter(Mandatory)][string]$Name)

    $value = [Environment]::GetEnvironmentVariable($Name, 'Process')
    if ([string]::IsNullOrWhiteSpace($value)) {
        throw "Missing required environment variable: $Name"
    }

    return $value
}

function Quote-Identifier {
    param([Parameter(Mandatory)][string]$Identifier)

    return '"' + ($Identifier -replace '"', '""') + '"'
}

function Get-QualifiedTableName {
    param(
        [Parameter(Mandatory)][string]$Schema,
        [Parameter(Mandatory)][string]$TableName
    )

    if ($TableName.Contains('.')) {
        $segments = $TableName -split '\.', 2
        return "$(Quote-Identifier $segments[0]).$(Quote-Identifier $segments[1])"
    }

    return "$(Quote-Identifier $Schema).$(Quote-Identifier $TableName)"
}

function Invoke-Psql {
    param(
        [Parameter(Mandatory)][string]$CommandText,
        [switch]$TuplesOnly
    )

    $args = @(
        '--host', $script:DbHostname,
        '--port', $script:DbPort,
        '--dbname', $script:DbName,
        '--username', $script:DbUsername,
        '--set', 'ON_ERROR_STOP=1',
        '--command', $CommandText
    )

    if ($TuplesOnly) {
        $args = @('--tuples-only', '--no-align') + $args
    }

    $env:PGPASSWORD = $script:DbPassword
    try {
        & psql @args
        if ($LASTEXITCODE -ne 0) {
            throw "psql failed with exit code $LASTEXITCODE"
        }
    }
    finally {
        Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
    }
}

Import-EnvFile -Path $EnvFile

$script:DbHostname = Get-RequiredEnv 'DB_HOSTNAME'
$script:DbPort = Get-RequiredEnv 'DB_PORT'
$script:DbName = Get-RequiredEnv 'DB_NAME'
$script:DbSchema = Get-RequiredEnv 'DB_SCHEMA'
$script:DbUsername = Get-RequiredEnv 'DB_USERNAME'
$script:DbPassword = Get-RequiredEnv 'DB_PASSWORD'

if (-not (Get-Command psql -ErrorAction SilentlyContinue)) {
    throw 'psql was not found on PATH. Install PostgreSQL client tools or add psql.exe to PATH.'
}

switch ($Action) {
    'ListTables' {
        $query = @"
select table_schema, table_name, table_type
from information_schema.tables
where table_schema = '$($script:DbSchema -replace "'", "''")'
order by table_name;
"@
        Invoke-Psql -CommandText $query
    }

    'DescribeTable' {
        if ([string]::IsNullOrWhiteSpace($Table)) {
            throw 'Use -Table when Action is DescribeTable.'
        }

        $schemaForLookup = $script:DbSchema
        $tableForLookup = $Table
        if ($Table.Contains('.')) {
            $segments = $Table -split '\.', 2
            $schemaForLookup = $segments[0]
            $tableForLookup = $segments[1]
        }

        $query = @"
select
    ordinal_position,
    column_name,
    data_type,
    is_nullable,
    column_default
from information_schema.columns
where table_schema = '$($schemaForLookup -replace "'", "''")'
  and table_name = '$($tableForLookup -replace "'", "''")'
order by ordinal_position;
"@
        Invoke-Psql -CommandText $query
    }

    'GetData' {
        if ([string]::IsNullOrWhiteSpace($Table)) {
            throw 'Use -Table when Action is GetData.'
        }
        if ($Limit -lt 1) {
            throw 'Limit must be 1 or greater.'
        }

        $qualifiedTable = Get-QualifiedTableName -Schema $script:DbSchema -TableName $Table
        Invoke-Psql -CommandText "select * from $qualifiedTable limit $Limit;"
    }

    'Query' {
        if ([string]::IsNullOrWhiteSpace($Sql)) {
            throw 'Use -Sql when Action is Query.'
        }

        Invoke-Psql -CommandText $Sql
    }
}
