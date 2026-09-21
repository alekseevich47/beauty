export function greetingKey():
  'greeting.morning' | 'greeting.day' | 'greeting.evening' | 'greeting.night' {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'greeting.morning';
  if (h >= 12 && h < 17) return 'greeting.day';
  if (h >= 17 && h < 23) return 'greeting.evening';
  return 'greeting.night';
}
