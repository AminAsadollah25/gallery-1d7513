import { getStore } from "@netlify/blobs";
import { handle } from "../../src/handler.mjs";

export default req => handle(req, {
  store: getStore({ name: "review-festijn", consistency: "strong" }),
  env: process.env,
});

export const config = { path: "/api/*" };
