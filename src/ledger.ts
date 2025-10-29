export const DEMO_MODE = true;

const uidKey = 'demo_user_id';

export function getDemoUserId() {
  let id = localStorage.getItem(uidKey);
  if (!id) { 
    id = crypto.randomUUID(); 
    localStorage.setItem(uidKey, id); 
  }
  return id;
}

export function getBalance(userId: string) {
  const v = localStorage.getItem(`bal_${userId}`);
  return v ? Number(v) : 0;
}

export function setBalance(userId: string, value: number) {
  localStorage.setItem(`bal_${userId}`, String(value));
}
