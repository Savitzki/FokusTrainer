import { shiftDate } from "./model";
export function shiftMonth(month: string, delta: number) {
  const date = new Date(`${month}-01T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + delta);
  return date.toISOString().slice(0, 7);
}
export function calendarDays(month: string) {
  const first = `${month}-01`;
  const weekday = (new Date(`${first}T12:00:00Z`).getUTCDay() + 6) % 7;
  const last = shiftDate(`${shiftMonth(month, 1)}-01`, -1);
  const length = Math.ceil((weekday + Number(last.slice(-2))) / 7) * 7;
  return Array.from({ length }, (_, i) => shiftDate(first, i - weekday));
}
