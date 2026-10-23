document.addEventListener("DOMContentLoaded", () => {
  const year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();

  const toggle = document.querySelector(".menu-toggle");
  const nav = document.querySelector(".nav");
  if (toggle && nav) {
    toggle.addEventListener("click", () => {
      const open = nav.classList.toggle("nav-open");
      toggle.setAttribute("aria-expanded", String(open));
      toggle.textContent = open ? "✕" : "☰";
    });
  }

  const form = document.getElementById("contactForm");
  if (form) form.addEventListener("submit", (event) => {
    event.preventDefault();
    const values = new FormData(form);
    const subject = encodeURIComponent("My Sweet Hot website enquiry: " + values.get("topic"));
    const body = encodeURIComponent(
      "Name: " + values.get("name") + "\nEmail: " + values.get("email") +
      "\nTopic: " + values.get("topic") + "\n\n" + values.get("message")
    );
    const note = document.getElementById("formNote");
    note.textContent = "Your email application should open with the enquiry ready to send.";
    // Official business email supplied by the owner.
    window.location.href = "mailto:mysweethot2024@gmail.com?subject=" + subject + "&body=" + body;
  });
});