import { auth, defineMcp } from "@lovable.dev/mcp-js";
import getMyProfile from "./tools/get-my-profile";
import listMatches from "./tools/list-matches";
import listMessages from "./tools/list-messages";
import sendMessage from "./tools/send-message";
import discoverProfiles from "./tools/discover-profiles";

// Direct Supabase host is required for OAuth discovery (managed proxy would
// publish a mismatched issuer and mcp-js would reject tokens).
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "mingleconnect-mcp",
  title: "MingleConnect",
  version: "0.1.0",
  instructions:
    "Tools for MingleConnect. The signed-in user can read their profile, matches, and messages, send chat messages, and browse other profiles. Phone-number reveals are handled inside the app.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [getMyProfile, listMatches, listMessages, sendMessage, discoverProfiles],
});
