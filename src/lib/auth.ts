// Sessão do admin (client-side). A verificação da senha acontece no servidor
// via a server function `adminLogin` (bcrypt + rate limiting por IP no Supabase);
// aqui só guardamos um marcador de sessão para a navegação do painel.
const KEY = "bruna_admin_session_v1";
const PW_KEY = "bruna_admin_pw_v1";

// Guarda a senha da sessão em memória de aba (sessionStorage) para reutilizar
// nas chamadas autenticadas do admin (listar/salvar produtos, pedidos, etc.).
export function setSession(password: string) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(KEY, "1");
  sessionStorage.setItem(PW_KEY, password);
}
export function getPassword(): string {
  if (typeof window === "undefined") return "";
  return sessionStorage.getItem(PW_KEY) ?? "";
}
export function logout() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(KEY);
  sessionStorage.removeItem(PW_KEY);
}
export function isAuthed(): boolean {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(KEY) === "1";
}
