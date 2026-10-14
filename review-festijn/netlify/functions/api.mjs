import { getStore } from "@netlify/blobs";
import { handle } from "../../src/handler.mjs";

export default async req => {
  let store;
  try {
    store = getStore({ name: "review-festijn", consistency: "strong" });
  } catch (e) {
    return Response.json({ error: "De opslag (Netlify Blobs) is niet bereikbaar.", detail: String(e && e.message || e) }, { status: 500 });
  }
  return handle(req, { store, env: process.env });
};

export const config = { path: "/api/*" };
