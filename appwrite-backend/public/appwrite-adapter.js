/**
 * appwrite-adapter.js
 * -------------------
 * Same job as mock-api.js — intercept the test client's fetch() calls to
 * /register, /login, /logout, /me, /files, /files/:id — except every call
 * here is answered by the REAL Appwrite Web SDK (Account + TablesDB), not a
 * fake in-memory store. Only active when "Appwrite" mode is selected.
 *
 * Auth model: Appwrite manages login sessions itself via a browser cookie,
 * set automatically the moment account.createEmailPasswordSession()
 * succeeds. There is no JWT for us to mint or store. The "token" this
 * adapter returns to the test client is just the Appwrite session ID, shown
 * so the Token field isn't empty — it isn't actually used for
 * authentication. Every subsequent call (GET /me, /files, ...) is
 * authenticated by the browser automatically re-sending that session
 * cookie, exactly like a normal website login.
 *
 * File access: each file row was seeded with
 * Permission.read(Role.user(ownerId)). Appwrite ALSO deliberately returns a
 * uniform 404 for both "row doesn't exist" and "row exists but you lack
 * permission" (an anti-enumeration design — see appwrite/appwrite#8664), so
 * there's no error code to translate for a 403. Instead we grant table-level
 * read to any authenticated user and do the ownership check ourselves below,
 * the same way the custom Express backend does it.
 */
(function () {
  function appwriteModeSelected() {
    const el = document.querySelector('input[name="backendMode"][value="appwrite"]');
    return !!(el && el.checked);
  }

  function getConfig() {
    return {
      endpoint: document.getElementById("awEndpoint").value.trim(),
      projectId: document.getElementById("awProjectId").value.trim(),
      databaseId: document.getElementById("awDatabaseId").value.trim(),
      filesTableId: document.getElementById("awFilesCollectionId").value.trim(),
    };
  }

  function getClient() {
    const cfg = getConfig();
    const client = new Appwrite.Client().setEndpoint(cfg.endpoint).setProject(cfg.projectId);
    return { client, cfg };
  }

  function json(status, body) {
    return new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }

  function rowToFile(row) {
    return {
      id: row.$id,
      ownerId: row.ownerId,
      fileName: row.fileName,
      mimeType: row.mimeType,
      sizeBytes: row.sizeBytes,
      uploadedAt: row.uploadedAt,
    };
  }

  // ---- route handlers ----
  async function handleRegister(req) {
    const { email, password } = await req.json();
    if (!email || !password) return json(400, { error: "email and password are required" });

    const { client } = getClient();
    const account = new Appwrite.Account(client);
    try {
      const user = await account.create({ userId: Appwrite.ID.unique(), email, password });
      return json(201, { id: user.$id, email: user.email });
    } catch (err) {
      return json(err.code || 400, { error: err.message || "Registration failed" });
    }
  }

  async function handleLogin(req) {
    const { email, password } = await req.json();
    const { client } = getClient();
    const account = new Appwrite.Account(client);
    try {
      const session = await account.createEmailPasswordSession({ email, password });
      return json(200, { token: session.$id, user: { id: session.userId, email } });
    } catch (err) {
      const status = err.code === 429 ? 429 : 401;
      const message = status === 429 ? "Too many failed attempts. Try again in a bit." : "Invalid email or password";
      return json(status, { error: message });
    }
  }

  async function handleLogout() {
    const { client } = getClient();
    const account = new Appwrite.Account(client);
    try {
      await account.deleteSession({ sessionId: "current" });
      return json(200, { message: "Logged out" });
    } catch (err) {
      return json(401, { error: "Not authenticated" });
    }
  }

  async function handleMe() {
    const { client } = getClient();
    const account = new Appwrite.Account(client);
    try {
      const user = await account.get();
      const prefs = user.prefs || {};
      return json(200, {
        id: user.$id,
        email: user.email,
        profile: {
          fullName: user.name,
          displayName: prefs.displayName || "",
          bio: prefs.bio || "",
          role: prefs.role || "user",
          createdAt: user.$createdAt,
        },
      });
    } catch (err) {
      return json(401, { error: "Not authenticated" });
    }
  }

  async function handleFiles() {
    const { client, cfg } = getClient();
    const account = new Appwrite.Account(client);
    const tablesDB = new Appwrite.TablesDB(client);
    let user;
    try {
      user = await account.get();
    } catch (err) {
      return json(401, { error: "Not authenticated" });
    }
    const res = await tablesDB.listRows({
      databaseId: cfg.databaseId,
      tableId: cfg.filesTableId,
      queries: [Appwrite.Query.equal("ownerId", user.$id)],
    });
    return json(200, { files: res.rows.map(rowToFile) });
  }

  async function handleFileById(fileId) {
    const { client, cfg } = getClient();
    const account = new Appwrite.Account(client);
    const tablesDB = new Appwrite.TablesDB(client);
    let user;
    try {
      user = await account.get();
    } catch (err) {
      return json(401, { error: "Not authenticated" });
    }
    try {
      const row = await tablesDB.getRow({ databaseId: cfg.databaseId, tableId: cfg.filesTableId, rowId: fileId });
      if (row.ownerId !== user.$id) {
        return json(403, { error: "You do not have access to this file" });
      }
      return json(200, { file: rowToFile(row) });
    } catch (err) {
      return json(404, { error: "File not found" });
    }
  }

  async function handleFileDownload(fileId) {
    const { client, cfg } = getClient();
    const account = new Appwrite.Account(client);
    const tablesDB = new Appwrite.TablesDB(client);
    let user;
    try {
      user = await account.get();
    } catch (err) {
      return new Response("Not authenticated", { status: 401 });
    }
    try {
      const row = await tablesDB.getRow({ databaseId: cfg.databaseId, tableId: cfg.filesTableId, rowId: fileId });
      if (row.ownerId !== user.$id) {
        return new Response("Forbidden", { status: 403 });
      }
      const content =
        `This is a mock stand-in for "${row.fileName}" (${row.mimeType}, ${row.sizeBytes} bytes).\n` +
        `In the real backend this endpoint would stream the actual file bytes.`;
      return new Response(content, { status: 200, headers: { "Content-Type": "text/plain" } });
    } catch (err) {
      return new Response("File not found", { status: 404 });
    }
  }

  // ---- patch window.fetch, but only for our known routes, and only in Appwrite mode ----
  const fetchBeforeAdapter = window.fetch.bind(window);

  window.fetch = async function (input, init) {
    if (!appwriteModeSelected()) return fetchBeforeAdapter(input, init);

    const url = typeof input === "string" ? input : input.url;
    const { pathname } = new URL(url, window.location.href);
    const req = new Request(url, init);

    if (pathname === "/register" && req.method === "POST") return handleRegister(req);
    if (pathname === "/login" && req.method === "POST") return handleLogin(req);
    if (pathname === "/logout" && req.method === "POST") return handleLogout();
    if (pathname === "/me" && req.method === "GET") return handleMe();
    if (pathname === "/files" && req.method === "GET") return handleFiles();

    let m = pathname.match(/^\/files\/([^/]+)\/download$/);
    if (m && req.method === "GET") return handleFileDownload(m[1]);

    m = pathname.match(/^\/files\/([^/]+)$/);
    if (m && req.method === "GET") return handleFileById(m[1]);

    return fetchBeforeAdapter(input, init);
  };

  console.info('[appwrite-adapter] ready — select "Appwrite" mode in index.html to enable it');
})();