/**
 * Traduz mensagens de erro de autenticação (vindas do backend em inglês)
 * para mensagens claras em pt-BR. Nunca expõe a mensagem crua ao usuário.
 */
export function translateAuthError(message: string | undefined | null): string {
  const m = (message ?? "").toLowerCase();

  if (m.includes("invalid login credentials")) {
    return "E-mail ou senha incorretos. Confira os dados e tente novamente.";
  }
  if (m.includes("email not confirmed")) {
    return "Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.";
  }
  if (m.includes("user not found")) {
    return "Não encontramos uma conta com este e-mail.";
  }
  if (m.includes("password") && (m.includes("at least") || m.includes("should be"))) {
    return "A senha precisa ter pelo menos 6 caracteres.";
  }
  if (m.includes("weak password") || m.includes("password is known") || m.includes("breach")) {
    return "Essa senha é considerada fraca. Escolha uma senha mais segura.";
  }
  if (m.includes("already registered") || m.includes("already been registered") || m.includes("user already exists")) {
    return "Este e-mail já possui uma conta. Tente entrar ou recuperar a senha.";
  }
  if (m.includes("invalid email") || m.includes("unable to validate email")) {
    return "Informe um e-mail válido.";
  }
  if (m.includes("rate limit") || m.includes("too many requests") || m.includes("over_email_send_rate_limit")) {
    return "Muitas tentativas em sequência. Aguarde alguns minutos e tente de novo.";
  }
  if (m.includes("network") || m.includes("failed to fetch") || m.includes("fetch")) {
    return "Falha de conexão. Verifique sua internet e tente novamente.";
  }
  if (m.includes("token") && (m.includes("expired") || m.includes("invalid"))) {
    return "Este link expirou ou já foi usado. Solicite um novo.";
  }
  if (m.includes("same password")) {
    return "A nova senha precisa ser diferente da atual.";
  }

  // Fallback seguro: mensagem genérica sem vazar detalhes técnicos.
  return "Não foi possível concluir agora. Tente novamente em instantes.";
}
