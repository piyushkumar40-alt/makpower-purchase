import { useEffect } from "react";

// Global stack of active modal close handlers (LIFO: Last In, First Out)
const modalCloseStack = [];

export function pushModalCloseHandler(onClose) {
  if (typeof onClose === "function") {
    modalCloseStack.push(onClose);
  }
}

export function popModalCloseHandler(onClose) {
  const idx = modalCloseStack.lastIndexOf(onClose);
  if (idx !== -1) {
    modalCloseStack.splice(idx, 1);
  }
}

/**
 * Custom React hook that registers a modal close handler on the Escape key.
 * Properly manages nested / stacked modals so pressing Esc closes the top-most modal first.
 *
 * @param {Function} onClose - The function to call to close the modal.
 * @param {boolean} [active=true] - Whether the modal is currently active/open.
 */
export function useModalEscape(onClose, active = true) {
  useEffect(() => {
    if (!active || typeof onClose !== "function") return;

    modalCloseStack.push(onClose);

    return () => {
      const idx = modalCloseStack.lastIndexOf(onClose);
      if (idx !== -1) {
        modalCloseStack.splice(idx, 1);
      }
    };
  }, [onClose, active]);
}

// Global window event listener in capturing phase
if (typeof window !== "undefined") {
  window.addEventListener(
    "keydown",
    (e) => {
      if (e.key === "Escape" || e.key === "Esc") {
        // 1. If we have registered modals on the stack, call the top-most handler
        if (modalCloseStack.length > 0) {
          e.preventDefault();
          e.stopPropagation();
          const topHandler = modalCloseStack[modalCloseStack.length - 1];
          if (typeof topHandler === "function") {
            topHandler();
          }
          return;
        }

        // 2. Fallback for unhooked modals, popups, or backdrops in the DOM
        const visibleModals = Array.from(
          document.querySelectorAll(".modal-overlay, .modal-backdrop, .modal, [role='dialog']")
        ).filter((el) => {
          const style = window.getComputedStyle(el);
          return (
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            parseFloat(style.opacity || "1") > 0
          );
        });

        if (visibleModals.length > 0) {
          const topModal = visibleModals[visibleModals.length - 1];

          // Check for close button inside topModal
          const closeBtn =
            topModal.querySelector(
              ".modal-close, button.modal-close, button.close, [data-dismiss='modal'], button[aria-label*='close' i], button[title*='close' i]"
            ) ||
            Array.from(topModal.querySelectorAll("button")).find((btn) => {
              const text = (btn.textContent || "").trim().toLowerCase();
              return (
                text === "close" ||
                text === "cancel" ||
                text === "✕" ||
                text === "×" ||
                text.includes("cancel")
              );
            });

          if (closeBtn) {
            e.preventDefault();
            e.stopPropagation();
            closeBtn.click();
            return;
          }

          // Trigger backdrop click if supported
          topModal.click();
        }
      }
    },
    true // Capture phase ensures it triggers even when inputs inside modal are focused
  );
}

export default useModalEscape;
