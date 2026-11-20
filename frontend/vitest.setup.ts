import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

/**
 * jsdom has the <dialog> element but not its methods. This reproduces the two behaviours the tests depend on: the
 * `open` attribute toggles with show/showModal/close, and close() fires a `close` event (asynchronously, as the
 * platform does). Focus trapping, inertness and Escape are the browser's and are covered by the e2e tests.
 */
if (typeof HTMLDialogElement !== "undefined" && typeof HTMLDialogElement.prototype.showModal !== "function") {
  HTMLDialogElement.prototype.show = function show(this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement, returnValue?: string) {
    if (!this.hasAttribute("open")) return;
    this.removeAttribute("open");
    if (returnValue !== undefined) this.returnValue = returnValue;
    queueMicrotask(() => this.dispatchEvent(new Event("close")));
  };
}

afterEach(() => {
  cleanup();
});
