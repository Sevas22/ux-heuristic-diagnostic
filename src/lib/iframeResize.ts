// Cuando esta app corre embebida en un <iframe> (ej. en WordPress), la página que la contiene
// no tiene forma de saber qué tan alto es el contenido real (cross-origin: no puede leer el DOM
// del iframe directamente). Le avisamos activamente el alto vía postMessage cada vez que cambia,
// para que el snippet del lado de WordPress pueda ajustar la altura del iframe y evitar scroll
// doble o espacio en blanco.
const MESSAGE_TYPE = "ux-diagnostic:height";

export function reportHeightToParent(): () => void {
  if (window.parent === window) return () => {};

  const postHeight = () => {
    const height = document.documentElement.scrollHeight;
    window.parent.postMessage({ type: MESSAGE_TYPE, height }, "*");
  };

  const observer = new ResizeObserver(postHeight);
  observer.observe(document.documentElement);
  postHeight();

  return () => observer.disconnect();
}
