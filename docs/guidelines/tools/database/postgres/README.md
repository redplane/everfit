# PostgreSQL query helper

`DatabaseQuery.ps1` is a small PowerShell helper for inspecting a PostgreSQL
database: listing tables, describing a table's structure, and viewing data.

## Requirements

- PowerShell 7+
- PostgreSQL `psql` CLI available on `PATH`

## Setup

Copy `.env.example` to `.env` and fill in your connection details. The `.env`
file is git-ignored so credentials are never committed.

```
cp .env.example .env
```

The script reads `.env` from its own directory by default; override with
`-EnvFile <path>`.

## Usage

```powershell
./DatabaseQuery.ps1 -Action ListTables
./DatabaseQuery.ps1 -Action DescribeTable -Table users
./DatabaseQuery.ps1 -Action GetData -Table users -Limit 25
./DatabaseQuery.ps1 -Action Query -Sql "select now();"
```
