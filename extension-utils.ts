let lastSyncedToken: string | null = null;

export const syncSessionWithExtension = (session: any) => {
  if (!session || !session.access_token) return;

  // Prevent spamming the extension if the token hasn't changed
  if (session.access_token === lastSyncedToken) {
    return;
  }

  lastSyncedToken = session.access_token;

  // Send message to Content Script injected by the extension
  window.postMessage(
    {
      type: "FOCUZNOW_SESSION_SYNC",
      source: "FOCUZNOW_WEB",
      session: {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        user: session.user,
        expires_at: session.expires_at, // Ensure expiry is passed
        token_type: session.token_type
      },
    },
    "*" // In production, replace with specific origin if needed
  );

  console.log("[Web] Synced session with FocuzNow Extension");
};
