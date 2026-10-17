import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

// Local project settings must never connect unit tests to a real backend.
vi.stubEnv("VITE_SUPABASE_URL", "");
vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "");
vi.stubEnv("VITE_VAPID_PUBLIC_KEY", "");
vi.stubEnv("VITE_APP_URL", "");

Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
  value() {
    this.open = true;
  },
});
Object.defineProperty(HTMLDialogElement.prototype, "close", {
  value() {
    this.open = false;
  },
});
afterEach(() => {
  cleanup();
  localStorage.clear();
});
