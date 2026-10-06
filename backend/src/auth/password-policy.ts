export const PASSWORD_MAX_LENGTH = 128;

// 8+ characters with a letter (any script), an ASCII digit, and a symbol (not a letter, mark, number or whitespace).
export const PASSWORD_POLICY_REGEX =
  /^(?=.*\p{L})(?=.*\d)(?=.*[^\p{L}\p{M}\p{N}\s]).{8,}$/su;

export const PASSWORD_POLICY_MESSAGE =
  'Password must be at least 8 characters and contain a letter, a number and a special character';
