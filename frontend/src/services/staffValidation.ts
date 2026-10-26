export function validStaffForm(form: { name: string; username: string; password?: string; pin?: string }, confirmation: string, editing: boolean) {
  if (!form.name.trim() || !form.username.trim()) return false;
  if (form.password && (form.password.length < 8 || form.password.length > 128 || form.password !== confirmation)) return false;
  if (!form.password && confirmation) return false;
  if (form.pin && !/^\d{4,8}$/.test(form.pin)) return false;
  return editing || !!(form.password || form.pin);
}
