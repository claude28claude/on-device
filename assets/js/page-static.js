/* On Device - start-up for the pages that are mostly words:
   Help, Privacy and Credits. */

import { initPage } from "./app.js";

initPage({ pathPrefix: "" }).catch((err) => {
  console.error("[On Device] This page failed to start:", err);
});
