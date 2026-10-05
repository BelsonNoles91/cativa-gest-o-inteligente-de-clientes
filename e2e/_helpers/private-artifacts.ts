/**
 * Playwright traces and HTML reports can contain authenticated page state.
 * Create generated files as owner-only on POSIX systems by default.
 */
if (process.platform !== "win32") {
  process.umask(0o077);
}
