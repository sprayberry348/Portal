const sessionPanel = document.querySelector("#sessionPanel");
const message = document.querySelector("#message");
const studentDetails = document.querySelector("#studentDetails");
const certificateResult = document.querySelector("#certificateResult");
let student = null;

function showMessage(text) {
    message.textContent = text;
}

function updateStudent(nextStudent) {
    student = nextStudent;
    studentDetails.textContent =
        `${student.name} (${student.matricNumber}) — progress: ${student.progress}%, name edits: ${student.nameEdits}`;
    document.querySelector("#newName").value = student.name;
    document.querySelector("#certificateMatric").value = student.matricNumber;
    document.querySelector("#certificateName").value = student.name;
    sessionPanel.hidden = false;
}

async function request(url, options = {}) {
    const headers = { ...options.headers };
    if (options.body) {
        headers["Content-Type"] = "application/json";
    }
    const response = await fetch(url, { ...options, headers });
    const data = response.status === 204 ? {} : await response.json();
    if (!response.ok) {
        throw new Error(data.error || `Request failed (${response.status}).`);
    }
    return data;
}

document.querySelector("#nameForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = new FormData(event.currentTarget).get("name");
    try {
        const result = await request("/api/profile/name", {
            method: "PUT",
            body: JSON.stringify({ matricNumber: student.matricNumber, name })
        });
        updateStudent(result.student);
        showMessage("Stored name updated. Any previous certificate may now be revoked.");
    } catch (error) {
        showMessage(error.message);
    }
});

document.querySelector("#certificateForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    try {
        const result = await request("/api/certificates", {
            method: "POST",
            body: JSON.stringify({
                studentMatric: formData.get("studentMatric"),
                name: formData.get("name")
            })
        });
        const certificate = result.certificate;
        certificateResult.textContent =
            `Certificate ${certificate.id}: ${certificate.name} — ${certificate.status}.`;
        document.querySelector("#certificateId").value = certificate.id;
        showMessage("Certificate request completed.");
    } catch (error) {
        certificateResult.textContent = "";
        showMessage(error.message);
    }
});

document.querySelector("#verifyForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const id = new FormData(event.currentTarget).get("id");
    const resultElement = document.querySelector("#verificationResult");
    try {
        const result = await request(`/api/verify/${encodeURIComponent(id)}`);
        resultElement.textContent =
            `${result.valid ? "Valid" : "Revoked"}: ${result.certificate.name} (${result.certificate.status}).`;
    } catch (error) {
        resultElement.textContent = error.message;
    }
});

document.querySelector("#logoutButton").addEventListener("click", async () => {
    try {
        await request("/api/logout", { method: "POST" });
    } catch (error) {
        showMessage(error.message);
        return;
    }
    window.location.assign("/errorpresent.html");
});

async function loadSession() {
    try {
        const result = await request("/api/session");
        updateStudent(result.student);
    } catch {
        window.location.assign("/errorpresent.html");
    }
}

loadSession();
