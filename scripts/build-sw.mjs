import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
async function list(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((e) =>
        e.isDirectory() ? list(`${dir}/${e.name}`) : `${dir}/${e.name}`,
      ),
    )
  ).flat();
}
const files = (await list("dist")).filter((f) => !f.endsWith("/sw.js")).sort();
const hash = createHash("sha256");
for (const file of files) hash.update(await readFile(file));
const cache = `momo-shell-${hash.digest("hex").slice(0, 16)}`;
const urls = files.map((file) => "/" + file.slice("dist/".length));
await writeFile(
  "dist/sw.js",
  `const CACHE=${JSON.stringify(cache)},FILES=${JSON.stringify(urls)};
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('momo-shell-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{if(event.request.method!=='GET')return;const url=new URL(event.request.url);if(url.origin!==self.location.origin)return;if(event.request.mode==='navigate'){event.respondWith(caches.open(CACHE).then(cache=>cache.match('/index.html')).then(response=>response||fetch(event.request)));}else if(FILES.includes(url.pathname)){event.respondWith(caches.open(CACHE).then(cache=>cache.match(url.pathname)).then(response=>response||fetch(event.request)));}});
`,
);
console.log(`Offline cache generated: ${urls.length} files (${cache})`);
