param([Parameter(Mandatory=$true)][string]$PrinterName, [Parameter(Mandatory=$true)][string]$DataPath, [string]$JobName = 'Karvaan POS document')
$ErrorActionPreference = 'Stop'
# RAW data is sent through an installed Windows printer queue (including USB printers).
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class KarvaanRawPrinter {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public class DOCINFO { public string pDocName; public string pOutputFile; public string pDataType; }
  [DllImport("winspool.drv", EntryPoint="OpenPrinterW", SetLastError=true, CharSet=CharSet.Unicode)]
  public static extern bool OpenPrinter(string name, out IntPtr handle, IntPtr defaults);
  [DllImport("winspool.drv", SetLastError=true)] public static extern bool ClosePrinter(IntPtr handle);
  [DllImport("winspool.drv", EntryPoint="StartDocPrinterW", SetLastError=true, CharSet=CharSet.Unicode)]
  public static extern int StartDocPrinter(IntPtr handle, int level, [In] DOCINFO info);
  [DllImport("winspool.drv", SetLastError=true)] public static extern bool EndDocPrinter(IntPtr handle);
  [DllImport("winspool.drv", SetLastError=true)] public static extern bool StartPagePrinter(IntPtr handle);
  [DllImport("winspool.drv", SetLastError=true)] public static extern bool EndPagePrinter(IntPtr handle);
  [DllImport("winspool.drv", SetLastError=true)] public static extern bool WritePrinter(IntPtr handle, byte[] data, int count, out int written);
}
'@
$printerHandle = [IntPtr]::Zero
$documentStarted = $false
try {
  $receiptBytes = [System.IO.File]::ReadAllBytes($DataPath)
  if ($receiptBytes.Length -eq 0 -or $receiptBytes.Length -gt 1000000) { throw 'Invalid print document' }
  if (-not [KarvaanRawPrinter]::OpenPrinter($PrinterName, [ref]$printerHandle, [IntPtr]::Zero)) { throw 'Windows printer queue was not found' }
  $documentInfo = New-Object KarvaanRawPrinter+DOCINFO
  $documentInfo.pDocName = $JobName
  $documentInfo.pDataType = 'RAW'
  if ([KarvaanRawPrinter]::StartDocPrinter($printerHandle, 1, $documentInfo) -eq 0) { throw 'Windows could not create the print job' }
  $documentStarted = $true
  if (-not [KarvaanRawPrinter]::StartPagePrinter($printerHandle)) { throw 'Windows could not start the print page' }
  $writtenCount = 0
  if (-not [KarvaanRawPrinter]::WritePrinter($printerHandle, $receiptBytes, $receiptBytes.Length, [ref]$writtenCount) -or $writtenCount -ne $receiptBytes.Length) { throw 'Windows did not accept the full document' }
  if (-not [KarvaanRawPrinter]::EndPagePrinter($printerHandle)) { throw 'Windows did not finish the print page' }
  if (-not [KarvaanRawPrinter]::EndDocPrinter($printerHandle)) { throw 'Windows did not finish the print job' }
  Write-Output 'KARVAAN_SPOOL_ACCEPTED'
} catch {
  [Console]::Error.WriteLine($_.Exception.Message)
  if ($documentStarted) { exit 11 } else { exit 10 }
} finally {
  if ($printerHandle -ne [IntPtr]::Zero) { [void][KarvaanRawPrinter]::ClosePrinter($printerHandle) }
}
