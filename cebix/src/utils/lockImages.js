export function lockImages() {
  const isImage = (e) => {
    const t = e.target;
    return t instanceof Element && (t.tagName === "IMG" || t.tagName === "PICTURE");
  };
  const block = (e) => {
    if (isImage(e)) e.preventDefault();
  };
  document.addEventListener("dragstart", block, true);
  document.addEventListener("contextmenu", block, true);
}