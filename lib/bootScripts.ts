// Inline scripts run before first paint (kept out of client modules so the server layout gets strings).
const KEY = "maya-theme";

/** Inline script run before paint so the stored mode never flashes. */
export const colorModeScript = `try{var m=localStorage.getItem("${KEY}");if(m==="light"||m==="dark")document.documentElement.setAttribute("data-theme",m)}catch(e){}`;

/** Decides before paint whether the ink intro plays (once per session, never under reduced motion). */
export const introScript = `try{if(!sessionStorage.getItem("mayaIntroSeen")&&!matchMedia("(prefers-reduced-motion: reduce)").matches&&!/[?&]nointro/.test(location.search))document.documentElement.setAttribute("data-intro","play");else document.documentElement.setAttribute("data-intro","done")}catch(e){document.documentElement.setAttribute("data-intro","done")}`;
