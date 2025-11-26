const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const distDir = path.join(projectRoot, "dist-pwa");

function rimraf(p) {
  if (fs.existsSync(p)) {
    fs.rmSync(p, { recursive: true, force: true });
  }
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function copyFile(src, dest) {
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

function copyDir(srcDir, destDir) {
  if (!fs.existsSync(srcDir)) return;
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else if (entry.isFile()) {
      copyFile(srcPath, destPath);
    }
  }
}

rimraf(distDir);
ensureDir(distDir);

// JS output from TypeScript build
copyFile(path.join(projectRoot, "build", "core.js"), path.join(distDir, "core.js"));
copyFile(path.join(projectRoot, "build", "PWA", "pwa.js"), path.join(distDir, "pwa.js"));

// Third-party library
copyFile(path.join(projectRoot, "sjcl.js"), path.join(distDir, "sjcl.js"));

// Static PWA files with small path adjustments to be self-contained in dist-pwa root
function transformAndWrite(src, dest, replacer) {
  const content = fs.readFileSync(src, "utf8");
  const out = replacer ? replacer(content) : content;
  ensureDir(path.dirname(dest));
  fs.writeFileSync(dest, out, "utf8");
}

// index.html: make script paths relative to dist root
transformAndWrite(
  path.join(projectRoot, "PWA", "index.html"),
  path.join(distDir, "index.html"),
  (c) =>
    c
      .replace(/src="\.\.\/sjcl\.js"/g, 'src="sjcl.js"')
      .replace(/src="\.\.\/core\.js"/g, 'src="core.js"')
      .replace(/src="pwa\.js"/g, 'src="pwa.js"')
);

// manifest.webmanifest: icons relative to dist root
transformAndWrite(
  path.join(projectRoot, "PWA", "manifest.webmanifest"),
  path.join(distDir, "manifest.webmanifest"),
  (c) => c.replace(/"\.\.\/Icons\//g, '"Icons/')
);

// service-worker.js: cache list should use paths in dist root
transformAndWrite(
  path.join(projectRoot, "PWA", "service-worker.js"),
  path.join(distDir, "service-worker.js"),
  (c) =>
    c
      .replace(/\.\.\/core\.js/g, "./core.js")
      .replace(/\.\.\/sjcl\.js/g, "./sjcl.js")
      .replace(/\.\.\/Icons\//g, "./Icons/")
);

// Icons
copyDir(path.join(projectRoot, "Icons"), path.join(distDir, "Icons"));

console.log("Built PWA into", distDir);


