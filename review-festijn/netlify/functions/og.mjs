import { getStore } from "@netlify/blobs";
import { handleOg } from "../../src/og-route.mjs";

export default async () => {
  try {
    return await handleOg(getStore({ name: "review-festijn", consistency: "strong" }));
  } catch (e) {
    console.error(e);
    return new Response("Linkvoorbeeld niet beschikbaar: " + String(e && e.message || e), { status: 500 });
  }
};

export const config = { path: "/og.png" };
