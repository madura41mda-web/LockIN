import { createClient } from "@supabase/supabase-js";
import { AccessToken } from "livekit-server-sdk";

const ROOM_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOKEN_TTL_SECONDS = 10 * 60;

function sendError(res, status, message) {
  return res.status(status).json({ error: message });
}

function bearerToken(req) {
  const authorization = req.headers.authorization || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || "";
}

function cleanParticipantName(value, user) {
  const requestedName = typeof value === "string" ? value.trim() : "";
  const metadataName =
    user.user_metadata?.display_name ||
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    "";
  const emailName = user.email?.split("@")[0] || "";
  return String(requestedName || metadataName || emailName || "Student")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .slice(0, 80);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendError(res, 405, "Method not allowed");
  }

  res.setHeader("Cache-Control", "no-store");

  const livekitUrl = process.env.LIVEKIT_URL;
  const livekitApiKey = process.env.LIVEKIT_API_KEY;
  const livekitApiSecret = process.env.LIVEKIT_API_SECRET;
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_KEY;

  if (!livekitUrl || !livekitApiKey || !livekitApiSecret) {
    return sendError(res, 500, "LiveKit is not configured on the server.");
  }
  if (!supabaseUrl || !supabaseKey) {
    return sendError(res, 500, "Supabase authentication is not configured on the server.");
  }

  const accessToken = bearerToken(req);
  if (!accessToken) {
    return sendError(res, 401, "A Supabase access token is required.");
  }

  const { roomName, participantName } = req.body || {};
  if (typeof roomName !== "string" || !ROOM_ID_PATTERN.test(roomName.trim())) {
    return sendError(res, 400, "A valid lobby room identifier is required.");
  }
  if (participantName !== undefined && typeof participantName !== "string") {
    return sendError(res, 400, "Participant name must be text.");
  }

  const normalizedRoomName = roomName.trim().toLowerCase();
  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(accessToken);

  if (authError || !user) {
    return sendError(res, 401, "The Supabase session is invalid or expired.");
  }

  const { data: membership, error: membershipError } = await supabase
    .from("study_lobby_participants")
    .select("room_id")
    .eq("room_id", normalizedRoomName)
    .eq("user_id", user.id)
    .eq("is_online", true)
    .maybeSingle();

  if (membershipError) {
    console.error("LiveKit membership validation failed:", membershipError);
    return sendError(res, 500, "Could not validate lobby membership.");
  }
  if (!membership) {
    return sendError(res, 403, "Join the lobby before requesting a LiveKit token.");
  }

  const token = new AccessToken(livekitApiKey, livekitApiSecret, {
    identity: user.id,
    name: cleanParticipantName(participantName, user),
    ttl: TOKEN_TTL_SECONDS,
  });
  token.addGrant({
    room: normalizedRoomName,
    roomJoin: true,
    canPublish: true,
    canPublishSources: ["microphone"],
    canPublishData: true,
    canSubscribe: true,
  });

  return res.status(200).json({
    token: await token.toJwt(),
    url: livekitUrl,
  });
}
