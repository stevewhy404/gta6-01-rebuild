// Keyboard + mouse input for Solmar Bay.
export function createInput(canvas) {
  const keys = {};
  const mouse = { x: 0, y: 0, down: false, clicked: false };
  const pressed = {}; // edge-triggered keys, consumed by game code

  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
    if (!keys[e.key.toLowerCase()]) pressed[e.key.toLowerCase()] = true;
    keys[e.key.toLowerCase()] = true;
  });
  window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });
  window.addEventListener('blur', () => { for (const k of Object.keys(keys)) keys[k] = false; });

  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = e.clientX - r.left;
    mouse.y = e.clientY - r.top;
  });
  canvas.addEventListener('mousedown', (e) => {
    mouse.down = true; mouse.clicked = true;
    const r = canvas.getBoundingClientRect();
    mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top;
  });
  window.addEventListener('mouseup', () => { mouse.down = false; });

  return {
    keys, mouse,
    down(...names) { return names.some((n) => keys[n]); },
    // True once for the frame the key went down.
    wasPressed(name) {
      if (pressed[name]) { pressed[name] = false; return true; }
      return false;
    },
    consumeClick() { const c = mouse.clicked; mouse.clicked = false; return c; },
    endFrame() { for (const k of Object.keys(pressed)) pressed[k] = false; },
  };
}
