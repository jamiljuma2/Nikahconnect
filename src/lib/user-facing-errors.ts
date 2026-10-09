import { toast } from "sonner";

type ErrorDetails = {
  message?: string;
  code?: string;
  status?: number;
  statusCode?: number;
  cause?: unknown;
  context?: unknown;
};

function getDetails(error: unknown): ErrorDetails {
  if (error && typeof error === "object") {
    const details = error as ErrorDetails;
    const cause = details.cause && typeof details.cause === "object" ? details.cause as ErrorDetails : {};
    const context = details.context && typeof details.context === "object" ? details.context as ErrorDetails : {};
    return {
      ...details,
      message: details.message ?? cause.message,
      code: details.code ?? cause.code,
      status: details.status ?? details.statusCode ?? context.status ?? cause.status ?? cause.statusCode,
    };
  }
  return { message: typeof error === "string" ? error : undefined };
}

export function isAccessDeniedError(error: unknown) {
  const details = getDetails(error);
  const message = details.message?.toLowerCase() ?? "";
  return (
    details.status === 401 ||
    details.status === 403 ||
    ["42501", "PGRST301"].includes(details.code ?? "") ||
    /permission denied|row-level security|not authorized|unauthorized|access denied|insufficient privilege|\bforbidden\b/.test(message)
  );
}

export function userFacingErrorMessage(error: unknown, fallback = "We couldn’t complete that request. Please try again.") {
  const details = getDetails(error);
  const message = details.message?.trim() ?? "";
  const normalized = message.toLowerCase();

  if (isAccessDeniedError(error)) {
    if (details.status === 401 || details.code === "PGRST301" || /session|jwt|token/.test(normalized)) {
      return "Please sign in again to continue.";
    }
    return "This feature isn’t available for your account right now. If you think this is a mistake, contact support.";
  }
  if (/invalid login credentials/.test(normalized)) return "Your email or password doesn’t match. Check your details and try again.";
  if (/failed to fetch|network request failed|fetch failed|networkerror/.test(normalized)) {
    return "We’re having trouble connecting. Check your internet connection and try again.";
  }
  if (!message || /^(error|unknown error)$/i.test(message)) return fallback;
  if (/\b(postgres|postgresql|supabase|sqlstate|pgrst\d+|rpc\(|row-level security|jwt|stack trace)\b/i.test(message)) return fallback;
  return message;
}

export function notifyUserError(error: unknown, fallback?: string) {
  const message = userFacingErrorMessage(error, fallback);
  if (isAccessDeniedError(error)) toast.info(message);
  else toast.error(message);
}
