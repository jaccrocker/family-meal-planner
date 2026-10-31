/** Starts the once a minute review reminder tick when the Node server boots. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const g = globalThis as { __fmpReviewTick?: boolean };
  if (g.__fmpReviewTick) return;
  g.__fmpReviewTick = true;
  const { tick } = await import("@/lib/review/service");
  console.log("review reminders: checking every minute");
  setInterval(() => {
    tick().catch((e) => console.error(`review tick: ${(e as Error).message}`));
  }, 60_000);
}
