// Runs in the document head before paint, so a theme saved by the theme toggle applies without a flash.
export const themeScript = "try{var t=localStorage.getItem('gabf-theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}";
