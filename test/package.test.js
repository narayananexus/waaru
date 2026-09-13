import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

test("packed artifact installs and runs as ESM and CommonJS without dependencies", () => {
  const dir = mkdtempSync(join(tmpdir(), "waaru-consumer-"));
  const [pack] = JSON.parse(
    execFileSync("npm", ["pack", "--dry-run=false", "--json", "--pack-destination", dir], {
      encoding: "utf8",
    }),
  );
  assert.ok(
    pack.files.every(
      (f) => !f.path.includes(".env") && !f.path.startsWith("test/"),
    ),
  );
  for (const required of ['LICENSE', 'SECURITY.md', 'TROUBLESHOOTING.md', 'examples/README.md', 'examples/template-recipes.mjs'])
    assert.ok(pack.files.some(file => file.path === required), `${required} must ship`);
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify({ private: true, type: "module" }),
  );
  execFileSync(
    "npm",
    [
      "install",
      "--dry-run=false",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      "--offline",
      join(dir, pack.filename),
    ],
    { cwd: dir, stdio: "pipe" },
  );
  const code = `const client=new Waaru({apiKey:'wak_'+ 'a'.repeat(64),fetch:async(url,init)=>{if(!url.endsWith('/v1/messages')||JSON.parse(init.body).text.body!=='Hi')throw Error('mapping');return Response.json({messaging_product:'whatsapp',messageId:'fixture',status:'queued'},{status:202});}});if((await client.messages.sendText({to:'+14155552671',text:'Hi'})).messageId!=='fixture')throw Error('response');`;
  execFileSync(
    process.execPath,
    ["--input-type=module", "-e", `import {Waaru} from '@waaru/sdk';${code}`],
    { cwd: dir },
  );
  execFileSync(
    process.execPath,
    [
      "-e",
      `const {Waaru}=require('@waaru/sdk');(async()=>{${code}})().catch(()=>process.exit(1));`,
    ],
    { cwd: dir },
  );
  const manifest = JSON.parse(
    readFileSync(join(dir, "node_modules/@waaru/sdk/package.json"), "utf8"),
  );
  assert.equal(manifest.dependencies, undefined);
  assert.equal(
    manifest.repository?.url,
    "git+https://github.com/narayananexus/waaru.git",
  );
  assert.equal(
    manifest.bugs?.url,
    "https://github.com/narayananexus/waaru/issues",
  );
  assert.ok(
    !pack.files.some((file) => file.path === "PUBLISHING.md"),
    "maintainer-only publishing instructions must not ship",
  );
  {
    writeFileSync(
      join(dir, "consumer.mts"),
      `import {Waaru, type AcceptedMessage, type TemplateComponent} from '@waaru/sdk';
const client=new Waaru();
const a:Promise<AcceptedMessage>=client.messages.sendText({to:'+14155552671',text:'Hello'});
const components:TemplateComponent[]=[{type:'body',parameters:[{type:'text',text:'Ada'}]}];
import {WaaruApiError, WaaruConnectionError} from '@waaru/sdk';
const err = new WaaruApiError(502, 'http_error');
const uncertain: boolean = err.outcomeUnknown;
const ref: string | undefined = new WaaruConnectionError().requestId;
client.messages.sendTemplate({to:'+14155552671',name:'order_update',language:'en_US',components});
// @ts-expect-error Phase one excludes broadcasts.
client.broadcasts.send({});
// @ts-expect-error Multiple recipients are not supported.
client.messages.sendText({to:['+14155552671'],text:'Hello'});
// @ts-expect-error Sender is bound to the key.
client.messages.sendText({to:'+14155552671',text:'Hello',from:'+14155552672'});
`,
    );
    for (const [module, resolution] of [
      ["NodeNext", "NodeNext"],
      ["ESNext", "Bundler"],
    ])
      execFileSync(
        process.execPath,
        [
          resolve("node_modules/typescript/bin/tsc"),
          "--noEmit",
          "--strict",
          "--target",
          "ES2022",
          "--module",
          module,
          "--moduleResolution",
          resolution,
          join(dir, "consumer.mts"),
        ],
        { cwd: dir, stdio: "pipe" },
      );
  }
});
