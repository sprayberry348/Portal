const loginForm = document.querySelector("#loginForm");
const loginMessage = document.querySelector("#loginMessage");

loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    loginMessage.textContent = "";

    const formData = new FormData(loginForm);
    try {
        const response = await fetch("/api/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                matricNumber: formData.get("matricNumber"),
                password: formData.get("password")
            })
        });
        const result = await response.json();
        if (!response.ok) {
            loginMessage.textContent = result.error || "Login failed.";
            return;
        }
        window.location.assign("/home.html");
    } catch {
        loginMessage.textContent = "Unable to reach the server. Please try again.";
    }
});

document.querySelector("#forgot").addEventListener("click", (event) => event.preventDefault());
document.querySelector("#signIn").addEventListener("click", (event) => event.preventDefault());
