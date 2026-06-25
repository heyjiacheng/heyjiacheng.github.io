function initAboutEmail() {
  const user = "jiacxu";
  const domain = "kth.se";
  const email = `${user}@${domain}`;
  const mailto = `mailto:${email}`;
  const emailEl = document.getElementById("email");
  if (emailEl) {
    emailEl.innerHTML = `<a href="${mailto}">${email}</a>`;
  }
}
