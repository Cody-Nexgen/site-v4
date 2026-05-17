
export const syncSessionWithExtension = (session: any) => {
  if (!session) return;

  // Send message to Content Script injected by the extension
  window.postMessage(
    {
      type: "FOCUZNOW_SESSION_SYNC",
      source: "FOCUZNOW_WEB",
      session: {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        user: session.user,
      },
    },
    "*" // In production, replace with specific origin if needed
  );

  console.log("[Web] Synced session with FocuzNow Extension");
};

export const redirectToExtension = () => {
  console.log("[Web] Triggering extension options redirect...");
  window.postMessage({ type: "OPEN_EXTENSION_OPTIONS" }, "*");
};
