const logoutButton = document.querySelector("nav button");

if (logoutButton) {
    logoutButton.type = "button";
    logoutButton.addEventListener("click", async () => {
        logoutButton.disabled = true;
        try {
            const response = await fetch("/api/logout", { method: "POST" });
            if (!response.ok) {
                throw new Error(`Logout failed (${response.status}).`);
            }
            window.location.assign("/errorpresent.html");
        } catch (error) {
            logoutButton.disabled = false;
            window.alert(error.message);
        }
    });
}
