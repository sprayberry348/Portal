const crypto = require("node:crypto");
const path = require("node:path");
const express = require("express");

const app = express();
const port = Number(process.env.PORT || 3000);
const students = new Map([
    ["STU1001", {
        matricNumber: "STU1001",
        password: "complete123",
        name: "Alicce Johnson",
        progress: 100,
        nameEdits: 0
    }],
    ["STU1002", {
        matricNumber: "STU1002",
        password: "progress123",
        name: "Jordan Lee",
        progress: 40,
        nameEdits: 0
    }]
]);
const sessions = new Map();
const certificates = new Map();

app.use(express.json());

function getRequestToken(req) {
    const authorization = req.get("authorization") || "";
    const bearerMatch = authorization.match(/^Bearer ([a-f0-9]{64})$/);
    if (bearerMatch) {
        return bearerMatch[1];
    }

    const cookie = req.get("cookie") || "";
    const cookieMatch = cookie.match(/(?:^|;\s*)portal_session=([a-f0-9]{64})(?:;|$)/);
    return cookieMatch ? cookieMatch[1] : undefined;
}

function hasValidSession(req) {
    const token = getRequestToken(req);
    return Boolean(token && sessions.has(token));
}

// VULNERABILITY NOTE: This page gate only protects browser access; the vulnerable certificate API still trusts request-body identity.
app.use((req, res, next) => {
    if (req.path.startsWith("/api/")) {
        return next();
    }
    res.set("Cache-Control", "no-store");
    if (req.path === "/" || ["/errorpresent.html", "/errorpresent.css", "/login.js"].includes(req.path)) {
        return next();
    }
    if (hasValidSession(req)) {
        return next();
    }
    if (req.accepts("html")) {
        return res.redirect("/errorpresent.html");
    }
    return res.status(401).send("Please log in to access this resource.");
});

app.use(express.static(path.join(__dirname, "Certificate Error Present")));

app.get("/api/demo-students", (req, res) => {
    res.json(Array.from(students.values(), ({ matricNumber, name, progress }) => ({
        matricNumber,
        name,
        progress
    })));
});

app.post("/api/login", (req, res) => {
    const { matricNumber, password } = req.body || {};
    const student = students.get(matricNumber);

    if (!student || student.password !== password) {
        return res.status(401).json({ error: "Invalid matric number or password." });
    }

    // VULNERABLE: This token is not associated with or required for later requests.
    const token = crypto.randomBytes(32).toString("hex");
    // Store a session only for browser page access; the intentionally vulnerable API does not require it.
    sessions.set(token, student.matricNumber);
    res.cookie("portal_session", token, { httpOnly: true, sameSite: "lax", path: "/" });
    res.json({
        token,
        student: {
            matricNumber: student.matricNumber,
            name: student.name,
            progress: student.progress,
            nameEdits: student.nameEdits
        }
    });
});

app.get("/api/session", (req, res) => {
    const token = getRequestToken(req);
    const matricNumber = token ? sessions.get(token) : undefined;
    const student = matricNumber ? students.get(matricNumber) : undefined;
    if (!student) {
        return res.status(401).json({ error: "Please log in." });
    }
    res.json({
        student: {
            matricNumber: student.matricNumber,
            name: student.name,
            progress: student.progress,
            nameEdits: student.nameEdits
        }
    });
});

app.post("/api/logout", (req, res) => {
    // Clear the browser-page session; certificate API requests remain intentionally unauthenticated.
    const token = getRequestToken(req);
    if (token) {
        sessions.delete(token);
    }
    res.clearCookie("portal_session", { httpOnly: true, sameSite: "lax", path: "/" });
    res.status(204).end();
});

app.put("/api/profile/name", (req, res) => {
    // VULNERABLE: The client chooses which student's record to edit.
    const student = students.get((req.body || {}).matricNumber);
    const name = typeof (req.body || {}).name === "string" ? req.body.name.trim() : "";

    if (!student) {
        return res.status(404).json({ error: "Student not found." });
    }
    if (!name || name.length > 120) {
        return res.status(400).json({ error: "Name must be between 1 and 120 characters." });
    }

    student.name = name;
    student.nameEdits += 1;
    for (const certificate of certificates.values()) {
        if (certificate.matricNumber === student.matricNumber && certificate.active) {
            certificate.active = false;
            certificate.status = "revoked";
        }
    }

    res.json({
        student: {
            matricNumber: student.matricNumber,
            name: student.name,
            progress: student.progress,
            nameEdits: student.nameEdits
        }
    });
});

app.post("/api/certificates", (req, res) => {
    // VULNERABLE: The request body, not the authenticated session, chooses the recipient.
    const studentMatric = (req.body || {}).studentMatric;
    const student = students.get(studentMatric);

    if (!student) {
        return res.status(404).json({ error: "Student not found." });
    }

    // VULNERABLE: There is no check that the student completed the programme.
    // VULNERABLE: The client can provide any name instead of using the student's stored name.
    const certificateName = typeof (req.body || {}).name === "string" ? req.body.name.trim() : "";
    if (!certificateName || certificateName.length > 120) {
        return res.status(400).json({ error: "Name must be between 1 and 120 characters." });
    }

    // VULNERABLE: No active-certificate check allows multiple active certificates per student.
    const certificate = {
        id: crypto.randomUUID(),
        matricNumber: student.matricNumber,
        name: certificateName,
        issuedAt: new Date().toISOString(),
        active: true,
        status: "active"
    };
    certificates.set(certificate.id, certificate);
    res.status(201).json({ certificate });
});

app.get("/api/verify/:id", (req, res) => {
    const certificate = certificates.get(req.params.id);
    if (!certificate) {
        return res.status(404).json({ valid: false, error: "Certificate not found." });
    }

    res.json({
        valid: certificate.active,
        certificate: {
            id: certificate.id,
            name: certificate.name,
            issuedAt: certificate.issuedAt,
            status: certificate.status
        }
    });
});

app.get("/", (req, res) => res.redirect(hasValidSession(req) ? "/home.html" : "/errorpresent.html"));

app.listen(port, () => {
    console.log(`Vulnerable demo running at http://localhost:${port}`);
});
