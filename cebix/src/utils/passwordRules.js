export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_HINT = `Mínimo ${PASSWORD_MIN_LENGTH} caracteres, con al menos un número`;
export const PASSWORD_RULE_MESSAGE = `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres e incluir un número.`;

export function passwordProblem(password) {
  if (password.length < PASSWORD_MIN_LENGTH) return PASSWORD_RULE_MESSAGE;
  if (!/[0-9]/.test(password)) return PASSWORD_RULE_MESSAGE;
  return null;
}