export function getBusinessDayBounds(dateStr?: string | Date) {
  // Convert input or now to UTC
  const now = dateStr ? new Date(dateStr) : new Date();
  
  // Convert UTC to IST (+5:30)
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(now.getTime() + istOffset);
  
  // Get components in IST
  const year = istNow.getUTCFullYear();
  const month = istNow.getUTCMonth(); // 0-indexed
  const day = istNow.getUTCDate();
  const hour = istNow.getUTCHours();
  
  // Determine logical business day
  let logicalStart = new Date(Date.UTC(year, month, day));
  if (hour < 3) {
    // Before 3 AM IST belongs to previous day
    logicalStart.setUTCDate(logicalStart.getUTCDate() - 1);
  }
  
  // The logical start in IST is 3:00 AM of the logical day
  // To get UTC time, we take the logicalStart (which is 00:00:00 UTC)
  // add 3 hours to represent 3:00 AM, and SUBTRACT the IST offset
  const startUtc = new Date(logicalStart.getTime() + (3 * 60 * 60 * 1000) - istOffset);
  
  // End is exactly 24 hours after start minus 1ms
  const endUtc = new Date(startUtc.getTime() + (24 * 60 * 60 * 1000) - 1);
  
  return { start: startUtc, end: endUtc };
}
