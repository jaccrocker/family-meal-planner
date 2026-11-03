/**
 * Each outside integration ships behind its own flag, off unless its env var is
 * "1", so a half finished one cannot reach the submission build.
 */
export interface Features {
  calendar: boolean;
  alexa: boolean;
  skylight: boolean;
}

/**
 * Reads the integration flags from the given environment, which defaults to
 * process.env. A flag is on only when its variable is exactly "1".
 */
export function features(env: Record<string, string | undefined> = process.env): Features {
  return {
    calendar: env.FEATURE_CALENDAR === "1",
    alexa: env.FEATURE_ALEXA === "1",
    skylight: env.FEATURE_SKYLIGHT === "1",
  };
}
