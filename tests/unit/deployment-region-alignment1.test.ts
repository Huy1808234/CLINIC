import { strict as assert } from "node:assert";
import fs from "node:fs";
import path from "node:path";

export function runDeploymentRegionAlignment1Tests() {
  console.log("Running DEPLOYMENT-REGION-ALIGNMENT1 Tests...");

  const vercelJsonPath = path.join(process.cwd(), "vercel.json");
  const layoutPath = path.join(process.cwd(), "src", "app", "layout.tsx");
  const proxyPath = path.join(process.cwd(), "src", "proxy.ts");
  const middlewarePath = path.join(process.cwd(), "src", "supabase-clients", "middleware.ts");

  // REGION-1: vercel.json exists and specifies Singapore sin1
  assert.ok(fs.existsSync(vercelJsonPath), "REGION-1: vercel.json exists");
  const vercelConfig = JSON.parse(fs.readFileSync(vercelJsonPath, "utf-8"));
  assert.deepStrictEqual(vercelConfig.regions, ["sin1"], "REGION-1: vercel.json specifies Singapore region ['sin1']");

  // REGION-2: vercel.json is the single source of truth for region configuration (no conflicting deprecated route segment config)
  assert.ok(fs.existsSync(layoutPath), "layout.tsx exists");
  const layoutContent = fs.readFileSync(layoutPath, "utf-8");
  assert.ok(
    !layoutContent.includes("preferredRegion"),
    "REGION-2: deprecated route segment preferredRegion omitted in favor of project-level vercel.json"
  );

  // REGION-3: Node.js runtime preserved (no forced edge runtime)
  assert.ok(
    !layoutContent.includes('runtime = "edge"'),
    "REGION-3: Node runtime is preserved without forced Edge rewrites"
  );

  // REGION-4: Proxy and middleware authentication flow preserved
  assert.ok(fs.existsSync(proxyPath), "REGION-4: proxy.ts exists");
  assert.ok(fs.existsSync(middlewarePath), "REGION-4: middleware.ts exists");

  console.log("All DEPLOYMENT-REGION-ALIGNMENT1 Tests PASSED!");
}
