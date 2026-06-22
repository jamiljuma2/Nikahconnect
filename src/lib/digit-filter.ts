export const DIGIT_REGEX = /[0-9]/;

export const CHAT_DIGIT_ERROR =
  "Phone numbers, codes, and numerical characters are not allowed in chats. Please use the Number Reveal feature to access contact details.";

export const containsDigit = (text: string) => DIGIT_REGEX.test(text);
