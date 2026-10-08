// Set when a password reset link logs someone in, and cleared once they've chosen a new
// password (or cancelled). While it's set, the proxy keeps them on /reset-password.
export const RESET_PENDING_COOKIE = "sf-reset-pending";
