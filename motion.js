const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const clamp = (number, min, max) => Math.min(max, Math.max(min, number));

/* Native touch and horizontal trackpad gestures keep their own momentum. */
let wheel = null;
let frame = 0;
const offset = (surface) => (surface === window ? window.scrollY : surface.scrollLeft);
const limit = (surface) =>
  surface === window
    ? document.documentElement.scrollHeight - window.innerHeight
    : surface.scrollWidth - surface.clientWidth;

function stopWheel() {
  cancelAnimationFrame(frame);
  wheel = null;
  frame = 0;
}
function moveWheel(time) {
  if (!wheel) return;
  const { surface } = wheel;
  const target = clamp(wheel.to, 0, limit(surface));
  const current = offset(surface);
  const distance = target - current;
  const elapsed = clamp(time - wheel.time, 1, 50);
  const step =
    Math.abs(distance) < 2
      ? distance
      : Math.sign(distance) * Math.max(1, Math.abs(distance) * (1 - Math.exp(-elapsed / 70)));
  wheel.time = time;
  if (surface === window) window.scrollTo({ top: current + step, behavior: "instant" });
  else surface.scrollTo({ left: current + step, behavior: "instant" });
  if (Math.abs(target - offset(surface)) < 1 || offset(surface) === current) stopWheel();
  else frame = requestAnimationFrame(moveWheel);
}
window.addEventListener(
  "wheel",
  (event) => {
    if (
      reducedMotion.matches ||
      event.defaultPrevented ||
      !event.cancelable ||
      event.ctrlKey ||
      event.shiftKey ||
      document.querySelector("dialog[open]")
    )
      return;
    if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
      stopWheel();
      return;
    }
    let surface = event.target.closest("[data-rail]") || window;
    const unit = event.deltaMode === 1 ? 18 : event.deltaMode === 2 ? innerHeight : 1;
    const delta = event.deltaY * unit;
    if (!delta) return;
    const atEdge = (s) => (delta > 0 ? limit(s) - offset(s) < 1.5 : offset(s) < 1.5);
    if (surface !== window && (limit(surface) < 2 || atEdge(surface))) surface = window;
    if (atEdge(surface)) {
      stopWheel();
      return;
    }
    event.preventDefault();
    if (wheel?.surface !== surface) {
      stopWheel();
      wheel = { surface, to: offset(surface), time: performance.now() };
    }
    wheel.to = clamp(wheel.to + delta, 0, limit(surface));
    if (!frame) frame = requestAnimationFrame(moveWheel);
  },
  { passive: false },
);
for (const name of ["pointerdown", "keydown", "touchstart", "resize", "hashchange"]) {
  window.addEventListener(name, stopWheel, { passive: true });
}
reducedMotion.addEventListener("change", stopWheel);

for (const track of document.querySelectorAll("[data-rail]")) {
  track.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    const card = track.firstElementChild;
    const stride = card.getBoundingClientRect().width + parseFloat(getComputedStyle(track).columnGap);
    let next = track.scrollLeft + (event.key === "ArrowRight" ? stride : -stride);
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = track.scrollWidth;
    track.scrollTo({ left: next, behavior: reducedMotion.matches ? "instant" : "smooth" });
  });
}

const specimen = document.querySelector(".specimen");
if (specimen) {
  const choices = [...specimen.querySelectorAll("[data-select]")];
  const pictures = [...specimen.querySelectorAll("[data-specimen]")];
  const label = specimen.querySelector("[data-specimen-label]");
  const inspect = specimen.querySelector(".inspect");
  const loupe = specimen.querySelector(".loupe");
  const allowLens = matchMedia(
    "(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)",
  );
  const hideLens = () => {
    loupe.hidden = true;
  };
  let subject = null;
  inspect.hidden = false;
  inspect.addEventListener("pointermove", (event) => {
    if (!allowLens.matches || event.pointerType !== "mouse" || !subject.naturalWidth) return;
    const box = inspect.getBoundingClientRect();
    const x = event.clientX - box.left;
    const y = event.clientY - box.top;
    const scale = Math.min(box.width / subject.naturalWidth, box.height / subject.naturalHeight);
    const width = subject.naturalWidth * scale;
    const height = subject.naturalHeight * scale;
    const sx = x - (box.width - width) / 2;
    const sy = y - (box.height - height) / 2;
    if (sx < 0 || sx > width || sy < 0 || sy > height) {
      hideLens();
      return;
    }
    loupe.hidden = false;
    const radius = loupe.offsetWidth / 2;
    loupe.style.transform = "translate(" + (x - radius) + "px," + (y - radius) + "px)";
    loupe.style.backgroundSize = width * 1.8 + "px " + height * 1.8 + "px";
    loupe.style.backgroundPosition = radius - sx * 1.8 + "px " + (radius - sy * 1.8) + "px";
  });
  inspect.addEventListener("pointerleave", hideLens);
  inspect.addEventListener("click", hideLens);
  allowLens.addEventListener("change", hideLens);
  function select(index) {
    hideLens();
    subject = pictures[index].querySelector("img");
    loupe.style.backgroundImage = 'url("' + subject.src + '")';
    inspect.setAttribute("aria-label", "Увеличить фото: " + choices[index].dataset.name);
    choices.forEach((choice, i) => choice.setAttribute("aria-pressed", String(i === index)));
    pictures.forEach((picture, i) => {
      picture.classList.toggle("active", i === index);
      picture.setAttribute("aria-hidden", String(i !== index));
    });
    label.firstChild.textContent = choices[index].dataset.name + " ";
    label.href = choices[index].dataset.url;
  }
  choices.forEach((choice, index) => {
    choice.addEventListener("click", () => select(index));
    choice.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
      event.preventDefault();
      const next = (index + (event.key === "ArrowRight" ? 1 : -1) + choices.length) % choices.length;
      choices[next].focus();
      select(next);
    });
  });
  select(0);
}

