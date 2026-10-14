const slides = [...document.querySelectorAll('.slide')];
const picker = document.querySelector('#slide-picker');
let current = 0;
slides.forEach((slide, index) => {
  const option = document.createElement('option');
  option.value = String(index);
  option.textContent = `${index + 1}. ${slide.querySelector('h1, h2').textContent}`;
  picker.append(option);
});
function show(index, updateHash = true) {
  current = Math.max(0, Math.min(slides.length - 1, Number.isFinite(index) ? index : 0));
  slides.forEach((slide, i) => {
    slide.hidden = i !== current;
  });
  picker.value = String(current);
  document.querySelector('#previous').disabled = current === 0;
  document.querySelector('#next').disabled = current === slides.length - 1;
  document.querySelector('#position').textContent = `${current + 1} / ${slides.length}`;
  document.querySelector('#notes-text').textContent =
    slides[current].querySelector('.notes').textContent;
  if (updateHash) history.replaceState(null, '', `#slide-${current + 1}`);
}
function fromHash() {
  show(Number(location.hash.replace('#slide-', '')) - 1, false);
}
function toggleNotes() {
  const notes = document.querySelector('#speaker-notes');
  notes.hidden = !notes.hidden;
  document.querySelector('#notes-toggle').setAttribute('aria-expanded', String(!notes.hidden));
}
async function fullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {
    document.querySelector('#position').textContent = 'Use F11 for full screen';
  }
}
document.querySelector('#previous').addEventListener('click', () => show(current - 1));
document.querySelector('#next').addEventListener('click', () => show(current + 1));
picker.addEventListener('change', () => show(Number(picker.value)));
document.querySelector('#notes-toggle').addEventListener('click', toggleNotes);
document.querySelector('#fullscreen').addEventListener('click', fullscreen);
document.querySelector('#print').addEventListener('click', () => window.print());
window.addEventListener('hashchange', fromHash);
document.addEventListener('keydown', (event) => {
  if (
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    /^(INPUT|SELECT|TEXTAREA|BUTTON|A)$/.test(event.target.tagName)
  )
    return;
  const actions = {
    ArrowRight: () => show(current + 1),
    ArrowLeft: () => show(current - 1),
    Home: () => show(0),
    End: () => show(slides.length - 1),
    n: toggleNotes,
    f: fullscreen,
  };
  const action = actions[event.key];
  if (action) {
    event.preventDefault();
    action();
  }
});
fromHash();
