const fs = require("fs");

const targetPath = process.argv[2];

if (!targetPath) {
  console.error("Usage: node tools/patch-facebook-status-public.js <path-to-server.js>");
  process.exit(1);
}

let text = fs.readFileSync(targetPath, "utf8");

const from = `app.get("/admin/facebook/status", (req, res) => {
  allowCors(res, req);
  if (!_requireAdmin(req, res)) return;
  try {
    return res.json({
      ok: true,
      config: _facebookConfigSummary(),
      connection: _toPublicFacebookConnectionState(_readFacebookConnectionRecord())
    });
  } catch (err) {
    console.error("/admin/facebook/status failed:", err);
    return res.status(500).json({ ok: false, error: "facebook status failed" });
  }
});
`;

const to = `app.get("/admin/facebook/status", (req, res) => {
  allowCors(res, req);
  try {
    return res.json({
      ok: true,
      config: _facebookConfigSummary(),
      connection: _toPublicFacebookConnectionState(_readFacebookConnectionRecord())
    });
  } catch (err) {
    console.error("/admin/facebook/status failed:", err);
    return res.status(500).json({ ok: false, error: "facebook status failed" });
  }
});
`;

if (!text.includes(from)) {
  console.error("Missing expected /admin/facebook/status block");
  process.exit(2);
}

text = text.replace(from, to);
fs.writeFileSync(targetPath, text, "utf8");
console.log(`Patched ${targetPath}`);