const scene = document.querySelector("[data-scenes]");
if (scene) {
  const section = scene.closest(".process");
  const heading = section.querySelector(".process-heading");
  function positionPhoto() {
    section.style.setProperty("--process-heading-height", heading.offsetHeight + "px");
  }
  positionPhoto();
  new ResizeObserver(positionPhoto).observe(heading);
  const steps = [...scene.querySelectorAll("[data-step]")];
  const pictures = [...scene.querySelectorAll("[data-picture]")];
  const caption = scene.querySelector("[data-picture-label]");
  const mobile = window.matchMedia("(max-width:740px)");
  let active = -1;
  let queued = false;
  function paintScene() {
    queued = false;
    const marker = innerHeight * (mobile.matches ? 0.7 : 0.53);
    let current = 0;
    steps.forEach((step, index) => {
      if (step.getBoundingClientRect().top <= marker) current = index;
    });
    if (active === current) return;
    active = current;
    pictures.forEach((picture, index) => {
      picture.classList.toggle("current", current === index);
      picture.setAttribute("aria-hidden", String(current !== index));
    });
    caption.textContent = steps[current].dataset.step;
  }
  function queueScene() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(paintScene);
  }
  window.addEventListener("scroll", queueScene, { passive: true });
  window.addEventListener("resize", queueScene, { passive: true });
  paintScene();
}

const menu = document.querySelector("[data-menu]");
document.addEventListener("click", (event) => {
  if (menu.open && (!menu.contains(event.target) || event.target.closest("a"))) menu.open = false;
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && menu.open) {
    menu.open = false;
    menu.querySelector("summary").focus();
  }
});

const viewer = document.querySelector(".viewer");
const samples = [...document.querySelectorAll("[data-zoom]")];
const image = viewer.querySelector(".viewer-art img");
const title = viewer.querySelector("h2");
const source = viewer.querySelector(".viewer-source");
const controls = viewer.querySelector(".viewer-nav");
const prev = controls.querySelector("[data-prev]");
const next = controls.querySelector("[data-next]");
const heroChoices = [...document.querySelectorAll("[data-select]")];
const gallery = samples.length
  ? samples.map((sample) => ({
      name: sample.dataset.label,
      src: sample.querySelector("img").src,
      url: sample.href,
    }))
  : heroChoices.map((choice) => ({
      name: choice.dataset.name,
      src: choice.querySelector("img").src,
      url: choice.dataset.url,
    }));
let selected = -1;
let opener = null;

function drawSample(index) {
  const sample = gallery[index];
  if (!sample) return;
  selected = index;
  title.textContent = sample.name;
  image.alt = sample.name;
  image.src = sample.src;
  source.textContent = samples.length ? "Карточка на сайте завода ↗" : "Открыть раздел каталога →";
  source.href = sample.url;
  controls.hidden = gallery.length < 2;
  prev.disabled = index === 0;
  next.disabled = index === gallery.length - 1;
}
function openViewer(trigger) {
  opener = trigger;
  stopWheel();
  viewer.showModal();
  viewer.querySelector(".close").focus({ preventScroll: true });
}
function plainClick(event) {
  return event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey;
}
samples.forEach((sample, index) => {
  sample.addEventListener("click", (event) => {
    if (!plainClick(event)) return;
    event.preventDefault();
    drawSample(index);
    openViewer(sample);
  });
});
document.querySelector(".inspect")?.addEventListener("click", (event) => {
  drawSample(heroChoices.findIndex((choice) => choice.getAttribute("aria-pressed") === "true"));
  openViewer(event.currentTarget);
});
document.querySelector("[data-map]").addEventListener("click", (event) => {
  if (!plainClick(event)) return;
  event.preventDefault();
  selected = -1;
  title.textContent = "Схема проезда к заводу";
  image.alt = "Схема проезда к заводу на Радиозаводском шоссе, 23, Муром";
  image.src = "assets/map-murom.webp";
  controls.hidden = true;
  source.href = "https://pressbottle.ru/uploads/downloads/map3.png";
  source.textContent = "Открыть схему в исходном размере ↗";
  openViewer(event.currentTarget);
});
prev.addEventListener("click", () => drawSample(selected - 1));
next.addEventListener("click", () => drawSample(selected + 1));
viewer.querySelector(".close").addEventListener("click", () => viewer.close());
viewer.addEventListener("keydown", (event) => {
  if (selected < 0 || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
  event.preventDefault();
  drawSample(selected + (event.key === "ArrowRight" ? 1 : -1));
});
viewer.addEventListener("close", () => opener?.focus({ preventScroll: true }));
viewer.addEventListener("click", (event) => {
  if (event.target !== viewer) return;
  const bounds = viewer.getBoundingClientRect();
  if (
    event.clientX < bounds.left ||
    event.clientX > bounds.right ||
    event.clientY < bounds.top ||
    event.clientY > bounds.bottom
  )
    viewer.close();
});
