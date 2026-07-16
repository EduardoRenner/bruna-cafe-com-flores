const KEY = "bruna_admin_session_v1";
const CREDS = { email: "admin@brunacafe.com.br", password: "bruna2024" };

export function login(email: string, password: string): boolean {
  if (email.trim().toLowerCase() === CREDS.email && password === CREDS.password) {
    if (typeof window !== "undefined") sessionStorage.setItem(KEY, "1");
    return true;
  }
  return false;
}
export function logout() {
  if (typeof window !== "undefined") sessionStorage.removeItem(KEY);
}
export function isAuthed(): boolean {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(KEY) === "1";
}
