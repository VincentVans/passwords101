const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const distDir = path.join(projectRoot, "dist-extension");

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

// Shared and extension-specific JS from TypeScript build
copyFile(path.join(projectRoot, "build", "core.js"), path.join(distDir, "core.js"));
copyFile(path.join(projectRoot, "build", "Extension", "core.js"), path.join(distDir, "extension.js"));

// Third-party library
copyFile(path.join(projectRoot, "sjcl.js"), path.join(distDir, "sjcl.js"));

// Manifest
copyFile(
  path.join(projectRoot, "Extension", "manifest.json"),
  path.join(distDir, "manifest.json")
);

// Popup HTML: adjust script paths for dist root and include extension bootstrap
const popupSrc = path.join(projectRoot, "Extension", "popup.html");
let popup = fs.readFileSync(popupSrc, "utf8");

popup = popup
  .replace(/<script src="\.\.\/sjcl\.js"><\/script>/g, '<script src="sjcl.js"></script>')
  .replace(/<script src="\.\.\/core\.js"><\/script>/g, '<script src="core.js"></script>');

// Ensure extension bootstrap is loaded after shared core
if (!popup.includes('extension.js')) {
  popup = popup.replace(
    /<\/body>\s*<\/html>\s*$/i,
    '    <script src="extension.js"></script>\n</body>\n</html>\n'
  );
}

ensureDir(distDir);
fs.writeFileSync(path.join(distDir, "popup.html"), popup, "utf8");

// Icons
copyDir(path.join(projectRoot, "Icons"), path.join(distDir, "Icons"));

console.log("Built extension into", distDir);


