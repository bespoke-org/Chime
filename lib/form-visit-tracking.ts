// Runs in the browser. The visitor id is random, stays in localStorage, and
// is the only thing that ties the events of one browser.

const VISITOR_ID_STORAGE_KEY = "chime:visitor-id";

function getVisitorId() {
  try {
    const stored = window.localStorage.getItem(VISITOR_ID_STORAGE_KEY);

    if (stored) {
      return stored;
    }

    const created = crypto.randomUUID();
    window.localStorage.setItem(VISITOR_ID_STORAGE_KEY, created);
    return created;
  } catch {
    return null;
  }
}

// sendBeacon queues the request without blocking the page and still
// delivers it when the respondent closes the tab right away. Without it or
// without storage the event is skipped.
export function sendFormVisitEvent(
  slug: string,
  event: "open" | "start" | "submit",
) {
  const visitorId = getVisitorId();

  if (!visitorId || typeof navigator.sendBeacon !== "function") {
    return;
  }

  navigator.sendBeacon(
    `/api/public/forms/${slug}/visits`,
    new Blob([JSON.stringify({ visitorId, event })], {
      type: "application/json",
    }),
  );
}
