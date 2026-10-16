const crypto = require("node:crypto");
const path = require("node:path");
const express = require("express");

const app = express();
const port = Number(process.env.PORT || 5000);
const students = new Map([
    ["STU1001", {
        matricNumber: "STU1001",
        password: "complete123",
        name: "Alicce Johnson",
        progress: 100,
        nameEdits: 0,
        activeCertificateId: null
    }],
    ["STU1002", {
        matricNumber: "STU1002",
        password: "progress123",
        name: "Jordan Lee",
        progress: 40,
        nameEdits: 0,
        activeCertificateId: null
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

// FIX: Protected pages and their local assets are served only with a valid login session.
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

function getSessionStudent(req) {
    const token = getRequestToken(req);
    const matricNumber = token ? sessions.get(token) : undefined;
    return matricNumber ? students.get(matricNumber) : undefined;
}

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

    // FIX: The unpredictable token is stored server-side and maps to the authenticated student.
    const token = crypto.randomBytes(32).toString("hex");
    sessions.set(token, student.matricNumber);
    // FIX: The HTTP-only cookie lets the server gate HTML pages without exposing auth state to page scripts.
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
    const student = getSessionStudent(req);
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
    const token = getRequestToken(req);
    if (token) {
        sessions.delete(token);
    }
    res.clearCookie("portal_session", { httpOnly: true, sameSite: "lax", path: "/" });
    res.status(204).end();
});

app.put("/api/profile/name", (req, res) => {
    // FIX: The name may come from the body, but the student identity comes only from the session token.
    const student = getSessionStudent(req);
    const name = typeof (req.body || {}).name === "string" ? req.body.name.trim() : "";

    if (!student) {
        return res.status(401).json({ error: "Please log in." });
    }
    if (!name || name.length > 120) {
        return res.status(400).json({ error: "Name must be between 1 and 120 characters." });
    }
    if (name !== student.name && student.nameEdits >= 2) {
        return res.status(403).json({ error: "The maximum of 2 name edits has been reached." });
    }

    if (name !== student.name) {
        student.name = name;
        student.nameEdits += 1;
        if (student.activeCertificateId) {
            // FIX: Changing the name immediately revokes the previous active certificate.
            const oldCertificate = certificates.get(student.activeCertificateId);
            if (oldCertificate) {
                oldCertificate.active = false;
                oldCertificate.status = "revoked";
            }
            student.activeCertificateId = null;
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
    // FIX: Request-body identity and name fields are ignored; identity comes only from the token.
    const student = getSessionStudent(req);

    if (!student) {
        return res.status(401).json({ error: "Please log in." });
    }
    // FIX: Only students whose server-side progress is 100% can receive a certificate.
    if (student.progress < 100) {
        return res.status(403).json({ error: "Programme completion is required to issue a certificate." });
    }
    // FIX: Returning the existing active certificate prevents duplicate active certificates.
    if (student.activeCertificateId) {
        const activeCertificate = certificates.get(student.activeCertificateId);
        if (activeCertificate && activeCertificate.active) {
            return res.json({ certificate: activeCertificate });
        }
    }

    // FIX: The name comes from the database, not from any name sent by the client.
    const certificate = {
        id: crypto.randomUUID(),
        matricNumber: student.matricNumber,
        name: student.name,
        issuedAt: new Date().toISOString(),
        active: true,
        status: "active"
    };
    certificates.set(certificate.id, certificate);
    // FIX: Each student has at most one active certificate; only this ID is marked active.
    student.activeCertificateId = certificate.id;
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
    console.log(`Fixed demo running at http://localhost:${port}`);
});
