document.addEventListener("DOMContentLoaded", () => {
  const apiUrl = "/api/loyalty";
  const dashboard = document.querySelector(".loyalty-layout");
  if (!dashboard) return;

  const statusBox = document.getElementById("loyaltyMessage");
  const resultBox = document.getElementById("customerResult");
  const emptyBox = document.getElementById("emptyMember");
  const searchForm = document.getElementById("lookupForm");
  const registerForm = document.getElementById("registerForm");
  const recordButton = document.getElementById("recordVisitButton");
  let currentCustomer = null;
  let busy = false;

  // Add a staff sign-in gate without changing the main site's shared components.
  const loginPanel = document.createElement("section");
  loginPanel.className = "loyalty-card";
  loginPanel.style.maxWidth = "560px";
  loginPanel.style.margin = "36px auto 0";
  loginPanel.innerHTML = `
    <p class="eyebrow">STAFF ACCESS</p>
    <h2>Staff sign in</h2>
    <p>Sign in to search members, register customers and record visits.</p>
    <form id="staffLoginForm" class="loyalty-form">
      <label for="staffPassword">Staff password</label>
      <input id="staffPassword" type="password" autocomplete="current-password" required minlength="1" placeholder="Enter the staff password">
      <button class="button button-dark" type="submit">Sign in <span>↗</span></button>
    </form>
    <p id="loginMessage" class="loyalty-message" role="status" aria-live="polite" hidden></p>
    <div id="signedInPanel" hidden>
      <p>You are signed in to the staff dashboard.</p>
      <button id="logoutButton" class="button button-light" type="button">Sign out</button>
    </div>
  `;
  dashboard.parentNode.insertBefore(loginPanel, dashboard);
  dashboard.hidden = true;

  const loginForm = loginPanel.querySelector("#staffLoginForm");
  const passwordInput = loginPanel.querySelector("#staffPassword");
  const loginMessage = loginPanel.querySelector("#loginMessage");
  const signedInPanel = loginPanel.querySelector("#signedInPanel");

  function normalizePhone(value) {
    let digits = String(value || "").replace(/\D/g, "");
    if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
    else if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
    return digits;
  }

  function say(element, text, hidden = false) {
    element.textContent = text;
    element.hidden = hidden;
  }

  async function request(payload) {
    let response;
    try {
      response = await fetch(apiUrl, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
    } catch {
      throw new Error("Could not reach the loyalty API. This page needs to be deployed on Vercel with the API and environment variables configured.");
    }

    let data;
    try { data = await response.json(); }
    catch {
      throw new Error("The loyalty API did not return JSON. Check the Vercel deployment and API route.");
    }
    if (!response.ok) throw new Error(data.error || "Request failed.");
    return data;
  }

  function rewardFor(visits) {
    if (visits >= 10) return "Premium reward";
    if (visits >= 5) return "Reward unlocked";
    return "Getting started";
  }

  function renderCustomer(customer) {
    currentCustomer = customer;
    resultBox.hidden = false;
    emptyBox.hidden = true;
    document.getElementById("resultName").textContent = customer.name;
    document.getElementById("resultPhone").textContent = "Phone: " + customer.phone;
    document.getElementById("resultVisits").textContent = customer.visits;
    document.getElementById("resultTier").textContent = rewardFor(customer.visits);

    let target;
    let progress;
    let label;
    if (customer.visits < 5) {
      target = 5;
      progress = customer.visits / target * 100;
      label = (target - customer.visits) + " more visit(s) to the first reward · " + customer.visits + "/" + target;
    } else if (customer.visits < 10) {
      target = 10;
      progress = customer.visits / target * 100;
      label = (target - customer.visits) + " more visit(s) to the premium reward · " + customer.visits + "/" + target;
    } else {
      progress = 100;
      label = "Premium reward milestone reached · " + customer.visits + " visits";
    }

    document.getElementById("progressLabel").textContent = label;
    document.getElementById("progressBar").style.width = Math.min(100, progress) + "%";
    document.getElementById("resultLastVisit").textContent = customer.lastVisit
      ? "Last visit: " + new Date(customer.lastVisit).toLocaleString()
      : "No visits recorded yet.";
    say(statusBox, "Member loaded successfully.");
  }

  function clearMember() {
    currentCustomer = null;
    resultBox.hidden = true;
    emptyBox.hidden = false;
    say(statusBox, "");
  }

  function setBusy(value) {
    busy = value;
    [loginForm.querySelector("button"), ...searchForm.querySelectorAll("button"),
      ...registerForm.querySelectorAll("button"), recordButton,
      document.getElementById("clearMemberButton")].forEach(button => {
      if (button) button.disabled = value;
    });
  }

  async function perform(button, task) {
    if (busy) return;
    setBusy(true);
    try {
      await task();
    } catch (error) {
      const text = error && error.message ? error.message : "Something went wrong.";
      if (!dashboard.hidden) say(statusBox, text);
      else say(loginMessage, text);
      if (error && /sign in|staff password again/i.test(text)) showSignedOut();
    } finally {
      setBusy(false);
    }
  }

  function showSignedIn() {
    loginForm.hidden = true;
    loginMessage.hidden = true;
    signedInPanel.hidden = false;
    dashboard.hidden = false;
    clearMember();
  }

  function showSignedOut() {
    dashboard.hidden = true;
    loginForm.hidden = false;
    signedInPanel.hidden = true;
    passwordInput.value = "";
    currentCustomer = null;
    resultBox.hidden = true;
    emptyBox.hidden = false;
    loginPanel.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  loginForm.addEventListener("submit", event => {
    event.preventDefault();
    const button = loginForm.querySelector("button");
    perform(button, async () => {
      await request({ action: "login", password: passwordInput.value });
      passwordInput.value = "";
      showSignedIn();
      say(statusBox, "Signed in. Customer records are stored in the shared database.");
    });
  });

  searchForm.addEventListener("submit", event => {
    event.preventDefault();
    perform(searchForm.querySelector("button"), async () => {
      const data = await request({ action: "search", phone: normalizePhone(document.getElementById("lookupPhone").value) });
      if (!data.customer) {
        clearMember();
        say(statusBox, "No member was found for that phone number. Register them first.");
        return;
      }
      renderCustomer(data.customer);
    });
  });

  registerForm.addEventListener("submit", event => {
    event.preventDefault();
    perform(registerForm.querySelector("button"), async () => {
      const data = await request({
        action: "register",
        name: document.getElementById("memberName").value.trim(),
        phone: normalizePhone(document.getElementById("memberPhone").value)
      });
      registerForm.reset();
      renderCustomer(data.customer);
      say(statusBox, "Member registered. Record their first visit when appropriate.");
    });
  });

  recordButton.addEventListener("click", () => {
    if (!currentCustomer || busy) return;
    if (!window.confirm("Record one visit for " + currentCustomer.name + "? Only do this when the customer has visited the store.")) return;
    perform(recordButton, async () => {
      const data = await request({ action: "visit", phone: currentCustomer.phone });
      renderCustomer(data.customer);
      say(statusBox, "Visit recorded successfully.");
    });
  });

  document.getElementById("clearMemberButton").addEventListener("click", clearMember);

  document.getElementById("logoutButton").addEventListener("click", async () => {
    try { await request({ action: "logout" }); }
    finally { showSignedOut(); }
  });

  // Restore a valid staff session after a page refresh.
  fetch(apiUrl + "?action=me", { credentials: "same-origin", cache: "no-store" })
    .then(response => response.json())
    .then(data => {
      if (data.authenticated) showSignedIn();
    })
    .catch(() => {
      say(loginMessage, "Backend not reachable yet. Deploy the /api/loyalty function and configure the environment variables described in LOYALTY_SETUP.md.");
    });
});
