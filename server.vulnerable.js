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
const certificates = new Map();

app.use(express.json());
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

app.post("/api/logout", (req, res) => {
    // VULNERABLE: Logging out has no server-side effect because the issued token is never tracked.
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

app.get("/", (req, res) => res.redirect("/certificate.html"));

app.listen(port, () => {
    console.log(`Vulnerable demo running at http://localhost:${port}`);
});
