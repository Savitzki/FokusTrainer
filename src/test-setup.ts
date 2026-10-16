import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

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
