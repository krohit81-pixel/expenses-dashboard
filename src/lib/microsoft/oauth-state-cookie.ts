/** Shared between the authorize and callback routes — kept out of either route.ts file itself so neither has a non-standard export alongside its GET handler. */
export const MS_OAUTH_STATE_COOKIE = "ms_oauth_state";
