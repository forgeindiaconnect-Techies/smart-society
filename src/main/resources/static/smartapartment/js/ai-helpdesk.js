(() => {
    const request = async (path, body) => {
        const response = await fetch(`/api/society/helpdesk${path}`, {method: "POST", headers: {"Content-Type": "application/json", Accept: "application/json"}, body: JSON.stringify(body)});
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.message || "Helpdesk is unavailable");
        return data;
    };
    const addMessage = (container, message, user = false) => { const item = document.createElement("div"); item.className = `ai-helpdesk__message${user ? " ai-helpdesk__message--user" : ""}`; item.textContent = message; container.appendChild(item); container.scrollTop = container.scrollHeight; };
    document.addEventListener("DOMContentLoaded", () => {
        if (!document.body.dataset.dashboardRole) return;
        const widget = document.createElement("aside"); widget.className = "ai-helpdesk"; widget.hidden = true;
        widget.innerHTML = '<div class="ai-helpdesk__head"><strong><i class="fa-solid fa-sparkles me-2"></i>AI Helpdesk</strong><button class="ai-helpdesk__close" type="button" aria-label="Close">×</button></div><div class="ai-helpdesk__body"><div class="ai-helpdesk__messages"></div><form><input class="form-control" name="question" placeholder="Ask about billing, visitors, bookings..." required><div class="ai-helpdesk__actions"><button class="btn btn-primary btn-sm" type="submit">Ask</button><button class="btn btn-outline-primary btn-sm" type="button" data-ticket hidden>Raise ticket</button></div></form></div>';
        const toggle = document.createElement("button"); toggle.type = "button"; toggle.className = "ai-helpdesk-toggle"; toggle.innerHTML = '<i class="fa-solid fa-comment-dots me-2"></i>AI Helpdesk';
        document.body.append(widget, toggle); const messages = widget.querySelector(".ai-helpdesk__messages"); const ticket = widget.querySelector("[data-ticket]"); let lastQuestion = "";
        addMessage(messages, "Hi! Ask me about billing, visitors, amenities, security, or maintenance.");
        toggle.addEventListener("click", () => { widget.hidden = !widget.hidden; }); widget.querySelector(".ai-helpdesk__close").addEventListener("click", () => { widget.hidden = true; });
        widget.querySelector("form").addEventListener("submit", async event => { event.preventDefault(); lastQuestion = new FormData(event.currentTarget).get("question").trim(); if (!lastQuestion) return; addMessage(messages, lastQuestion, true); event.currentTarget.reset(); try { const result = await request("/ask", {question: lastQuestion}); addMessage(messages, `${result.answer} Suggested team: ${result.suggestedTeam}.`); ticket.hidden = !result.canCreateTicket; } catch (error) { addMessage(messages, error.message); } });
        ticket.addEventListener("click", async () => { try { const result = await request("/tickets", {question: lastQuestion}); addMessage(messages, result.message); ticket.hidden = true; } catch (error) { addMessage(messages, error.message); } });
    });
})();
