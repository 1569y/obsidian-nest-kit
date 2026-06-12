[CmdletBinding()]
param(
	[Parameter(Mandatory = $true)]
	[string]$BatchName,

	[ValidateSet('WorkingTree', 'CommitCheckpoint', 'PushCheckpoint')]
	[string]$Mode = 'WorkingTree',

	[switch]$RunValidation
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if ($BatchName -notmatch '^[A-Za-z0-9._-]+$') {
	throw 'BatchName may contain only letters, numbers, dots, underscores, and hyphens.'
}

function Invoke-GitText {
	param(
		[Parameter(Mandatory = $true)]
		[string[]]$Arguments,

		[switch]$AllowFailure
	)

	$stdoutPath = [System.IO.Path]::GetTempFileName()
	$stderrPath = [System.IO.Path]::GetTempFileName()
	$stdout = ''
	$stderr = ''
	$previousErrorActionPreference = $ErrorActionPreference
	try {
		$ErrorActionPreference = 'Continue'
		& git @Arguments 1> $stdoutPath 2> $stderrPath
		$exitCode = $LASTEXITCODE

		$stdout = if (Test-Path -LiteralPath $stdoutPath) {
			$stdoutText = Get-Content -LiteralPath $stdoutPath -Raw -ErrorAction SilentlyContinue
			if ($null -eq $stdoutText) { '' } else { $stdoutText.TrimEnd() }
		} else {
			''
		}

		$stderr = if (Test-Path -LiteralPath $stderrPath) {
			$stderrText = Get-Content -LiteralPath $stderrPath -Raw -ErrorAction SilentlyContinue
			if ($null -eq $stderrText) { '' } else { $stderrText.TrimEnd() }
		} else {
			''
		}
	} finally {
		$ErrorActionPreference = $previousErrorActionPreference
		Remove-Item -LiteralPath $stdoutPath -Force -ErrorAction SilentlyContinue
		Remove-Item -LiteralPath $stderrPath -Force -ErrorAction SilentlyContinue
	}

	$outputParts = @()
	if (-not [string]::IsNullOrWhiteSpace($stdout)) {
		$outputParts += $stdout
	}
	if (-not [string]::IsNullOrWhiteSpace($stderr)) {
		$outputParts += $stderr
	}
	$output = ($outputParts -join [Environment]::NewLine)

	if (-not $AllowFailure -and $exitCode -ne 0) {
		throw "git $($Arguments -join ' ') failed with exit code $exitCode.`n$output"
	}

	[PSCustomObject]@{
		Command = "git $($Arguments -join ' ')"
		StdOut = $stdout
		StdErr = $stderr
		Output = $output
		ExitCode = $exitCode
	}
}

function Invoke-PowerShellText {
	param(
		[Parameter(Mandatory = $true)]
		[string]$Command
	)

	$stdoutPath = [System.IO.Path]::GetTempFileName()
	$stderrPath = [System.IO.Path]::GetTempFileName()
	$stdout = ''
	$stderr = ''
	$previousErrorActionPreference = $ErrorActionPreference
	try {
		$ErrorActionPreference = 'Continue'
		& powershell -NoProfile -Command $Command 1> $stdoutPath 2> $stderrPath
		$exitCode = $LASTEXITCODE

		$stdout = if (Test-Path -LiteralPath $stdoutPath) {
			$stdoutText = Get-Content -LiteralPath $stdoutPath -Raw -ErrorAction SilentlyContinue
			if ($null -eq $stdoutText) { '' } else { $stdoutText.TrimEnd() }
		} else {
			''
		}

		$stderr = if (Test-Path -LiteralPath $stderrPath) {
			$stderrText = Get-Content -LiteralPath $stderrPath -Raw -ErrorAction SilentlyContinue
			if ($null -eq $stderrText) { '' } else { $stderrText.TrimEnd() }
		} else {
			''
		}
	} finally {
		$ErrorActionPreference = $previousErrorActionPreference
		Remove-Item -LiteralPath $stdoutPath -Force -ErrorAction SilentlyContinue
		Remove-Item -LiteralPath $stderrPath -Force -ErrorAction SilentlyContinue
	}

	$outputParts = @()
	if (-not [string]::IsNullOrWhiteSpace($stdout)) {
		$outputParts += $stdout
	}
	if (-not [string]::IsNullOrWhiteSpace($stderr)) {
		$outputParts += $stderr
	}
	$output = ($outputParts -join [Environment]::NewLine)

	[PSCustomObject]@{
		Command = $Command
		StdOut = $stdout
		StdErr = $stderr
		Output = $output
		ExitCode = $exitCode
	}
}

function Add-Line {
	param(
		[Parameter(Mandatory = $true)]
		[AllowEmptyCollection()]
		[AllowNull()]
		[System.Collections.ArrayList]$Lines,

		[AllowNull()]
		[object]$Value
	)

	$text = if ($null -eq $Value) { '' } else { [string]$Value }
	$Lines.Add($text) | Out-Null
}

function Add-Section {
	param(
		[Parameter(Mandatory = $true)]
		[AllowEmptyCollection()]
		[AllowNull()]
		[System.Collections.ArrayList]$Lines,

		[Parameter(Mandatory = $true)]
		[string]$Title,

		[AllowNull()]
		[object]$Body
	)

	Add-Line -Lines $Lines -Value ">>> $Title"

	$bodyText = if ($null -eq $Body) {
		''
	} elseif ($Body -is [string]) {
		$Body
	} else {
		($Body | Out-String).TrimEnd()
	}

	if ([string]::IsNullOrWhiteSpace($bodyText)) {
		Add-Line -Lines $Lines -Value '(empty)'
	} else {
		foreach ($line in $bodyText -split "`r?`n") {
			Add-Line -Lines $Lines -Value $line
		}
	}

	Add-Line -Lines $Lines -Value ''
}

function Write-Utf8TextFile {
	param(
		[Parameter(Mandatory = $true)]
		[string]$Path,

		[AllowNull()]
		[AllowEmptyString()]
		[string]$Text
	)

	$utf8 = [System.Text.UTF8Encoding]::new($false)
	$content = if ($null -eq $Text) { '' } else { $Text }
	[System.IO.File]::WriteAllText($Path, $content, $utf8)
}

function Write-Utf8LinesFile {
	param(
		[Parameter(Mandatory = $true)]
		[string]$Path,

		[Parameter(Mandatory = $true)]
		[System.Collections.ArrayList]$Lines
	)

	Write-Utf8TextFile -Path $Path -Text (($Lines.ToArray() -join [Environment]::NewLine) + [Environment]::NewLine)
}

function Get-StringArray {
	param(
		[AllowNull()]
		[AllowEmptyString()]
		[string]$Text
	)

	if ([string]::IsNullOrWhiteSpace($Text)) {
		return @()
	}

	return @(
		$Text -split "`r?`n" |
			Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
	)
}

function Get-DiffCheckAnalysis {
	param(
		[Parameter(Mandatory = $true)]
		[pscustomobject]$Result
	)

	$lines = @(Get-StringArray $Result.Output)
	$normalizationWarnings = @()
	$patchErrors = @()

	foreach ($line in $lines) {
		if ($line -match 'LF will be replaced by CRLF|CRLF will be replaced by LF') {
			$normalizationWarnings += $line
			continue
		}

		if ($line -match 'trailing whitespace|space before tab|new blank line at EOF') {
			$patchErrors += $line
			continue
		}

		if ($Result.ExitCode -ne 0) {
			$patchErrors += $line
		}
	}

	[PSCustomObject]@{
		ExitCode = $Result.ExitCode
		HasPatchError = $patchErrors.Count -gt 0
		HasNormalizationWarningOnly =
			($normalizationWarnings.Count -gt 0) -and
			($patchErrors.Count -eq 0)
		NormalizationWarnings = $normalizationWarnings
		PatchErrors = $patchErrors
	}
}

function Get-UpstreamInfo {
	$upstreamNameResult = Invoke-GitText -Arguments @('rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}') -AllowFailure
	if ($upstreamNameResult.ExitCode -ne 0) {
		return [PSCustomObject]@{
			HasUpstream = $false
			NameResult = $upstreamNameResult
			HeadResult = $null
			RemoteName = $null
			RemoteBranch = $null
			ActualRemoteResult = $null
			ActualRemoteHead = $null
			MatchesLocal = $false
			MatchesActualRemote = $false
			ActualRemoteVerificationSucceeded = $false
			ActualRemoteBranchFound = $false
		}
	}

	$upstreamHeadResult = Invoke-GitText -Arguments @('rev-parse', '@{upstream}') -AllowFailure
	$localHeadResult = Invoke-GitText -Arguments @('rev-parse', 'HEAD')
	$upstreamName = $upstreamNameResult.StdOut.Trim()
	$remoteName = $null
	$remoteBranch = $null
	if (-not [string]::IsNullOrWhiteSpace($upstreamName) -and $upstreamName.Contains('/')) {
		$remoteName, $remoteBranch = $upstreamName.Split('/', 2)
	}

	$actualRemoteResult = $null
	$actualRemoteHead = $null
	$actualRemoteVerificationSucceeded = $false
	$actualRemoteBranchFound = $false
	if (-not [string]::IsNullOrWhiteSpace($remoteName) -and -not [string]::IsNullOrWhiteSpace($remoteBranch)) {
		$actualRemoteResult = Invoke-GitText -Arguments @('ls-remote', '--heads', $remoteName, $remoteBranch) -AllowFailure
		if ($actualRemoteResult.ExitCode -eq 0) {
			$actualRemoteVerificationSucceeded = $true
			$actualRemoteLine = @(Get-StringArray $actualRemoteResult.StdOut) | Select-Object -First 1
			if (-not [string]::IsNullOrWhiteSpace($actualRemoteLine)) {
				$actualRemoteHead = ($actualRemoteLine -split '\s+', 2)[0]
				$actualRemoteBranchFound = -not [string]::IsNullOrWhiteSpace($actualRemoteHead)
			}
		}
	}

	$matchesLocal =
		($upstreamHeadResult.ExitCode -eq 0) -and
		($localHeadResult.StdOut -eq $upstreamHeadResult.StdOut)
	$matchesActualRemote =
		$actualRemoteVerificationSucceeded -and
		$actualRemoteBranchFound -and
		($localHeadResult.StdOut -eq $actualRemoteHead)

	return [PSCustomObject]@{
		HasUpstream = $true
		NameResult = $upstreamNameResult
		HeadResult = $upstreamHeadResult
		RemoteName = $remoteName
		RemoteBranch = $remoteBranch
		ActualRemoteResult = $actualRemoteResult
		ActualRemoteHead = $actualRemoteHead
		MatchesLocal = $matchesLocal
		MatchesActualRemote = $matchesActualRemote
		ActualRemoteVerificationSucceeded = $actualRemoteVerificationSucceeded
		ActualRemoteBranchFound = $actualRemoteBranchFound
	}
}

function Get-FileSnapshotBlock {
	param(
		[Parameter(Mandatory = $true)]
		[string]$RelativePath
	)

	$block = [System.Collections.ArrayList]::new()
	Add-Line -Lines $block -Value "## $RelativePath"
	Add-Line -Lines $block -Value ''

	if (-not (Test-Path -LiteralPath $RelativePath)) {
		Add-Line -Lines $block -Value 'MISSING FILE'
		Add-Line -Lines $block -Value ''
		return $block
	}

	$item = Get-Item -LiteralPath $RelativePath
	if ($item.Extension -in @('.png', '.jpg', '.jpeg', '.gif', '.ico', '.pdf', '.zip')) {
		Add-Line -Lines $block -Value 'BINARY FILE - snapshot omitted'
		Add-Line -Lines $block -Value ''
		return $block
	}

	Add-Line -Lines $block -Value '````'
	$content = Get-Content -LiteralPath $RelativePath -Raw
	if (-not [string]::IsNullOrEmpty($content)) {
		foreach ($line in ($content -split "`r?`n")) {
			Add-Line -Lines $block -Value $line
		}
	}
	Add-Line -Lines $block -Value '````'
	Add-Line -Lines $block -Value ''
	return $block
}

function Add-DiffCheckDetails {
	param(
		[Parameter(Mandatory = $true)]
		[System.Collections.ArrayList]$Lines,

		[Parameter(Mandatory = $true)]
		[pscustomobject]$Result,

		[Parameter(Mandatory = $true)]
		[pscustomobject]$Analysis
	)

	Add-Section -Lines $Lines -Title $Result.Command -Body $Result.Output
	Add-Line -Lines $Lines -Value "ExitCode=$($Result.ExitCode)"
	Add-Line -Lines $Lines -Value "HasPatchError=$($Analysis.HasPatchError.ToString().ToLowerInvariant())"
	Add-Line -Lines $Lines -Value "HasNormalizationWarningOnly=$($Analysis.HasNormalizationWarningOnly.ToString().ToLowerInvariant())"
	Add-Line -Lines $Lines -Value ''
}

function Ensure-PathAbsent {
	param(
		[Parameter(Mandatory = $true)]
		[string]$Path,

		[Parameter(Mandatory = $true)]
		[string]$Label
	)

	if (Test-Path -LiteralPath $Path) {
		throw "$Label already exists. Refusing to overwrite: $Path"
	}
}

function Get-RelativePathCompat {
	param(
		[Parameter(Mandatory = $true)]
		[string]$BasePath,

		[Parameter(Mandatory = $true)]
		[string]$TargetPath
	)

	$baseFullPath = [System.IO.Path]::GetFullPath($BasePath)
	$targetFullPath = [System.IO.Path]::GetFullPath($TargetPath)

	if (-not $baseFullPath.EndsWith([System.IO.Path]::DirectorySeparatorChar)) {
		$baseFullPath += [System.IO.Path]::DirectorySeparatorChar
	}

	$baseUri = [System.Uri]::new($baseFullPath)
	$targetUri = [System.Uri]::new($targetFullPath)
	$relativeUri = $baseUri.MakeRelativeUri($targetUri)
	$relativePath = [System.Uri]::UnescapeDataString($relativeUri.ToString())

	return $relativePath.Replace('/', [System.IO.Path]::DirectorySeparatorChar)
}

function Add-RunContextLines {
	param(
		[Parameter(Mandatory = $true)]
		[AllowEmptyCollection()]
		[System.Collections.ArrayList]$Lines,

		[Parameter(Mandatory = $true)]
		[string]$InvocationDirectory,

		[Parameter(Mandatory = $true)]
		[string]$RepositoryRoot
	)

	Add-Line -Lines $Lines -Value "InvocationDirectory=$InvocationDirectory"
	Add-Line -Lines $Lines -Value "RepositoryRoot=$RepositoryRoot"
	Add-Line -Lines $Lines -Value ''
}

$invocationDirectory = (Get-Location).Path
$locationPushed = $false
$stagingRoot = $null
$stagingBundleDir = $null
$stagingZipPath = $null
$finalRoot = $null
$finalBundleDir = $null
$finalZipPath = $null

try {
	$repoRootResult = Invoke-GitText -Arguments @('rev-parse', '--show-toplevel')
	$repositoryRoot = $repoRootResult.StdOut.Trim()
	if ([string]::IsNullOrWhiteSpace($repositoryRoot)) {
		throw 'Unable to determine repository root from git rev-parse --show-toplevel.'
	}

	Push-Location -LiteralPath $repositoryRoot
	$locationPushed = $true

	$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss-fff'
	$shortSha = (Invoke-GitText -Arguments @('rev-parse', '--short', 'HEAD')).StdOut

	switch ($Mode) {
		'WorkingTree' {
			$bundleName = "$BatchName`__working-tree-from-$shortSha`__$timestamp"
		}
		'CommitCheckpoint' {
			$bundleName = "$BatchName`__commit-$shortSha`__$timestamp"
		}
		'PushCheckpoint' {
			$bundleName = "$BatchName`__push-$shortSha`__$timestamp"
		}
	}

	$stagingRoot = Join-Path $env:TEMP 'nest-kit-review-staging'
	$finalRoot = Join-Path $env:TEMP 'nest-kit-review'
	$stagingBundleDir = Join-Path $stagingRoot $bundleName
	$stagingZipPath = Join-Path $stagingRoot "$bundleName.zip"
	$finalBundleDir = Join-Path $finalRoot $bundleName
	$finalZipPath = Join-Path $finalRoot "$bundleName.zip"

	Ensure-PathAbsent -Path $stagingBundleDir -Label 'Staging bundle directory'
	Ensure-PathAbsent -Path $stagingZipPath -Label 'Staging bundle zip'
	Ensure-PathAbsent -Path $finalBundleDir -Label 'Final bundle directory'
	Ensure-PathAbsent -Path $finalZipPath -Label 'Final bundle zip'

	New-Item -ItemType Directory -Path $stagingRoot -Force | Out-Null
	New-Item -ItemType Directory -Path $stagingBundleDir -Force | Out-Null

	$statusShort = Invoke-GitText -Arguments @('status', '--short')
	$statusIgnoredShort = Invoke-GitText -Arguments @('status', '--ignored', '--short')
	$branchCurrent = Invoke-GitText -Arguments @('branch', '--show-current')
	$headFull = Invoke-GitText -Arguments @('rev-parse', 'HEAD')
	$mainFull = Invoke-GitText -Arguments @('rev-parse', 'main')
	$logRecent = Invoke-GitText -Arguments @('log', '--oneline', '--decorate', '-n', '8')
	$diffStatHead = Invoke-GitText -Arguments @('diff', '--stat', 'HEAD')
	$diffNameStatusHead = Invoke-GitText -Arguments @('diff', '--name-status', 'HEAD')
	$diffCheckHead = Invoke-GitText -Arguments @('diff', '--check', 'HEAD') -AllowFailure
	$diffCheckCached = Invoke-GitText -Arguments @('diff', '--cached', '--check') -AllowFailure
	$untrackedResult = Invoke-GitText -Arguments @('ls-files', '--others', '--exclude-standard')
	$ignoredResult = Invoke-GitText -Arguments @('ls-files', '--others', '--ignored', '--exclude-standard')
	$remoteResult = Invoke-GitText -Arguments @('remote', '-v')
	$stagedNameOnly = Invoke-GitText -Arguments @('diff', '--cached', '--name-only')
	$unstagedTracked = Invoke-GitText -Arguments @('diff', '--name-only')
	$trackedChangedNameOnly = Invoke-GitText -Arguments @('diff', '--name-only', 'HEAD', '--')

	$stagedFiles = @(Get-StringArray $stagedNameOnly.StdOut)
	$unstagedTrackedFiles = @(Get-StringArray $unstagedTracked.StdOut)
	$untrackedFiles = @(Get-StringArray $untrackedResult.StdOut)
	$ignoredFiles = @(Get-StringArray $ignoredResult.StdOut)
	$trackedChangedFiles = @(Get-StringArray $trackedChangedNameOnly.StdOut)

	$workingTreeClean =
		($stagedFiles.Count -eq 0) -and
		($unstagedTrackedFiles.Count -eq 0) -and
		($untrackedFiles.Count -eq 0)
	$stagedDiffExists = $stagedFiles.Count -gt 0
	$unstagedTrackedDiffExists = $unstagedTrackedFiles.Count -gt 0
	$untrackedFilesExist = $untrackedFiles.Count -gt 0
	$ignoredFilesExist = $ignoredFiles.Count -gt 0

	$diffCheckHeadAnalysis = Get-DiffCheckAnalysis -Result $diffCheckHead
	$diffCheckCachedAnalysis = Get-DiffCheckAnalysis -Result $diffCheckCached

	$bundleFiles = [System.Collections.Generic.List[string]]::new()

	$validationPath = Join-Path $stagingBundleDir 'validation.txt'
	$validationLines = [System.Collections.ArrayList]::new()
	if ($RunValidation) {
		Add-Line -Lines $validationLines -Value 'Validation requested: true'
		Add-Line -Lines $validationLines -Value ''
		foreach ($entry in @(
			@{ Command = 'npm run lint'; Script = 'npm run lint' },
			@{ Command = 'npm run build'; Script = 'npm run build' }
		)) {
			Add-Line -Lines $validationLines -Value ">>> $($entry.Command)"
			$result = Invoke-PowerShellText -Command $entry.Script
			$text = $result.Output
			$exitCode = $result.ExitCode
			if ([string]::IsNullOrWhiteSpace($text)) {
				Add-Line -Lines $validationLines -Value '(empty)'
			} else {
				foreach ($line in $text -split "`r?`n") {
					Add-Line -Lines $validationLines -Value $line
				}
			}
			Add-Line -Lines $validationLines -Value "ExitCode=$exitCode"
			Add-Line -Lines $validationLines -Value ''
			if ($exitCode -ne 0) {
				Write-Utf8LinesFile -Path $validationPath -Lines $validationLines
				throw "Validation command failed: $($entry.Command)"
			}
		}
	} else {
		Add-Line -Lines $validationLines -Value 'Validation not requested.'
	}
	Write-Utf8LinesFile -Path $validationPath -Lines $validationLines
	$bundleFiles.Add($validationPath) | Out-Null

	switch ($Mode) {
		'WorkingTree' {
			$reviewSummaryPath = Join-Path $stagingBundleDir 'review-summary.txt'
			$reviewLines = [System.Collections.ArrayList]::new()
			Add-Line -Lines $reviewLines -Value 'Review summary'
			Add-Line -Lines $reviewLines -Value ''
			Add-RunContextLines -Lines $reviewLines -InvocationDirectory $invocationDirectory -RepositoryRoot $repositoryRoot
			Add-Line -Lines $reviewLines -Value "Bundle name: $bundleName"
			Add-Line -Lines $reviewLines -Value "Staging bundle directory: $stagingBundleDir"
			Add-Line -Lines $reviewLines -Value "Final bundle directory: $finalBundleDir"
			Add-Line -Lines $reviewLines -Value "Working tree clean: $($workingTreeClean.ToString().ToLowerInvariant())"
			Add-Line -Lines $reviewLines -Value "Staged diff exists: $($stagedDiffExists.ToString().ToLowerInvariant())"
			Add-Line -Lines $reviewLines -Value "Unstaged tracked diff exists: $($unstagedTrackedDiffExists.ToString().ToLowerInvariant())"
			Add-Line -Lines $reviewLines -Value "Untracked files exist: $($untrackedFilesExist.ToString().ToLowerInvariant())"
			Add-Line -Lines $reviewLines -Value "Ignored files exist: $($ignoredFilesExist.ToString().ToLowerInvariant())"
			Add-Line -Lines $reviewLines -Value ''
			Add-Section -Lines $reviewLines -Title $statusShort.Command -Body $statusShort.Output
			Add-Section -Lines $reviewLines -Title $statusIgnoredShort.Command -Body $statusIgnoredShort.Output
			Add-Section -Lines $reviewLines -Title $branchCurrent.Command -Body $branchCurrent.Output
			Add-Section -Lines $reviewLines -Title $headFull.Command -Body $headFull.Output
			Add-Section -Lines $reviewLines -Title $logRecent.Command -Body $logRecent.Output
			Add-Section -Lines $reviewLines -Title $diffStatHead.Command -Body $diffStatHead.Output
			Add-Section -Lines $reviewLines -Title $diffNameStatusHead.Command -Body $diffNameStatusHead.Output
			Add-DiffCheckDetails -Lines $reviewLines -Result $diffCheckHead -Analysis $diffCheckHeadAnalysis
			Add-DiffCheckDetails -Lines $reviewLines -Result $diffCheckCached -Analysis $diffCheckCachedAnalysis
			Add-Section -Lines $reviewLines -Title $untrackedResult.Command -Body $untrackedResult.Output
			Add-Section -Lines $reviewLines -Title $remoteResult.Command -Body $remoteResult.Output
			Write-Utf8LinesFile -Path $reviewSummaryPath -Lines $reviewLines
			$bundleFiles.Add($reviewSummaryPath) | Out-Null

			$trackedChangesPath = Join-Path $stagingBundleDir 'tracked-changes.patch'
			$trackedPatch = Invoke-GitText -Arguments @(
				'diff',
				'--no-ext-diff',
				'--src-prefix=a/',
				'--dst-prefix=b/',
				'HEAD',
				'--'
			)
			Write-Utf8TextFile -Path $trackedChangesPath -Text $trackedPatch.StdOut
			$bundleFiles.Add($trackedChangesPath) | Out-Null

			$docsChangesPath = Join-Path $stagingBundleDir 'docs-changes.patch'
			$docsPatch = Invoke-GitText -Arguments @(
				'diff',
				'--no-ext-diff',
				'--src-prefix=a/',
				'--dst-prefix=b/',
				'HEAD',
				'--',
				'docs/'
			)
			Write-Utf8TextFile -Path $docsChangesPath -Text $docsPatch.StdOut
			$bundleFiles.Add($docsChangesPath) | Out-Null

			$snapshotPath = Join-Path $stagingBundleDir 'source-snapshot.md'
			$snapshotLines = [System.Collections.ArrayList]::new()
			Add-Line -Lines $snapshotLines -Value '# Source snapshot'
			Add-Line -Lines $snapshotLines -Value ''
			$snapshotTargets = @(
				$untrackedFiles +
				$trackedChangedFiles
			) | Where-Object { $_ } | Select-Object -Unique

			foreach ($file in $snapshotTargets) {
				foreach ($line in Get-FileSnapshotBlock -RelativePath $file) {
					Add-Line -Lines $snapshotLines -Value $line
				}
			}

			Write-Utf8LinesFile -Path $snapshotPath -Lines $snapshotLines
			$bundleFiles.Add($snapshotPath) | Out-Null

			$artifactsPath = Join-Path $stagingBundleDir 'build-artifacts-check.txt'
			$artifactLines = [System.Collections.ArrayList]::new()
			$artifactCommands = @(
				'Get-ChildItem -Path . -Filter main.js -Recurse | Select-Object FullName, Length, LastWriteTime',
				'git ls-files -- main.js',
				'git check-ignore -v main.js',
				'git status --short --ignored -- main.js',
				'Get-FileHash .\main.js -Algorithm SHA256'
			)
			$artifactResults = @{}
			foreach ($command in $artifactCommands) {
				$result = Invoke-PowerShellText -Command $command
				$artifactResults[$command] = $result
				Add-Section -Lines $artifactLines -Title $command -Body $result.Output
				Add-Line -Lines $artifactLines -Value "ExitCode=$($result.ExitCode)"
				Add-Line -Lines $artifactLines -Value ''
			}

			$mainJsExists = Test-Path -LiteralPath '.\main.js'
			$mainJsItem = if ($mainJsExists) { Get-Item -LiteralPath '.\main.js' } else { $null }
			$mainJsHashMatch = [regex]::Match(
				$artifactResults['Get-FileHash .\main.js -Algorithm SHA256'].StdOut,
				'[A-F0-9]{64}'
			)
			$mainJsSha256 = if ($mainJsHashMatch.Success) {
				$mainJsHashMatch.Value
			} else {
				'(missing)'
			}

			Add-Line -Lines $artifactLines -Value "main.js exists: $($mainJsExists.ToString().ToLowerInvariant())"
			Add-Line -Lines $artifactLines -Value "main.js tracked by Git: $(if ([string]::IsNullOrWhiteSpace($artifactResults['git ls-files -- main.js'].StdOut)) { 'false' } else { 'true' })"
			Add-Line -Lines $artifactLines -Value "main.js ignored: $(if ([string]::IsNullOrWhiteSpace($artifactResults['git check-ignore -v main.js'].StdOut)) { 'false' } else { 'true' })"
			Add-Line -Lines $artifactLines -Value "main.js path: $(if ($mainJsItem) { $mainJsItem.FullName } else { '(missing)' })"
			Add-Line -Lines $artifactLines -Value "main.js size: $(if ($mainJsItem) { $mainJsItem.Length } else { '(missing)' })"
			Add-Line -Lines $artifactLines -Value "main.js SHA256: $mainJsSha256"
			Write-Utf8LinesFile -Path $artifactsPath -Lines $artifactLines
			$bundleFiles.Add($artifactsPath) | Out-Null
		}
		'CommitCheckpoint' {
			$commitSummaryPath = Join-Path $stagingBundleDir 'commit-summary.txt'
			$commitLines = [System.Collections.ArrayList]::new()
			$commitDiffCheck = Invoke-GitText -Arguments @('diff', 'HEAD^', 'HEAD', '--check') -AllowFailure
			$commitDiffCheckAnalysis = Get-DiffCheckAnalysis -Result $commitDiffCheck
			Add-RunContextLines -Lines $commitLines -InvocationDirectory $invocationDirectory -RepositoryRoot $repositoryRoot
			Add-Section -Lines $commitLines -Title 'git rev-parse HEAD' -Body $headFull.Output
			Add-Section -Lines $commitLines -Title 'git log -1 --format=fuller' -Body (Invoke-GitText -Arguments @('log', '-1', '--format=fuller')).Output
			Add-Section -Lines $commitLines -Title 'git show --stat --oneline --decorate HEAD' -Body (Invoke-GitText -Arguments @('show', '--stat', '--oneline', '--decorate', 'HEAD')).Output
			Add-Section -Lines $commitLines -Title 'git show --name-status --format=fuller HEAD' -Body (Invoke-GitText -Arguments @('show', '--name-status', '--format=fuller', 'HEAD')).Output
			Write-Utf8LinesFile -Path $commitSummaryPath -Lines $commitLines
			$bundleFiles.Add($commitSummaryPath) | Out-Null

			$committedPatchPath = Join-Path $stagingBundleDir 'committed-changes.patch'
			$committedPatch = Invoke-GitText -Arguments @(
				'diff',
				'--no-ext-diff',
				'--src-prefix=a/',
				'--dst-prefix=b/',
				'HEAD^',
				'HEAD',
				'--'
			)
			Write-Utf8TextFile -Path $committedPatchPath -Text $committedPatch.StdOut
			$bundleFiles.Add($committedPatchPath) | Out-Null

			$postCommitStatusPath = Join-Path $stagingBundleDir 'post-commit-status.txt'
			$postCommitLines = [System.Collections.ArrayList]::new()
			Add-Section -Lines $postCommitLines -Title $statusShort.Command -Body $statusShort.Output
			Add-Section -Lines $postCommitLines -Title $branchCurrent.Command -Body $branchCurrent.Output
			Add-Section -Lines $postCommitLines -Title $headFull.Command -Body $headFull.Output
			Add-Section -Lines $postCommitLines -Title $logRecent.Command -Body $logRecent.Output
			Add-DiffCheckDetails -Lines $postCommitLines -Result $commitDiffCheck -Analysis $commitDiffCheckAnalysis
			Add-Section -Lines $postCommitLines -Title $remoteResult.Command -Body $remoteResult.Output
			Write-Utf8LinesFile -Path $postCommitStatusPath -Lines $postCommitLines
			$bundleFiles.Add($postCommitStatusPath) | Out-Null
		}
		'PushCheckpoint' {
			$pushSummaryPath = Join-Path $stagingBundleDir 'push-summary.txt'
			$pushLines = [System.Collections.ArrayList]::new()
			$upstreamInfo = Get-UpstreamInfo
			Add-RunContextLines -Lines $pushLines -InvocationDirectory $invocationDirectory -RepositoryRoot $repositoryRoot
			Add-Section -Lines $pushLines -Title $statusShort.Command -Body $statusShort.Output
			Add-Section -Lines $pushLines -Title 'git branch -vv' -Body (Invoke-GitText -Arguments @('branch', '-vv')).Output
			Add-Section -Lines $pushLines -Title $headFull.Command -Body $headFull.Output
			Add-Section -Lines $pushLines -Title $mainFull.Command -Body $mainFull.Output
			Add-Line -Lines $pushLines -Value "Current branch: $($branchCurrent.StdOut)"
			if ($upstreamInfo.HasUpstream) {
				Add-Section -Lines $pushLines -Title $upstreamInfo.NameResult.Command -Body $upstreamInfo.NameResult.Output
				Add-Section -Lines $pushLines -Title 'git rev-parse @{upstream}' -Body $upstreamInfo.HeadResult.Output
				Add-Line -Lines $pushLines -Value "Tracked upstream name: $($upstreamInfo.NameResult.StdOut)"
				Add-Line -Lines $pushLines -Value "Local HEAD: $($headFull.StdOut)"
				Add-Line -Lines $pushLines -Value "Tracked upstream HEAD: $($upstreamInfo.HeadResult.StdOut)"
				if ($upstreamInfo.ActualRemoteResult) {
					Add-Section -Lines $pushLines -Title $upstreamInfo.ActualRemoteResult.Command -Body $upstreamInfo.ActualRemoteResult.Output
				}
				if (-not $upstreamInfo.ActualRemoteVerificationSucceeded) {
					Add-Line -Lines $pushLines -Value 'Actual remote verification failed.'
				} elseif (-not $upstreamInfo.ActualRemoteBranchFound) {
					Add-Line -Lines $pushLines -Value 'Actual remote branch not found.'
				} else {
					Add-Line -Lines $pushLines -Value "Actual remote HEAD: $($upstreamInfo.ActualRemoteHead)"
				}
				Add-Line -Lines $pushLines -Value "Local and tracked upstream match: $($upstreamInfo.MatchesLocal.ToString().ToLowerInvariant())"
				Add-Line -Lines $pushLines -Value "Local and actual remote match: $($upstreamInfo.MatchesActualRemote.ToString().ToLowerInvariant())"
				Add-Line -Lines $pushLines -Value "Actual remote verification succeeded: $($upstreamInfo.ActualRemoteVerificationSucceeded.ToString().ToLowerInvariant())"
				Add-Line -Lines $pushLines -Value ''
			} else {
				Add-Line -Lines $pushLines -Value '>>> git rev-parse --abbrev-ref --symbolic-full-name @{upstream}'
				Add-Line -Lines $pushLines -Value 'No upstream configured.'
				Add-Line -Lines $pushLines -Value ''
			}
			Add-Section -Lines $pushLines -Title 'git ls-remote --heads origin' -Body (Invoke-GitText -Arguments @('ls-remote', '--heads', 'origin') -AllowFailure).Output
			Add-Section -Lines $pushLines -Title $logRecent.Command -Body $logRecent.Output
			Add-Section -Lines $pushLines -Title 'git tag --list' -Body (Invoke-GitText -Arguments @('tag', '--list')).Output
			Write-Utf8LinesFile -Path $pushSummaryPath -Lines $pushLines
			$bundleFiles.Add($pushSummaryPath) | Out-Null
		}
	}

	$manifestPath = Join-Path $stagingBundleDir 'bundle-manifest.txt'
	$manifestLines = [System.Collections.ArrayList]::new()
	Add-Line -Lines $manifestLines -Value "BundleName=$bundleName"
	Add-Line -Lines $manifestLines -Value "BundleMode=$Mode"
	Add-Line -Lines $manifestLines -Value "BundleTimestamp=$timestamp"
	Add-Line -Lines $manifestLines -Value "InvocationDirectory=$invocationDirectory"
	Add-Line -Lines $manifestLines -Value "RepositoryRoot=$repositoryRoot"
	Add-Line -Lines $manifestLines -Value "StagingDirectory=$stagingBundleDir"
	Add-Line -Lines $manifestLines -Value "FinalDirectory=$finalBundleDir"
	Add-Line -Lines $manifestLines -Value ''

	foreach ($file in $bundleFiles | Select-Object -Unique) {
		$item = Get-Item -LiteralPath $file
		$hash = Get-FileHash -LiteralPath $file -Algorithm SHA256
		$relativePath = Get-RelativePathCompat -BasePath $stagingBundleDir -TargetPath $item.FullName
		$finalPath = Join-Path $finalBundleDir $relativePath
		Add-Line -Lines $manifestLines -Value "FILE=$($item.Name)"
		Add-Line -Lines $manifestLines -Value "RELATIVE_PATH=$relativePath"
		Add-Line -Lines $manifestLines -Value "FINAL_PATH=$finalPath"
		Add-Line -Lines $manifestLines -Value "SIZE=$($item.Length)"
		Add-Line -Lines $manifestLines -Value "SHA256=$($hash.Hash)"
		Add-Line -Lines $manifestLines -Value ''
	}

	Write-Utf8LinesFile -Path $manifestPath -Lines $manifestLines

	Compress-Archive -Path (Join-Path $stagingBundleDir '*') -DestinationPath $stagingZipPath

	Ensure-PathAbsent -Path $finalBundleDir -Label 'Final bundle directory'
	Ensure-PathAbsent -Path $finalZipPath -Label 'Final bundle zip'

	$publishedFinalBundle = $false
	$publishedFinalZip = $false
	New-Item -ItemType Directory -Path $finalRoot -Force | Out-Null
	try {
		Move-Item -LiteralPath $stagingBundleDir -Destination $finalBundleDir
		$publishedFinalBundle = $true
		Move-Item -LiteralPath $stagingZipPath -Destination $finalZipPath
		$publishedFinalZip = $true
	} catch {
		if ($publishedFinalZip -and (Test-Path -LiteralPath $finalZipPath)) {
			Remove-Item -LiteralPath $finalZipPath -Force
		}
		if ($publishedFinalBundle -and (Test-Path -LiteralPath $finalBundleDir)) {
			Remove-Item -LiteralPath $finalBundleDir -Recurse -Force
		}
		Write-Output 'Partial publication rolled back.'
		throw
	}

	$zipItem = Get-Item -LiteralPath $finalZipPath
	$zipHash = Get-FileHash -LiteralPath $finalZipPath -Algorithm SHA256

	Write-Output "StagingRoot=$stagingRoot"
	Write-Output "FinalRoot=$finalRoot"
	Write-Output "BundleDirectory=$finalBundleDir"
	Write-Output "BundleName=$bundleName"
	Write-Output "BundleTimestamp=$timestamp"
	Write-Output "UploadZipPath=$($zipItem.FullName)"
	Write-Output "UploadZipSize=$($zipItem.Length)"
	Write-Output "UploadZipSHA256=$($zipHash.Hash)"
} catch {
	if ($stagingRoot) {
		Write-Output "StagingRoot=$stagingRoot"
	}
	if ($stagingBundleDir) {
		Write-Output "StagingDirectory=$stagingBundleDir"
	}
	throw
} finally {
	if ($locationPushed) {
		Pop-Location
	}
}
